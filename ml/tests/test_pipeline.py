"""Tests for the synthetic training pipeline and the export schema."""

import json
from pathlib import Path

import numpy as np

from sign_ml.data import make_synthetic_dataset
from sign_ml.pipeline import run_synthetic_pipeline


def test_synthetic_dataset_shapes() -> None:
    x, y, labels = make_synthetic_dataset(samples_per_class=10, seed=1)
    assert x.shape == (len(labels) * 10, 63)
    assert y.shape == (len(labels) * 10,)
    assert {int(v) for v in np.unique(y)} == set(range(len(labels)))


def test_synthetic_dataset_is_deterministic() -> None:
    a, _, _ = make_synthetic_dataset(samples_per_class=5, seed=7)
    b, _, _ = make_synthetic_dataset(samples_per_class=5, seed=7)
    np.testing.assert_array_equal(a, b)


def test_pipeline_trains_and_exports(tmp_path: Path) -> None:
    out = tmp_path / "model.json"
    result = run_synthetic_pipeline(model_path=out, samples_per_class=30, seed=0)

    # Synthetic clusters are separable, so the pipeline should learn them well.
    assert result["metrics"]["accuracy"] > 0.9
    assert out.exists()

    model = json.loads(out.read_text(encoding="utf-8"))
    assert model["format"] == "mlp-1"
    assert model["normalization"] == "wrist-mcp9-mirror-v1"
    assert model["inputDim"] == 63
    assert len(model["labels"]) == result["num_classes"]

    # First layer maps 63 inputs; final layer is softmax over the classes.
    first_layer = model["layers"][0]
    assert len(first_layer["W"][0]) == 63
    final_layer = model["layers"][-1]
    assert final_layer["activation"] == "softmax"
    assert len(final_layer["b"]) == result["num_classes"]
    assert len(final_layer["W"]) == result["num_classes"]
