"""Build ml/experiments/runs/bench/manifest.json for the browser latency bench (#64).

Includes the shipped models (read-only references, copied) plus, when present, the
seed-42 fold-0 ONNX of every candidate × variant and the letters fold-0 JSON. Real
held-out windows are used as inputs; a parity sample checks the JS hand-shape port.
"""

from __future__ import annotations

import json
import shutil

import numpy as np
from common import CANDIDATES, REPO, RUNS, add_hand_shape, load_dynamic

OUT = RUNS / "bench"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    x, _y, _g, fold_id = load_dynamic()
    test = np.where(fold_id == 0)[0]
    rng = np.random.default_rng(0)
    pick = rng.choice(test, size=20, replace=False)
    windows = [x[i].astype(np.float32).ravel().tolist() for i in pick]
    # Parity sample: a window with both hands present in most frames, if any.
    both = [i for i in pick if (x[i][:, -2:] > 0).all(axis=1).mean() > 0.5] or list(
        pick
    )
    raw = x[both[0]][None]
    parity = {
        "raw": raw.astype(np.float32).ravel().tolist(),
        "expected": add_hand_shape(raw).astype(np.float32).ravel().tolist(),
    }

    shipped_onnx = OUT / "shipped_model.onnx"
    shipped_mlp = OUT / "shipped_fingerspelling.json"
    shutil.copyfile(REPO / "frontend/public/models/dynamic/model.onnx", shipped_onnx)
    shutil.copyfile(
        REPO / "frontend/src/recognition/models/fingerspelling.json", shipped_mlp
    )

    onnx = [{"name": "shipped/fp32", "file": shipped_onnx.name, "feat": 161}]
    for cand, (_f, transform, feat) in CANDIDATES.items():
        odir = RUNS / cand / "seed42" / "onnx"
        for v in ("fp32", "fp16w", "int8w", "int8dyn"):
            p = odir / f"fold0.{v}.onnx"
            if p.exists():
                onnx.append(
                    {
                        "name": f"{cand}/{v}",
                        "file": str(p.relative_to(OUT, walk_up=True)),
                        "feat": feat,
                        "handshape": transform is not None,
                    }
                )
    mlp = [{"name": "letters/shipped", "file": shipped_mlp.name}]
    fold0 = RUNS / "letters" / "fold0_model.json"
    if fold0.exists():
        mlp.append(
            {
                "name": "letters/cv-fold0",
                "file": str(fold0.relative_to(OUT, walk_up=True)),
            }
        )

    manifest = {"onnx": onnx, "mlp": mlp, "windows": windows, "parity": parity}
    (OUT / "manifest.json").write_text(json.dumps(manifest))
    print(f"{len(onnx)} onnx + {len(mlp)} mlp models")


if __name__ == "__main__":
    main()
