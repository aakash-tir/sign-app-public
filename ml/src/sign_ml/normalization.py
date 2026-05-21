"""Hand-landmark normalization — mirror of
``frontend/src/recognition/normalization.ts``.

MUST stay numerically equivalent to the TypeScript implementation. The shared
golden fixture
``frontend/src/recognition/fixtures/normalization.golden.json`` is the parity
contract (see ``../../.claude/docs/recognition.md`` §5):

1. translate so the wrist (index 0) is the origin,
2. scale by the wrist -> middle-finger-MCP (index 9) distance,
3. mirror Left hands across x so the model only ever sees one handedness.
"""

from __future__ import annotations

import numpy as np
import numpy.typing as npt

HAND_LANDMARK_COUNT = 21
WRIST = 0
MIDDLE_FINGER_MCP = 9
CANONICAL_HANDEDNESS = "Right"
# Identifier embedded in exported models so the frontend can assert it applies
# the same normalization the model was trained with.
NORMALIZATION_ID = "wrist-mcp9-mirror-v1"

FloatArray = npt.NDArray[np.float64]


def normalize_hand_landmarks(landmarks: npt.ArrayLike, handedness: str) -> FloatArray:
    """Normalize one hand's 21 (x, y, z) landmarks. Returns a (21, 3) array."""
    pts: FloatArray = np.asarray(landmarks, dtype=np.float64)
    if pts.shape != (HAND_LANDMARK_COUNT, 3):
        raise ValueError(
            f"Expected ({HAND_LANDMARK_COUNT}, 3) landmarks, got {pts.shape}"
        )

    wrist = pts[WRIST]
    ref = pts[MIDDLE_FINGER_MCP]
    ref_dist = float(np.linalg.norm(ref - wrist))
    scale = 0.0 if ref_dist == 0.0 else 1.0 / ref_dist
    mirror = 1.0 if handedness == CANONICAL_HANDEDNESS else -1.0

    out: FloatArray = (pts - wrist) * scale
    out[:, 0] *= mirror
    return out


def flatten_landmarks(landmarks: npt.ArrayLike) -> FloatArray:
    """Flatten landmarks to a ``[x0, y0, z0, x1, y1, z1, ...]`` feature vector."""
    return np.asarray(landmarks, dtype=np.float64).reshape(-1)
