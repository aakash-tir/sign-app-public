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


def quantize_weights_int8(src: Path, dst: Path, min_size: int = 64) -> None:
    """Weight-only int8: store each fp32 initializer with ≥ ``min_size`` elements as
    per-channel symmetric int8 + an fp32 scale, dequantized to fp32 at load by a
    ``DequantizeLinear`` node. Compute stays fp32, so every op (GRU and Conv alike)
    runs unchanged on every runtime; the win is download size (~4×). The channel
    axis is the output-channel axis: 1 for GRU ``W``/``R`` (dirs, 3H, in), else 0.

    Chosen over onnxruntime's ``quantize_dynamic`` in the #64 bake-off: that leaves
    GRU weights fp32 and made the TCN ~4× slower in WASM; this kept top-1 within
    0.001 of fp32 on every fold."""
    import numpy as np
    import onnx
    from onnx import helper, numpy_helper

    model = onnx.load(str(src))
    graph = model.graph
    gru_weights = {i for n in graph.node if n.op_type == "GRU" for i in n.input[1:3]}
    keep: list[Any] = []
    dequant: list[Any] = []
    for init in graph.initializer:
        w = numpy_helper.to_array(init)
        if w.dtype != np.float32 or w.size < min_size:
            keep.append(init)
            continue
        name = init.name
        axis = 1 if name in gru_weights else 0
        if w.ndim > 1:
            reduce = tuple(a for a in range(w.ndim) if a != axis)
            amax = np.max(np.abs(w), axis=reduce)
            shape = [1] * w.ndim
            shape[axis] = -1
        else:
            amax = np.asarray(np.max(np.abs(w)))
            shape = []
        scale = np.maximum(amax.astype(np.float32) / 127.0, np.float32(1e-12))
        q = np.clip(np.round(w / scale.reshape(shape)), -127, 127).astype(np.int8)
        keep.append(numpy_helper.from_array(q, name + "_q"))
        keep.append(numpy_helper.from_array(scale.astype(np.float32), name + "_s"))
        node = helper.make_node("DequantizeLinear", [name + "_q", name + "_s"], [name])
        if w.ndim > 1:  # per-channel; a scalar scale needs no axis
            node.attribute.append(helper.make_attribute("axis", axis))
        dequant.append(node)
    del graph.initializer[:]
    graph.initializer.extend(keep)
    nodes = dequant + list(graph.node)
    del graph.node[:]
    graph.node.extend(nodes)
    onnx.checker.check_model(model)
    onnx.save(model, str(dst))


def export_onnx(
    model: Any,
    out_dir: Path,
    glosses: list[str],
    window: int = WINDOW_SIZE,
    feat: int = FRAME_FEATURE_DIM,
    features: str | None = None,
    int8: bool = False,
) -> None:  # pragma: no cover - needs torch
    """Export ``model`` to ``out_dir/model.onnx`` (batch axis dynamic) + metadata.
    ``int8`` stores the weights as per-channel int8 (:func:`quantize_weights_int8`)."""
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
    if int8:
        path = out_dir / MODEL_FILENAME
        quantize_weights_int8(path, path)
    (out_dir / "metadata.json").write_text(
        json.dumps(build_metadata(glosses, feat, features), indent=2),
        encoding="utf-8",
    )
