"""Datasets for the fingerspelling classifier.

The synthetic generator produces a deterministic, separable dataset so the whole
pipeline (normalize -> train -> eval -> export) can run and be tested without the
credentialed real ASL-alphabet image dataset. Real images are handled by
``extract.py`` (optional ``images`` extra).
"""

from __future__ import annotations

import numpy as np
import numpy.typing as npt

from .normalization import flatten_landmarks, normalize_hand_landmarks

FloatArray = npt.NDArray[np.float64]
IntArray = npt.NDArray[np.int64]

# Static one-handed ASL alphabet letters. J and Z are dynamic (motion) and are
# handled by the sequence model in a later milestone.
STATIC_ASL_LETTERS: list[str] = list("ABCDEFGHIKLMNOPQRSTUVWXY")


def make_synthetic_dataset(
    labels: list[str] | None = None,
    samples_per_class: int = 40,
    noise: float = 0.02,
    seed: int = 0,
) -> tuple[FloatArray, IntArray, list[str]]:
    """Generate a deterministic synthetic landmark dataset.

    Each class gets a distinct random "centroid hand" in raw [0, 1] landmark
    space; samples are the centroid plus Gaussian noise, run through the SAME
    normalize + flatten path as real data. This is NOT real ASL — it exists to
    exercise and verify the pipeline end-to-end.
    """
    names = labels if labels is not None else STATIC_ASL_LETTERS
    rng = np.random.default_rng(seed)
    features: list[FloatArray] = []
    targets: list[int] = []

    for class_index, _name in enumerate(names):
        centroid = rng.uniform(0.2, 0.8, size=(21, 3))
        # Keep wrist -> middle-MCP distance comfortably non-zero.
        centroid[9] = centroid[0] + rng.uniform(0.2, 0.4, size=3)
        for _ in range(samples_per_class):
            hand = centroid + rng.normal(0.0, noise, size=(21, 3))
            features.append(flatten_landmarks(normalize_hand_landmarks(hand, "Right")))
            targets.append(class_index)

    x = np.asarray(features, dtype=np.float64)
    y = np.asarray(targets, dtype=np.int64)
    return x, y, list(names)
