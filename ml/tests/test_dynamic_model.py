"""Tests for the dynamic-model helpers (pure parts run without TensorFlow)."""

from pathlib import Path
from typing import Any

import numpy as np
import pytest

from sign_ml.dynamic_export import build_metadata
from sign_ml.dynamic_model import (
    augment_sequences,
    resolve_splits,
    stratified_folds,
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
