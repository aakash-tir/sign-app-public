"""Tests for the framework-free parts of dynamic_extract (no mediapipe needed)."""

import numpy as np

from sign_ml.dynamic_extract import Frame, normalize_clip, to_fixed_window
from sign_ml.dynamic_normalization import (
    FRAME_FEATURE_DIM,
    WINDOW_SIZE,
    normalize_frame,
)


def _pose() -> list[list[float]]:
    pose = [[0.5 + 0.005 * i, 0.4 + 0.006 * i, 0.002 * i] for i in range(33)]
    pose[11] = [0.6, 0.5, 0.0]
    pose[12] = [0.4, 0.5, 0.0]
    return pose


def _hand() -> list[list[float]]:
    return [[0.5 + 0.02 * i, 0.5 + 0.03 * i, 0.01 * i] for i in range(21)]


def test_normalize_clip_empty() -> None:
    out = normalize_clip([])
    assert out.shape == (0, FRAME_FEATURE_DIM)


def test_normalize_clip_matches_normalize_frame() -> None:
    pose, hand = _pose(), _hand()
    frames: list[Frame] = [(pose, hand, hand), (None, None, None), (pose, None, hand)]
    out = normalize_clip(frames)
    assert out.shape == (3, FRAME_FEATURE_DIM)
    np.testing.assert_allclose(out[0], normalize_frame(pose, hand, hand))
    np.testing.assert_array_equal(out[1], np.zeros(FRAME_FEATURE_DIM))
    np.testing.assert_allclose(out[2], normalize_frame(pose, None, hand))


def test_fixed_window_exact_length_unchanged() -> None:
    seq = np.arange(WINDOW_SIZE * FRAME_FEATURE_DIM, dtype=np.float64).reshape(
        WINDOW_SIZE, FRAME_FEATURE_DIM
    )
    np.testing.assert_array_equal(to_fixed_window(seq), seq)


def test_fixed_window_downsamples_long_clip() -> None:
    t = WINDOW_SIZE * 3
    seq = np.arange(t * FRAME_FEATURE_DIM, dtype=np.float64).reshape(
        t, FRAME_FEATURE_DIM
    )
    out = to_fixed_window(seq)
    assert out.shape == (WINDOW_SIZE, FRAME_FEATURE_DIM)
    # endpoints preserved; frames are a subset (evenly spaced) of the original.
    np.testing.assert_array_equal(out[0], seq[0])
    np.testing.assert_array_equal(out[-1], seq[-1])


def test_fixed_window_front_pads_short_clip() -> None:
    t = 4
    seq = np.ones((t, FRAME_FEATURE_DIM), dtype=np.float64)
    out = to_fixed_window(seq)
    assert out.shape == (WINDOW_SIZE, FRAME_FEATURE_DIM)
    np.testing.assert_array_equal(out[: WINDOW_SIZE - t], 0)  # padding at front
    np.testing.assert_array_equal(out[WINDOW_SIZE - t :], 1)  # real frames at end


def test_fixed_window_empty_clip_is_all_zeros() -> None:
    out = to_fixed_window(np.zeros((0, FRAME_FEATURE_DIM)))
    assert out.shape == (WINDOW_SIZE, FRAME_FEATURE_DIM)
    np.testing.assert_array_equal(out, 0)
