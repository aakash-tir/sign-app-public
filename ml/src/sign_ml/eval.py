"""Evaluation metrics for the fingerspelling classifier."""

from __future__ import annotations

from typing import Any

import numpy as np
import numpy.typing as npt
from sklearn.metrics import accuracy_score

FloatArray = npt.NDArray[np.float64]
IntArray = npt.NDArray[np.int64]


def evaluate(clf: Any, x: FloatArray, y: IntArray, labels: list[str]) -> dict[str, Any]:
    """Return overall and per-class accuracy on ``(x, y)``."""
    preds = clf.predict(x)
    overall = float(accuracy_score(y, preds))

    per_class: dict[str, float] = {}
    for class_index, name in enumerate(labels):
        mask = y == class_index
        if bool(np.any(mask)):
            per_class[name] = float(accuracy_score(y[mask], preds[mask]))

    return {"accuracy": overall, "per_class": per_class}
