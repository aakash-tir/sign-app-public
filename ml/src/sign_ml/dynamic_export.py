"""Export the trained dynamic-sign model to ONNX for the frontend (ADR-015).

PyTorch's built-in ``torch.onnx.export`` is used (no tensorflowjs, which has no
Windows wheels). The frontend runs the model with onnxruntime-web. The exported
folder carries a ``metadata.json`` the runtime asserts against (labels + the
frozen normalization id + window/feature shape) — the dynamic analog of the
static model's skew guard.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .dynamic_normalization import (
    DYNAMIC_NORMALIZATION_ID,
    FRAME_FEATURE_DIM,
    WINDOW_SIZE,
)

MODEL_FILENAME = "model.onnx"


def build_metadata(
    glosses: list[str],
    feature_dim: int = FRAME_FEATURE_DIM,
    features: str | None = None,
) -> dict[str, Any]:
    """Sidecar the frontend reads to validate + label the model (pure/testable).

    Output is raw **logits** (apply softmax at inference); ``window`` × ``featureDim``
    is the expected input shape after normalization. ``feature_dim``/``features``
    default to the **shipped positions-only contract** (161, no motion); a model
    trained with the P4M4 motion features (ADR-022) passes the larger dim + the
    motion feature id, which the runtime skew guard then requires.
    """
    metadata: dict[str, Any] = {
        "format": "onnx",
        "modelFile": MODEL_FILENAME,
        "normalization": DYNAMIC_NORMALIZATION_ID,
        "window": WINDOW_SIZE,
        "featureDim": feature_dim,
        "output": "logits",
        "labels": glosses,
    }
    if features is not None:
        metadata["features"] = features
    return metadata


def export_onnx(
    model: Any,
    out_dir: Path,
    glosses: list[str],
    window: int = WINDOW_SIZE,
    feat: int = FRAME_FEATURE_DIM,
    features: str | None = None,
) -> None:  # pragma: no cover - needs torch
    """Export ``model`` to ``out_dir/model.onnx`` (batch axis dynamic) + metadata."""
    import torch

    out_dir.mkdir(parents=True, exist_ok=True)
    model.eval()
    dummy = torch.zeros(1, window, feat, dtype=torch.float32)
    torch.onnx.export(
        model,
        dummy,
        str(out_dir / MODEL_FILENAME),
        input_names=["sequence"],
        output_names=["logits"],
        dynamic_axes={"sequence": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=17,
        dynamo=False,  # legacy TorchScript exporter: robust for GRU, no onnxscript dep
    )
    (out_dir / "metadata.json").write_text(
        json.dumps(build_metadata(glosses, feat, features), indent=2),
        encoding="utf-8",
    )
