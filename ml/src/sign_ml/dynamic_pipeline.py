"""CLI: build the curated-starter dynamic-sign model end to end.

Two cached, independently re-runnable stages:

  extract  WLASL clips -> models/starter/{X,y,splits}.npy + glosses.json
           (needs `uv sync --extra video` + models/holistic_landmarker.task)
  train    cache -> models/starter/tfjs/ + metrics.json
           (needs `uv sync --extra train`)

  uv run python -m sign_ml.dynamic_pipeline extract
  uv run python -m sign_ml.dynamic_pipeline train
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from .dynamic_extract import extract_dataset
from .wlasl import (
    CURATED_STARTER_GLOSSES,
    EXPANDED_GLOSSES,
    available_video_ids,
    coverage_for,
    load_wlasl_index,
    select_clips,
)

VOCABS = {"starter": CURATED_STARTER_GLOSSES, "expanded": EXPANDED_GLOSSES}

DATA_DIR = Path("data/wlasl")
MODEL_ASSET = Path("models/holistic_landmarker.task")
CACHE_DIR = Path("models/starter")

# P3M3 landmark-space augmentation preset (off in plain training; opt-in via
# `crossval --aug`). Tuned/accepted on the honest signer-disjoint gate once more
# data lands (ADR-020).
P3M3_AUG = {"landmark_dropout": 0.1, "rotation_deg": 12.0, "time_warp_rate": 0.2}


def run_extract(
    data_dir: Path,
    model_asset: Path,
    cache_dir: Path,
    max_frames: int,
    glosses: list[str] | None = None,
) -> None:  # pragma: no cover - real-data path
    clips = load_wlasl_index(data_dir / "WLASL_v0.3.json")
    available = available_video_ids(data_dir / "videos")
    glosses = glosses if glosses is not None else list(CURATED_STARTER_GLOSSES)

    print("Per-gloss local coverage:")
    for cov in coverage_for(glosses, clips, available):
        print(f"  {cov.gloss:12s} {cov.available:3d}/{cov.total:3d}")

    selected = select_clips(glosses, clips, available)
    print(f"\nExtracting {len(selected)} clips for {len(glosses)} glosses...")
    x, y, splits, signers, vocab = extract_dataset(
        selected, data_dir / "videos", model_asset, max_frames=max_frames
    )

    cache_dir.mkdir(parents=True, exist_ok=True)
    np.save(cache_dir / "X.npy", x)
    np.save(cache_dir / "y.npy", y)
    np.save(cache_dir / "splits.npy", splits)
    np.save(cache_dir / "signers.npy", signers)
    (cache_dir / "glosses.json").write_text(json.dumps(vocab), encoding="utf-8")
    n_signers = len({s for s in signers.tolist() if s})
    print(f"\nSaved cache -> {cache_dir}  X={x.shape} y={y.shape} signers={n_signers}")
    for split in ("train", "val", "test"):
        print(f"  {split}: {int((splits == split).sum())} samples")


def run_train(cache_dir: Path, seed: int) -> None:  # pragma: no cover - heavy path
    from .dynamic_export import export_onnx
    from .dynamic_model import train_and_eval

    x = np.load(cache_dir / "X.npy")
    y = np.load(cache_dir / "y.npy")
    splits = np.load(cache_dir / "splits.npy")
    glosses: list[str] = json.loads((cache_dir / "glosses.json").read_text())

    model, metrics = train_and_eval(x, y, splits, n_classes=len(glosses), seed=seed)
    metrics["glosses"] = glosses
    metrics["num_samples"] = int(x.shape[0])

    out_dir = cache_dir / "onnx"
    export_onnx(model, out_dir, glosses, x.shape[1], x.shape[2])
    (cache_dir / "metrics.json").write_text(
        json.dumps(metrics, indent=2), encoding="utf-8"
    )
    print(json.dumps({k: v for k, v in metrics.items() if k != "glosses"}, indent=2))
    print(f"Exported ONNX model -> {out_dir}")


def run_crossval(
    cache_dir: Path,
    seed: int,
    folds: int,
    stratified: bool = False,
    aug: dict[str, float] | None = None,
) -> None:  # pragma: no cover - heavy path
    from .dynamic_model import cross_validate

    x = np.load(cache_dir / "X.npy")
    y = np.load(cache_dir / "y.npy")
    glosses: list[str] = json.loads((cache_dir / "glosses.json").read_text())

    # Signer-disjoint is the honest gate (ADR-019); use it whenever the cache has
    # signer ids, unless --stratified is passed for a side-by-side comparison.
    signers_path = cache_dir / "signers.npy"
    signer_ids: list[str] | None = None
    if signers_path.exists() and not stratified:
        signer_ids = [str(s) for s in np.load(signers_path).tolist()]
    elif not stratified:
        print(
            "WARN: no signers.npy — falling back to stratified CV (re-extract to gate)"
        )

    report = cross_validate(
        x, y, glosses, folds=folds, seed=seed, signer_ids=signer_ids, aug=aug
    )
    (cache_dir / "cv_metrics.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    print(
        f"CV [{report['fold_kind']}] "
        f"top-1 {report['cv_top1']:.3f} | top-5 {report['cv_top5']:.3f} "
        f"({report['folds']}-fold, n={report['n_samples']})"
    )
    ranked = sorted(report["per_gloss"].items(), key=lambda kv: kv[1]["top1"])
    for gloss, metric in ranked:
        print(f"  {gloss:12s} top1={metric['top1']:.2f} (n={metric['n']})")


def main() -> None:  # pragma: no cover - CLI
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="stage", required=True)

    ex = sub.add_parser("extract", help="extract landmark sequences -> cache")
    ex.add_argument("--data", type=Path, default=DATA_DIR)
    ex.add_argument("--model", type=Path, default=MODEL_ASSET)
    ex.add_argument("--out", type=Path, default=CACHE_DIR)
    ex.add_argument("--max-frames", type=int, default=64)
    ex.add_argument("--vocab", choices=sorted(VOCABS), default="starter")

    tr = sub.add_parser("train", help="train + eval + export ONNX from cache")
    tr.add_argument("--cache", type=Path, default=CACHE_DIR)
    tr.add_argument("--seed", type=int, default=42)

    cv = sub.add_parser(
        "crossval", help="signer-disjoint k-fold CV (the honest ship gate, ADR-019)"
    )
    cv.add_argument("--cache", type=Path, default=CACHE_DIR)
    cv.add_argument("--seed", type=int, default=42)
    cv.add_argument("--folds", type=int, default=5)
    cv.add_argument(
        "--stratified",
        action="store_true",
        help="force stratified-clip folds (comparison only; overstates accuracy)",
    )
    cv.add_argument(
        "--aug",
        action="store_true",
        help="enable the P3M3 landmark-space augmentation preset (rotation, "
        "landmark dropout, time-warp) on top of the baseline jitter",
    )

    args = parser.parse_args()
    if args.stage == "extract":
        run_extract(
            args.data,
            args.model,
            args.out,
            args.max_frames,
            glosses=list(VOCABS[args.vocab]),
        )
    elif args.stage == "crossval":
        run_crossval(
            args.cache,
            args.seed,
            args.folds,
            stratified=args.stratified,
            aug=P3M3_AUG if args.aug else None,
        )
    else:
        run_train(args.cache, args.seed)


if __name__ == "__main__":
    main()
