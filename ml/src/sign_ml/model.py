"""Train the static-sign MLP classifier (scikit-learn)."""

from __future__ import annotations

from typing import Any

import numpy.typing as npt
from sklearn.neural_network import MLPClassifier


def train_mlp(
    x: npt.ArrayLike,
    y: npt.ArrayLike,
    hidden_layer_sizes: tuple[int, ...] = (32,),
    seed: int = 0,
    max_iter: int = 500,
) -> Any:
    """Fit a small ReLU MLP. Returns the fitted scikit-learn classifier."""
    clf = MLPClassifier(
        hidden_layer_sizes=hidden_layer_sizes,
        activation="relu",
        random_state=seed,
        max_iter=max_iter,
    )
    clf.fit(x, y)
    return clf
