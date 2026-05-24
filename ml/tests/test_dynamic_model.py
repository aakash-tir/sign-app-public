"""Tests for the dynamic-model helpers (pure parts run without TensorFlow)."""

from pathlib import Path
from typing import Any

import numpy as np
import pytest

from sign_ml.dynamic_export import build_metadata
from sign_ml.dynamic_model import (
    augment_sequences,
    drop_landmarks,
    resolve_splits,
    rotate_xy,
    signer_folds,
    stratified_folds,
    time_warp,
    top_k_accuracy,
)
from sign_ml.dynamic_normalization import (
    DYNAMIC_NORMALIZATION_ID,
    FRAME_FEATURE_DIM,
    WINDOW_SIZE,
)


def test_top_k_accuracy_basic() -> None:
    y = np.array([0, 1, 2], dtype=np.int64)
    probs = np.array(
        [
            [0.7, 0.2, 0.1],  # top1 correct
            [0.6, 0.3, 0.1],  # top1 wrong, in top2
            [0.1, 0.2, 0.7],  # top1 correct
        ],
        dtype=np.float64,
    )
    assert top_k_accuracy(y, probs, 1) == 2 / 3
    assert top_k_accuracy(y, probs, 2) == 1.0


def test_top_k_accuracy_empty() -> None:
    assert top_k_accuracy(np.array([], dtype=np.int64), np.zeros((0, 3)), 1) == 0.0


def test_top_k_clamps_k_above_classes() -> None:
    y = np.array([0], dtype=np.int64)
    probs = np.array([[0.4, 0.6]], dtype=np.float64)
    assert top_k_accuracy(y, probs, 5) == 1.0  # k clamped to n_classes


def _partition_ok(masks: tuple[Any, Any, Any], n: int) -> bool:
    train, val, test = masks
    stacked = np.stack([train, val, test])
    each_once = bool(np.all(stacked.sum(axis=0) == 1))  # every sample in exactly one
    return each_once and int(stacked.sum()) == n


def test_resolve_splits_uses_existing_labels() -> None:
    s = np.array(["train", "train", "val", "test"], dtype=np.str_)
    train, val, test = resolve_splits(s)
    assert _partition_ok((train, val, test), 4)
    assert test.sum() == 1 and val.sum() == 1


def test_resolve_splits_promotes_val_when_no_test() -> None:
    s = np.array(["train", "train", "train", "val", "val"], dtype=np.str_)
    train, val, test = resolve_splits(s)
    assert _partition_ok((train, val, test), 5)
    assert test.sum() >= 1 and val.sum() >= 1  # test from old val; val carved


def test_resolve_splits_carves_when_all_train() -> None:
    s = np.array(["train"] * 10, dtype=np.str_)
    train, val, test = resolve_splits(s)
    assert _partition_ok((train, val, test), 10)
    assert train.sum() >= 1 and val.sum() >= 1 and test.sum() >= 1


def test_augment_preserves_shape_and_presence_flags() -> None:
    rng = np.random.default_rng(0)
    x = np.ones((4, 30, 161), dtype=np.float64)
    out = augment_sequences(x, rng, frame_dropout=0.0)
    assert out.shape == x.shape
    # last two columns are presence flags — untouched by spatial jitter
    np.testing.assert_array_equal(out[:, :, -2:], x[:, :, -2:])
    # spatial dims were jittered (scaled + noised) so they changed
    assert not np.allclose(out[:, :, :-2], x[:, :, :-2])


def test_augment_frame_dropout_zeros_whole_frames() -> None:
    rng = np.random.default_rng(1)
    x = np.ones((2, 10, 161), dtype=np.float64)
    out = augment_sequences(
        x, rng, noise_std=0.0, scale_range=(1.0, 1.0), frame_dropout=1.0
    )
    np.testing.assert_array_equal(out, np.zeros_like(x))  # every frame dropped


def test_augment_is_deterministic_with_seed() -> None:
    x = np.random.default_rng(2).standard_normal((3, 30, 161))
    a = augment_sequences(x, np.random.default_rng(7))
    b = augment_sequences(x, np.random.default_rng(7))
    np.testing.assert_array_equal(a, b)


def test_drop_landmarks_zeros_whole_triplets_and_keeps_presence() -> None:
    rng = np.random.default_rng(0)
    # spatial = ones, presence = [1, 1]; F = 3*4 + 2 = 14 (4 landmarks)
    x = np.ones((3, 5, 14), dtype=np.float64)
    out = drop_landmarks(x, rng, p=0.5)
    assert out.shape == x.shape
    # each landmark triplet is all-kept (1,1,1) or all-dropped (0,0,0), never partial
    triplets = out[:, :, :12].reshape(3, 5, 4, 3)
    assert np.all((triplets == 1.0).all(axis=-1) | (triplets == 0.0).all(axis=-1))
    # presence flags untouched, and *something* was dropped at p=0.5
    np.testing.assert_array_equal(out[:, :, -2:], x[:, :, -2:])
    assert (out[:, :, :12] == 0.0).any()


def test_drop_landmarks_p_extremes() -> None:
    rng = np.random.default_rng(1)
    x = np.ones((2, 4, 14), dtype=np.float64)
    np.testing.assert_array_equal(drop_landmarks(x, rng, p=0.0), x)  # no-op
    dropped = drop_landmarks(x, rng, p=1.0)
    assert np.all(dropped[:, :, :12] == 0.0)  # all spatial zeroed
    np.testing.assert_array_equal(dropped[:, :, -2:], x[:, :, -2:])  # presence kept


def test_rotate_xy_is_isometry_and_preserves_zeros_presence() -> None:
    rng = np.random.default_rng(2)
    x = rng.standard_normal((4, 6, 14))
    x[:, :, -2:] = 1.0  # presence flags
    x[0, 0, :12] = 0.0  # a zero (padding/missing) landmark frame
    out = rotate_xy(x, np.random.default_rng(3), max_deg=20.0)
    assert out.shape == x.shape
    # rotation preserves each landmark's (x, y) magnitude
    before = x[:, :, :12].reshape(4, 6, 4, 3)
    after = out[:, :, :12].reshape(4, 6, 4, 3)
    np.testing.assert_allclose(
        np.hypot(before[..., 0], before[..., 1]),
        np.hypot(after[..., 0], after[..., 1]),
    )
    np.testing.assert_allclose(after[..., 2], before[..., 2])  # z untouched
    np.testing.assert_array_equal(out[:, :, -2:], x[:, :, -2:])  # presence untouched
    assert np.all(out[0, 0, :12] == 0.0)  # zero landmark stays zero


def test_rotate_xy_zero_angle_is_noop() -> None:
    x = np.random.default_rng(4).standard_normal((2, 3, 14))
    np.testing.assert_array_equal(
        rotate_xy(x, np.random.default_rng(5), max_deg=0.0), x
    )


def test_time_warp_shape_last_frame_and_presence() -> None:
    rng = np.random.default_rng(6)
    x = rng.standard_normal((5, 8, 14))
    x[:, :, -2:] = rng.integers(0, 2, size=(5, 8, 2)).astype(np.float64)
    out = time_warp(x, np.random.default_rng(7), max_rate=0.3)
    assert out.shape == x.shape
    # anchored at the last frame: the most-recent (real) frame is preserved exactly
    np.testing.assert_array_equal(out[:, -1, :], x[:, -1, :])
    # whole-frame selection → presence flags remain valid {0, 1} values from input
    assert set(np.unique(out[:, :, -2:]).tolist()) <= set(
        np.unique(x[:, :, -2:]).tolist()
    )


def test_time_warp_zero_rate_is_noop_and_deterministic() -> None:
    x = np.random.default_rng(8).standard_normal((3, 6, 14))
    np.testing.assert_array_equal(
        time_warp(x, np.random.default_rng(9), max_rate=0.0), x
    )
    a = time_warp(x, np.random.default_rng(11), max_rate=0.25)
    b = time_warp(x, np.random.default_rng(11), max_rate=0.25)
    np.testing.assert_array_equal(a, b)


def test_augment_new_params_off_by_default_and_keep_presence() -> None:
    x = np.ones((3, 30, 161), dtype=np.float64)
    # with the P3M3 knobs at their defaults (0), only the legacy jitter applies
    legacy = augment_sequences(x, np.random.default_rng(0), frame_dropout=0.0)
    np.testing.assert_array_equal(legacy[:, :, -2:], x[:, :, -2:])  # presence intact
    # enabling an addition changes the output (it is actually wired in)
    with_rot = augment_sequences(
        x, np.random.default_rng(0), frame_dropout=0.0, rotation_deg=15.0
    )
    assert not np.allclose(with_rot[:, :, :-2], legacy[:, :, :-2])
    np.testing.assert_array_equal(with_rot[:, :, -2:], x[:, :, -2:])  # presence intact


def test_stratified_folds_partition_and_balance() -> None:
    y = np.array([0, 0, 0, 0, 1, 1, 1, 1, 2, 2], dtype=np.int64)
    masks = stratified_folds(y, 2, seed=0)
    assert len(masks) == 2
    stacked = np.stack(masks)
    assert np.all(stacked.sum(axis=0) == 1)  # each sample in exactly one fold
    assert int(stacked.sum()) == len(y)
    # each class is split across both folds
    for cls in (0, 1):
        assert masks[0][y == cls].any() and masks[1][y == cls].any()


def test_signer_folds_partition_and_no_leakage() -> None:
    signers = ["a", "a", "a", "b", "b", "c", "c", "d", "d", "e", "f", "g"]
    masks = signer_folds(signers, 3, seed=0)
    assert len(masks) == 3
    stacked = np.stack(masks)
    assert np.all(stacked.sum(axis=0) == 1)  # each sample in exactly one fold
    assert int(stacked.sum()) == len(signers)
    # the leakage guard: every signer's clips land in exactly one fold
    fold_of = np.argmax(stacked, axis=0)
    for sid in set(signers):
        folds_used = {int(fold_of[i]) for i, s in enumerate(signers) if s == sid}
        assert len(folds_used) == 1


def test_signer_folds_handles_unknown_signers() -> None:
    signers: list[str | None] = ["a", "a", None, "", "b", None]
    masks = signer_folds(signers, 2, seed=1)
    stacked = np.stack(masks)
    assert np.all(stacked.sum(axis=0) == 1)  # unknowns still partition cleanly
    assert int(stacked.sum()) == len(signers)
    # the known signer "a" is not split across folds
    fold_of = np.argmax(stacked, axis=0)
    assert fold_of[0] == fold_of[1]


def test_signer_folds_balances_by_sample_count() -> None:
    # one big signer + singletons: greedy balancing keeps fold sizes comparable
    signers = ["big"] * 6 + [f"s{i}" for i in range(6)]
    masks = signer_folds(signers, 3, seed=0)
    sizes = sorted(int(m.sum()) for m in masks)
    assert sizes[-1] - sizes[0] <= 3


def test_signer_folds_deterministic_with_seed() -> None:
    signers = ["a", "b", "c", "a", "b", "c", "d", "e", "f"]
    a = signer_folds(signers, 3, seed=5)
    b = signer_folds(signers, 3, seed=5)
    for ma, mb in zip(a, b, strict=True):
        np.testing.assert_array_equal(ma, mb)


def test_build_metadata_carries_skew_guard() -> None:
    md = build_metadata(["yes", "no"])
    assert md["format"] == "onnx"
    assert md["normalization"] == DYNAMIC_NORMALIZATION_ID
    assert md["window"] == WINDOW_SIZE
    assert md["featureDim"] == FRAME_FEATURE_DIM
    assert md["labels"] == ["yes", "no"]


def test_train_and_eval_runs_on_tiny_data() -> None:
    pytest.importorskip("torch")
    from sign_ml.dynamic_model import train_and_eval

    rng = np.random.default_rng(0)
    n, window, feat, classes = 24, 8, 6, 3
    x = rng.standard_normal((n, window, feat))
    y = rng.integers(0, classes, n).astype(np.int64)
    splits = np.array(["train"] * n, dtype=np.str_)
    model, metrics = train_and_eval(
        x, y, splits, n_classes=classes, seed=0, epochs=3, batch_size=8
    )
    assert 0.0 <= metrics["top1"] <= 1.0
    assert metrics["n_test"] >= 1 and metrics["n_val"] >= 1
    assert model is not None


def test_export_onnx_writes_files(tmp_path: Path) -> None:
    pytest.importorskip("torch")
    from sign_ml.dynamic_export import export_onnx
    from sign_ml.dynamic_model import build_sequence_model

    model = build_sequence_model(3, feat=6, seed=0)
    export_onnx(model, tmp_path, ["a", "b", "c"], window=8, feat=6)
    assert (tmp_path / "model.onnx").exists()
    assert (tmp_path / "metadata.json").exists()
