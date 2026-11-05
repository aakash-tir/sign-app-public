"""Run one (candidate, seed) signer-disjoint CV on the frozen folds (issue #64).

    uv run --project ml --extra train python ml/experiments/bakeoff/run_cv.py \
        --candidate baseline --seed 42 --threads 4

Writes ml/experiments/runs/<candidate>/seed<seed>/{fold*.pt, heldout_logits.npy,
summary.json, log.txt}. Never touches frontend/ or ml/models/.
"""

from __future__ import annotations

import argparse
import json
import time

from common import CANDIDATES, RECIPE, RUNS, cross_validate_frozen, load_dynamic


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--candidate", choices=sorted(CANDIDATES), required=True)
    ap.add_argument("--seed", type=int, required=True)
    ap.add_argument("--threads", type=int, default=4)
    args = ap.parse_args()

    import torch

    torch.set_num_threads(args.threads)
    x, y, glosses, fold_id = load_dynamic()
    factory, transform, feat = CANDIDATES[args.candidate]
    out_dir = RUNS / args.candidate / f"seed{args.seed}"
    out_dir.mkdir(parents=True, exist_ok=True)
    log_path = out_dir / "log.txt"
    log_f = log_path.open("a", encoding="utf-8")

    def log(msg: str) -> None:
        print(msg, flush=True)
        log_f.write(msg + "\n")
        log_f.flush()

    n_params = sum(p.numel() for p in factory(len(glosses), feat, 0).parameters())
    log(f"{args.candidate} seed={args.seed} feat={feat} params={n_params}")
    t0 = time.time()
    report = cross_validate_frozen(
        x, y, len(glosses), fold_id, args.seed, factory, transform, feat, out_dir, log
    )
    report.update(
        {
            "candidate": args.candidate,
            "seed": args.seed,
            "feat": feat,
            "params": n_params,
            "recipe": RECIPE,
            "minutes": round((time.time() - t0) / 60, 1),
            "threads": args.threads,
        }
    )
    (out_dir / "summary.json").write_text(json.dumps(report, indent=2))
    log(f"done in {report['minutes']} min")


if __name__ == "__main__":
    main()
