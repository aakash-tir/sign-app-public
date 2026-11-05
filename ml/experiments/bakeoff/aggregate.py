"""Aggregate every run into ml/experiments/results.json (issue #64).
Pure read of ml/experiments/runs/ — no training.

Pre-registered decision rule (written before any candidate result existed):
a candidate **beats** the baseline only if, over the 15 paired (seed, fold) runs on
identical folds, the mean top-1 difference is > +0.01 **and** its 95% t-interval
excludes 0. Otherwise it's reported as "no better" (or "worse" if the interval is
entirely below 0). Selection of the "best candidate" uses the mean over all folds and
seeds — never a single fold.
"""

from __future__ import annotations

import json
import math
from typing import Any

import numpy as np
from common import CACHE, EXP, RUNS, SEEDS, load_dynamic, top_confused_pairs

METRICS = ("top1", "top5", "macro_f1")
CANDS = ("baseline", "tcn", "handshape")
T975_14 = 2.145  # two-sided 95% t critical value, 14 dof (15 paired runs)


def load_runs(cand: str) -> list[dict[str, Any]]:
    out = []
    for s in SEEDS:
        p = RUNS / cand / f"seed{s}" / "summary.json"
        if p.exists():
            out.append(json.loads(p.read_text()))
    return out


def summarize(runs: list[dict[str, Any]]) -> dict[str, Any]:
    """mean ± std across all (seed, fold) runs, plus the std of the per-seed means
    (seed-to-seed noise) and the mean per-seed fold std (fold-to-fold spread)."""
    res: dict[str, Any] = {
        "n_runs": sum(len(r["folds"]) for r in runs),
        "seeds": len(runs),
    }
    for m in METRICS:
        allv = np.array([f[m] for r in runs for f in r["folds"]])
        seed_means = np.array([np.mean([f[m] for f in r["folds"]]) for r in runs])
        fold_stds = np.array([np.std([f[m] for f in r["folds"]], ddof=1) for r in runs])
        res[m] = {
            "mean": float(allv.mean()),
            "fold_std": float(fold_stds.mean()),
            "seed_std": float(seed_means.std(ddof=1)) if len(runs) > 1 else None,
            "per_seed": seed_means.round(4).tolist(),
        }
    return res


def paired(base: list[dict[str, Any]], cand: list[dict[str, Any]]) -> dict[str, Any]:
    b = {(r["seed"], f["fold"]): f for r in base for f in r["folds"]}
    c = {(r["seed"], f["fold"]): f for r in cand for f in r["folds"]}
    keys = sorted(set(b) & set(c))
    out: dict[str, Any] = {"n_pairs": len(keys)}
    for m in METRICS:
        d = np.array([c[k][m] - b[k][m] for k in keys])
        half = (
            T975_14 * d.std(ddof=1) / math.sqrt(len(d)) if len(d) > 1 else float("nan")
        )
        out[m] = {
            "delta": float(d.mean()),
            "ci95": [float(d.mean() - half), float(d.mean() + half)],
            "wins": int((d > 0).sum()),
        }
    d1 = out["top1"]
    if d1["delta"] > 0.01 and d1["ci95"][0] > 0:
        verdict = "beats baseline"
    elif d1["ci95"][1] < 0:
        verdict = "worse than baseline"
    else:
        verdict = "no better (within noise)"
    out["verdict"] = verdict
    return out


def confused(cand: str, y: np.ndarray, glosses: list[str]) -> list[dict[str, Any]]:
    """Top-10 confused pairs, counts averaged over the 3 seeds (each seed predicts
    every clip exactly once)."""
    totals: dict[tuple[str, str], list[float]] = {}
    sizes: dict[tuple[str, str], int] = {}
    for s in SEEDS:
        p = RUNS / cand / f"seed{s}" / "heldout_logits.npy"
        if not p.exists():
            continue
        pred = np.load(p).argmax(axis=1)
        for a, b, c, n in top_confused_pairs(y, pred, glosses, k=10_000):
            totals.setdefault((a, b), []).append(c)
            sizes[(a, b)] = n
    nseeds = sum(
        (RUNS / cand / f"seed{s}" / "heldout_logits.npy").exists() for s in SEEDS
    )
    ranked = sorted(totals.items(), key=lambda kv: (-sum(kv[1]), kv[0]))[:10]
    return [
        {
            "a": a,
            "b": b,
            "per_seed_avg": round(sum(v) / nseeds, 1),
            "clips_in_pair": sizes[(a, b)],
        }
        for (a, b), v in ranked
    ]


def letters() -> dict[str, Any] | None:
    runs = []
    for s in SEEDS:
        p = RUNS / "letters" / f"seed{s}.json"
        if p.exists():
            runs.append(json.loads(p.read_text()))
    if not runs:
        return None
    res = summarize(runs)
    res["confused"] = runs[0]["confused"]
    res["n_samples"] = sum(f["n"] for f in runs[0]["folds"])
    return res


def main() -> None:
    _x, y, glosses, _fid = load_dynamic()
    results: dict[str, Any] = {"candidates": {}, "paired_vs_baseline": {}}
    runs = {c: load_runs(c) for c in CANDS}
    for c in CANDS:
        if not runs[c]:
            continue
        info = summarize(runs[c])
        info["params"] = runs[c][0]["params"]
        info["minutes_per_run"] = float(np.mean([r["minutes"] for r in runs[c]]))
        info["confused"] = confused(c, y, glosses)
        q = RUNS / c / "quant.json"
        if q.exists():
            qd = json.loads(q.read_text())
            info["quant"] = {
                v: {
                    "size_kb": d["size_bytes_mean"] / 1024
                    if d["size_bytes_mean"]
                    else None,
                    "agreement": d["top1_agreement_with_fp32"],
                    **(
                        {m: float(np.mean([f[m] for f in d["folds"]])) for m in METRICS}
                        if d["folds"]
                        else {}
                    ),
                }
                for v, d in qd["variants"].items()
            }
            info["quant_errors"] = qd["errors"]
        results["candidates"][c] = info
        if c != "baseline" and runs["baseline"]:
            results["paired_vs_baseline"][c] = paired(runs["baseline"], runs[c])

    # Harness fidelity: seed-42 baseline vs the recorded shipped CV (same folds/seed).
    recorded = json.loads((CACHE / "cv_metrics.json").read_text())
    b42 = RUNS / "baseline" / "seed42" / "heldout_logits.npy"
    if b42.exists():
        pooled = float(np.mean(np.load(b42).argmax(axis=1) == y))
        results["fidelity"] = {
            "recorded_cv_top1": recorded["cv_top1"],
            "recorded_cv_top5": recorded["cv_top5"],
            "harness_seed42_top1": pooled,
        }

    lat = RUNS / "bench" / "latency.json"
    if lat.exists():
        results["latency"] = json.loads(lat.read_text())
    results["letters"] = letters()
    (EXP / "results.json").write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2)[:6000])


if __name__ == "__main__":
    main()
