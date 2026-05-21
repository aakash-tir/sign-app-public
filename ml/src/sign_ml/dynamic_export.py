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


def build_metadata(glosses: list[str]) -> dict[str, Any]:
    """Sidecar the frontend reads to validate + label the model (pure/testable).

    Output is raw **logits** (apply softmax at inference); ``window`` × ``featureDim``
    is the expected input shape after the frozen normalization.
    """
    return {
        "format": "onnx",
        "modelFile": MODEL_FILENAME,
        "normalization": DYNAMIC_NORMALIZATION_ID,
        "window": WINDOW_SIZE,
        "featureDim": FRAME_FEATURE_DIM,
        "output": "logits",
        "labels": glosses,
    }


def export_onnx(
    model: Any,
    out_dir: Path,
    glosses: list[str],
    window: int = WINDOW_SIZE,
    feat: int = FRAME_FEATURE_DIM,
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
        json.dumps(build_metadata(glosses), indent=2), encoding="utf-8"
    )
