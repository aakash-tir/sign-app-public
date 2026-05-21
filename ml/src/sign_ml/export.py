"""Export a trained MLP to plain JSON weights for the frontend.

The frontend runs a tiny hand-written forward pass over this JSON (no TF.js /
ONNX runtime needed for the static MVP — see ADR-011). Schema (``format``
``"mlp-1"``)::

    {
      "format": "mlp-1",
      "normalization": "wrist-mcp9-mirror-v1",
      "inputDim": 63,
      "labels": ["A", "B", ...],          # output column order
      "layers": [
        {"W": [[...], ...], "b": [...], "activation": "relu"},
        {"W": [[...], ...], "b": [...], "activation": "softmax"}
      ]
    }

Each layer weight ``W`` has shape ``(out, in)`` so the forward pass is
``out_j = activation(sum_i W[j][i] * x[i] + b[j])``.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

from .normalization import NORMALIZATION_ID


def model_to_dict(clf: Any, labels: list[str], input_dim: int) -> dict[str, Any]:
    coefs = clf.coefs_
    intercepts = clf.intercepts_
    n_layers = len(coefs)

    layers: list[dict[str, Any]] = []
    for k in range(n_layers):
        weight = np.asarray(coefs[k], dtype=np.float64).T  # (out, in)
        bias = np.asarray(intercepts[k], dtype=np.float64)
        activation = "relu" if k < n_layers - 1 else str(clf.out_activation_)
        layers.append(
            {
                "W": weight.tolist(),
                "b": bias.tolist(),
                "activation": activation,
            }
        )

    export_labels = [labels[int(c)] for c in clf.classes_]
    return {
        "format": "mlp-1",
        "normalization": NORMALIZATION_ID,
        "inputDim": int(input_dim),
        "labels": export_labels,
        "layers": layers,
    }


def save_model_json(model: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(model, indent=2) + "\n", encoding="utf-8")
