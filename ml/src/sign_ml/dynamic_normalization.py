"""Dynamic-sign frame normalization — mirror of
``frontend/src/recognition/dynamicNormalization.ts``.

MUST stay numerically equivalent to the TypeScript implementation. The shared
golden fixture
``frontend/src/recognition/fixtures/dynamic-normalization.golden.json`` is the
parity contract (see ``../../.claude/docs/recognition.md`` §5).

One holistic frame -> a fixed-length feature vector::

    [ pose block (33) | left-hand shape (63) | right-hand shape (63) |
      leftPresent, rightPresent ]

Pose is shoulder-centered and shoulder-width-scaled over a fixed upper-body
landmark subset (not mirrored — the side a sign occupies carries meaning); hand
shape reuses the static, location-invariant hand normalization.
"""

from __future__ import annotations

import numpy as np
import numpy.typing as npt

from .normalization import (
    HAND_LANDMARK_COUNT,
    flatten_landmarks,
    normalize_hand_landmarks,
)

POSE_LANDMARK_COUNT = 33
LEFT_SHOULDER = 11
RIGHT_SHOULDER = 12
# Kept upper-body pose landmarks, in this exact order (must match the TS mirror):
# nose, eyes, ears, shoulders, elbows, wrists.
UPPER_BODY_POSE_INDICES: tuple[int, ...] = (0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16)

POSE_BLOCK_LEN = len(UPPER_BODY_POSE_INDICES) * 3  # 33
HAND_BLOCK_LEN = HAND_LANDMARK_COUNT * 3  # 63
FRAME_FEATURE_DIM = POSE_BLOCK_LEN + 2 * HAND_BLOCK_LEN + 2  # 161
# Spatial coords only (all but the 2 trailing presence flags); the part velocity
# is computed over.
SPATIAL_FEATURE_DIM = FRAME_FEATURE_DIM - 2  # 159
# Model input after motion features are appended (P4M4): positions + velocity.
MODEL_FEATURE_DIM = FRAME_FEATURE_DIM + SPATIAL_FEATURE_DIM  # 320

DYNAMIC_NORMALIZATION_ID = "pose-shoulder-hands-v1"
# Identifies the full model-input feature set (per-frame normalization + motion);
# the runtime skew guard checks this so a v1 (no-motion) model can't be paired with
# a motion-feeding runtime (P4M4, ADR-022).
DYNAMIC_FEATURE_ID = "pose-shoulder-hands-motion-v1"
WINDOW_SIZE = 30

FloatArray = npt.NDArray[np.float64]


def with_motion(window: npt.ArrayLike) -> FloatArray:
    """Append per-frame **velocity** (first difference of the spatial coords) to a
    normalized ``(T, FRAME_FEATURE_DIM)`` window → ``(T, MODEL_FEATURE_DIM)``.

    Velocity is the discriminator for visually-similar signs (recognition.md §6.8);
    the GRU only sees positions otherwise. Mirror of the TS ``withMotion`` — the
    shared ``dynamic-motion.golden.json`` fixture is the parity contract.

    Details: velocity is computed on the spatial dims only (the 2 presence flags are
    carried through unchanged, never differenced). It is **zeroed across inactive
    (all-zero) frames** — front padding and fully-undetected frames — so the
    padding→first-real-frame boundary doesn't inject a spurious spike, and zero for
    the first frame. Train and serve both pad front to ``WINDOW_SIZE`` identically, so
    this is parity-safe."""
    w = np.asarray(window, dtype=np.float64)
    if w.ndim != 2:
        raise ValueError(f"Expected a 2-D (T, F) window, got shape {w.shape}")
    out: FloatArray = add_motion_features(w[np.newaxis])[0]
    return out


def add_motion_features(x: npt.ArrayLike) -> FloatArray:
    """Batched :func:`with_motion` over ``(N, T, F)`` windows → ``(N, T, 2F - 2)``."""
    arr = np.asarray(x, dtype=np.float64)
    if arr.ndim != 3:
        raise ValueError(f"Expected (N, T, F) windows, got shape {arr.shape}")
    spatial_dim = arr.shape[2] - 2  # all but the 2 trailing presence flags
    spatial = arr[:, :, :spatial_dim]
    motion = np.zeros_like(spatial)
    motion[:, 1:, :] = spatial[:, 1:, :] - spatial[:, :-1, :]
    active = np.any(arr != 0.0, axis=2)  # padding / fully-undetected frames are all 0
    gate = np.zeros(active.shape, dtype=bool)
    gate[:, 1:] = active[:, 1:] & active[:, :-1]
    motion[~gate] = 0.0
    return np.concatenate([arr, motion], axis=2)


def normalize_pose(pose: npt.ArrayLike) -> FloatArray:
    """Shoulder-center + shoulder-width-scale the upper-body pose subset.

    Returns a ``(len(UPPER_BODY_POSE_INDICES), 3)`` array.
    """
    pts: FloatArray = np.asarray(pose, dtype=np.float64)
    if pts.shape != (POSE_LANDMARK_COUNT, 3):
        raise ValueError(
            f"Expected ({POSE_LANDMARK_COUNT}, 3) pose landmarks, got {pts.shape}"
        )

    left = pts[LEFT_SHOULDER]
    right = pts[RIGHT_SHOULDER]
    mid = (left + right) / 2.0
    width = float(np.linalg.norm(left - right))
    scale = 0.0 if width == 0.0 else 1.0 / width

    selected = pts[list(UPPER_BODY_POSE_INDICES)]
    out: FloatArray = (selected - mid) * scale
    return out


def normalize_frame(
    pose: npt.ArrayLike | None,
    left_hand: npt.ArrayLike | None,
    right_hand: npt.ArrayLike | None,
) -> FloatArray:
    """Flatten one holistic frame into the fixed ``FRAME_FEATURE_DIM`` vector."""
    pose_block: FloatArray = (
        flatten_landmarks(normalize_pose(pose))
        if pose is not None
        else np.zeros(POSE_BLOCK_LEN, dtype=np.float64)
    )
    left_block: FloatArray = (
        flatten_landmarks(normalize_hand_landmarks(left_hand, "Left"))
        if left_hand is not None
        else np.zeros(HAND_BLOCK_LEN, dtype=np.float64)
    )
    right_block: FloatArray = (
        flatten_landmarks(normalize_hand_landmarks(right_hand, "Right"))
        if right_hand is not None
        else np.zeros(HAND_BLOCK_LEN, dtype=np.float64)
    )
    presence: FloatArray = np.array(
        [1.0 if left_hand is not None else 0.0, 1.0 if right_hand is not None else 0.0],
        dtype=np.float64,
    )

    return np.concatenate([pose_block, left_block, right_block, presence])
