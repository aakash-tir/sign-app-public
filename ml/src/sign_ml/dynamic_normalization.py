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

DYNAMIC_NORMALIZATION_ID = "pose-shoulder-hands-v1"
WINDOW_SIZE = 30

FloatArray = npt.NDArray[np.float64]


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
