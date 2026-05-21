"""End-to-end fingerspelling pipeline: data -> train -> eval -> export."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from sklearn.model_selection import train_test_split

from .data import make_synthetic_dataset
from .eval import evaluate
from .export import model_to_dict, save_model_json
from .model import train_mlp


def repo_root() -> Path:
    # ml/src/sign_ml/pipeline.py -> repo root is three parents up from src.
    return Path(__file__).resolve().parents[3]


def default_model_path() -> Path:
    return (
        repo_root()
        / "frontend"
        / "src"
        / "recognition"
        / "models"
        / "fingerspelling.json"
    )


def run_synthetic_pipeline(
    model_path: Path | None = None,
    samples_per_class: int = 40,
    seed: int = 0,
) -> dict[str, Any]:
    """Train on synthetic data and export the model JSON. Returns a summary."""
    x, y, labels = make_synthetic_dataset(
        samples_per_class=samples_per_class, seed=seed
    )
    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.25, random_state=seed, stratify=y
    )

    clf = train_mlp(x_train, y_train, seed=seed)
    metrics = evaluate(clf, x_test, y_test, labels)
    model = model_to_dict(clf, labels, x.shape[1])

    out_path = model_path if model_path is not None else default_model_path()
    save_model_json(model, out_path)

    return {
        "metrics": metrics,
        "model_path": str(out_path),
        "num_classes": len(labels),
        "data": "synthetic",
    }
