"""Export every fold model to ONNX (fp32, fp16, int8) and score each on its own
held-out fold with onnxruntime (issue #64, candidate C).

No retraining: the int8/fp16 rows reuse the exact fp32 fold weights, so any metric
difference is the quantisation alone. Writes
ml/experiments/runs/<candidate>/seed<s>/onnx/fold<f>.{fp32,fp16w,int8w,int8dyn}.onnx and
ml/experiments/runs/<candidate>/quant.json.

    uv run --project ml --extra train --with onnxruntime --with onnxconverter-common \
        python ml/experiments/bakeoff/quantize.py --candidate baseline
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
from common import CANDIDATES, RUNS, SEEDS, fold_metrics, load_dynamic


def export(model: Any, path: Path, feat: int) -> None:
    import torch

    model.eval()
    torch.onnx.export(
        model,
        torch.zeros(1, 30, feat, dtype=torch.float32),
        str(path),
        input_names=["sequence"],
        output_names=["logits"],
        dynamic_axes={"sequence": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=17,
        dynamo=False,  # same exporter settings as sign_ml.dynamic_export
    )


def _weight_only(src: Path, dst: Path, mode: str) -> str | None:
    """Weight-only compression: store each float initializer (≥ 64 elements) as
    fp16 (``Cast`` → fp32 at load) or as per-channel symmetric int8
    (``DequantizeLinear`` → fp32). Compute stays fp32, so it works for every op
    (GRU included) on every runtime; the win is download size. Channel axis is the
    output-channel axis: 1 for GRU W/R (dirs, 3H, in), else 0."""
    import onnx
    from onnx import TensorProto, helper, numpy_helper

    try:
        model = onnx.load(str(src))
        g = model.graph
        gru_inputs = {i for n in g.node if n.op_type == "GRU" for i in n.input[1:3]}
        new_nodes, keep = [], []
        for init in g.initializer:
            w = numpy_helper.to_array(init)
            if w.dtype != np.float32 or w.size < 64:
                keep.append(init)
                continue
            name = init.name
            if mode == "fp16":
                keep.append(
                    numpy_helper.from_array(w.astype(np.float16), name + "_fp16")
                )
                new_nodes.append(
                    helper.make_node(
                        "Cast", [name + "_fp16"], [name], to=TensorProto.FLOAT
                    )
                )
            else:
                axis = 1 if name in gru_inputs else 0
                red = tuple(a for a in range(w.ndim) if a != axis)
                amax = np.max(np.abs(w), axis=red) if w.ndim > 1 else np.max(np.abs(w))
                scale = np.maximum(np.asarray(amax, dtype=np.float32) / 127.0, 1e-12)
                shape = [1] * w.ndim
                if w.ndim > 1:
                    shape[axis] = -1
                q = np.clip(np.round(w / scale.reshape(shape)), -127, 127).astype(
                    np.int8
                )
                keep.append(numpy_helper.from_array(q, name + "_q"))
                keep.append(
                    numpy_helper.from_array(scale.astype(np.float32), name + "_s")
                )
                attrs = {"axis": axis} if w.ndim > 1 else {}
                new_nodes.append(
                    helper.make_node(
                        "DequantizeLinear", [name + "_q", name + "_s"], [name], **attrs
                    )
                )
        del g.initializer[:]
        g.initializer.extend(keep)
        nodes = new_nodes + list(g.node)
        del g.node[:]
        g.node.extend(nodes)
        onnx.checker.check_model(model)
        onnx.save(model, str(dst))
        return None
    except Exception as e:  # report, don't hide
        return f"{type(e).__name__}: {e}"


def make_fp16(src: Path, dst: Path) -> str | None:
    return _weight_only(src, dst, "fp16")


def make_int8w(src: Path, dst: Path) -> str | None:
    return _weight_only(src, dst, "int8")


def make_int8(src: Path, dst: Path) -> str | None:
    from onnxruntime.quantization import QuantType, quantize_dynamic

    try:
        quantize_dynamic(str(src), str(dst), weight_type=QuantType.QInt8)
        return None
    except Exception as e:
        return f"{type(e).__name__}: {e}"


def run(path: Path, x: np.ndarray) -> np.ndarray:
    import onnxruntime as ort

    sess = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    out: np.ndarray = sess.run(None, {"sequence": x.astype(np.float32)})[0]
    return out


VARIANTS = ("fp32", "fp16w", "int8w", "int8dyn")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--candidate", choices=sorted(CANDIDATES), required=True)
    args = ap.parse_args()

    import torch

    torch.set_num_threads(4)
    x, y, glosses, fold_id = load_dynamic()
    factory, transform, feat = CANDIDATES[args.candidate]
    n = len(glosses)
    result: dict[str, Any] = {"candidate": args.candidate, "variants": {}}
    errors: dict[str, str] = {}
    per: dict[str, list[dict[str, Any]]] = {v: [] for v in VARIANTS}
    sizes: dict[str, list[int]] = {v: [] for v in VARIANTS}
    agree: dict[str, list[float]] = {v: [] for v in VARIANTS if v != "fp32"}

    for seed in SEEDS:
        sdir = RUNS / args.candidate / f"seed{seed}"
        odir = sdir / "onnx"
        odir.mkdir(exist_ok=True)
        for f in range(int(fold_id.max()) + 1):
            model = factory(n, feat, 0)
            model.load_state_dict(torch.load(sdir / f"fold{f}.pt"))
            paths = {v: odir / f"fold{f}.{v}.onnx" for v in per}
            export(model, paths["fp32"], feat)
            for v, fn in (
                ("fp16w", make_fp16),
                ("int8w", make_int8w),
                ("int8dyn", make_int8),
            ):
                err = fn(paths["fp32"], paths[v])
                if err:
                    errors[v] = err
            test = fold_id == f
            xt = transform(x[test]) if transform is not None else x[test]
            ref = run(paths["fp32"], xt)
            # Sanity: ONNX fp32 must reproduce the held-out logits from training.
            held = np.load(sdir / "heldout_logits.npy")[test]
            assert np.abs(ref - held).max() < 1e-3, "fp32 ONNX diverges from torch"
            for v, p in paths.items():
                if not p.exists() or (v != "fp32" and v in errors):
                    continue
                try:
                    logits = ref if v == "fp32" else run(p, xt)
                except Exception as e:
                    errors[v] = f"runtime {type(e).__name__}: {e}"
                    continue
                m = fold_metrics(y[test], logits.astype(np.float64), n)
                m.update({"seed": seed, "fold": f})
                per[v].append(m)
                sizes[v].append(p.stat().st_size)
                if v != "fp32":
                    agree[v].append(float(np.mean(logits.argmax(1) == ref.argmax(1))))
            print(
                f"{args.candidate} seed {seed} fold {f}: "
                + ", ".join(
                    f"{v} {per[v][-1]['top1']:.3f}"
                    for v in per
                    if per[v] and per[v][-1]["fold"] == f and per[v][-1]["seed"] == seed
                ),
                flush=True,
            )

    for v in per:
        result["variants"][v] = {
            "folds": per[v],
            "size_bytes_mean": float(np.mean(sizes[v])) if sizes[v] else None,
            "top1_agreement_with_fp32": float(np.mean(agree[v]))
            if agree.get(v)
            else None,
        }
    result["errors"] = errors
    (RUNS / args.candidate / "quant.json").write_text(json.dumps(result, indent=2))
    print("errors:", errors or "none")


if __name__ == "__main__":
    main()
