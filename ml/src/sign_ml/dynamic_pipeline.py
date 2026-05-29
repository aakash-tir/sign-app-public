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
import re
from pathlib import Path
from typing import Any

import numpy as np

from .dynamic_extract import extract_dataset
from .ingest import CanonicalSample
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
MSASL_DATA_DIR = Path("data/msasl")
MODEL_ASSET = Path("models/holistic_landmarker.task")
CACHE_DIR = Path("models/starter")
COMBINED_CACHE_DIR = Path("models/combined")

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


def _sanitize(name: str) -> str:
    """Filesystem-safe token for a per-clip cache filename."""
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)


def _clip_cache_path(clips_dir: Path, sample: CanonicalSample) -> Path:
    """Per-clip landmark cache path (resumable extraction, P3M2). Keyed by source +
    clip id so re-running never re-extracts a finished clip, and MS-ASL/WLASL ids
    can't collide."""
    return clips_dir / f"{sample.source}__{_sanitize(sample.clip_id)}.npy"


def _clip_skip_path(clips_dir: Path, sample: CanonicalSample) -> Path:
    """Sentinel marking a clip that hung/crashed MediaPipe and was quarantined, so a
    resumed run skips it instead of retrying (and the assembler excludes it)."""
    return clips_dir / f"{sample.source}__{_sanitize(sample.clip_id)}.skip"


def _extract_worker(
    job_queue: Any, done_queue: Any, model_str: str, max_frames: int
) -> None:  # pragma: no cover - subprocess worker
    """Persistent worker body (spawned): pull ``(npy_path, video_path)`` jobs, extract
    + save the landmark array, ack on ``done_queue``. Module-level + picklable for the
    spawn start method (Windows). The parent recycles it periodically (so MediaPipe's
    per-clip detector threads can't accumulate into a deadlock) and kills it if a clip
    exceeds the per-clip timeout (that clip is then quarantined)."""
    from .dynamic_extract import extract_clip

    while True:
        job = job_queue.get()
        if job is None:
            return
        npy_path, video_path = job
        arr = extract_clip(Path(video_path), Path(model_str), max_frames=max_frames)
        np.save(npy_path, arr)
        done_queue.put(npy_path)


def _build_combined_samples(
    wlasl_dir: Path,
    msasl_dir: Path,
    glosses: list[str],
    seed: int,
    test_fraction: float,
    val_fraction: float,
    verbose: bool = True,
) -> list[CanonicalSample]:  # pragma: no cover - real-data path
    """Deterministic merged + signer-disjoint-split sample list for the combined
    dataset. Identical across runs for a given seed, so the resumable extractor and
    the assembler agree on order, labels and splits."""
    from .ingest import (
        DatasetAdapter,
        assign_signer_disjoint_splits,
        coverage_by_label,
        merge,
        split_counts,
    )
    from .msasl import MsaslAdapter
    from .wlasl import WlaslAdapter

    adapters: list[DatasetAdapter] = [
        WlaslAdapter(wlasl_dir, glosses),
        MsaslAdapter(msasl_dir, glosses),
    ]
    samples = merge(adapters)

    if verbose:
        print("Per-source realized coverage (downloaded clips / distinct signers):")
        for adapter in adapters:
            present = [
                s for s in adapter.samples() if s.video_path and s.video_path.exists()
            ]
            by_label = coverage_by_label(present)
            signers = len({s.signer_id for s in present if s.signer_id})
            print(f"  {adapter.name:6s} clips={len(present):4d} signers={signers}")
            for gloss in sorted(glosses):
                print(f"      {gloss:12s} {by_label.get(gloss, 0):3d}")

    samples = assign_signer_disjoint_splits(
        samples, test_fraction=test_fraction, val_fraction=val_fraction, seed=seed
    )
    if verbose:
        n_signers = len({s.signer_id for s in samples if s.signer_id})
        print(
            f"\nMerged {len(samples)} samples / {len(glosses)} glosses / "
            f"{n_signers} signers; signer-disjoint split {split_counts(samples)}"
        )
    return samples


def run_extract_combined(
    wlasl_dir: Path,
    msasl_dir: Path,
    model_asset: Path,
    cache_dir: Path,
    max_frames: int,
    glosses: list[str],
    seed: int = 0,
    test_fraction: float = 0.2,
    val_fraction: float = 0.15,
    clip_timeout: float = 90.0,
    recycle_every: int = 150,
) -> None:  # pragma: no cover - real-data path
    """Resumable, hang-proof landmark extraction for the combined dataset.

    Extraction runs in a **persistent worker subprocess**, one clip at a time, with
    the parent enforcing a per-clip ``clip_timeout``. Two MediaPipe failure modes are
    handled: (1) a clip that hangs ``detect()`` forever is killed and **quarantined**
    (a ``.skip`` sentinel, excluded from training) so it's never retried; (2) native
    detector threads that accumulate across many clips and eventually deadlock are
    avoided by **recycling** the worker every ``recycle_every`` clips. Per-clip
    ``.npy`` caches make it fully resumable — rerun to continue; finished and
    quarantined clips are skipped. Prints ``REMAINING=<n>`` (0 when complete)."""
    import multiprocessing as mp
    import queue as queue_mod
    import time

    samples = _build_combined_samples(
        wlasl_dir, msasl_dir, glosses, seed, test_fraction, val_fraction
    )
    clips_dir = cache_dir / "clips"
    clips_dir.mkdir(parents=True, exist_ok=True)

    def is_done(s: CanonicalSample) -> bool:
        return (
            _clip_cache_path(clips_dir, s).exists()
            or _clip_skip_path(clips_dir, s).exists()
        )

    on_disk = [s for s in samples if s.video_path and s.video_path.exists()]
    todo = [s for s in on_disk if not is_done(s)]
    print(
        f"\nExtraction: {len(on_disk) - len(todo)}/{len(on_disk)} clips done, "
        f"{len(todo)} to extract (per-clip timeout {clip_timeout:.0f}s, "
        f"recycle every {recycle_every})"
    )

    ctx = mp.get_context("spawn")

    def start_worker() -> tuple[Any, Any, Any]:
        job_q: Any = ctx.Queue()
        done_q: Any = ctx.Queue()
        proc = ctx.Process(
            target=_extract_worker,
            args=(job_q, done_q, str(model_asset), max_frames),
            daemon=True,
        )
        proc.start()
        return proc, job_q, done_q

    def stop_worker(proc: Any) -> None:
        if proc.is_alive():
            proc.terminate()
        proc.join(timeout=10)

    worker, job_q, done_q = start_worker()
    in_worker = 0
    extracted = 0
    quarantined = 0

    for i, sample in enumerate(todo, start=1):
        if in_worker >= recycle_every:
            job_q.put(None)
            stop_worker(worker)
            worker, job_q, done_q = start_worker()
            in_worker = 0

        assert sample.video_path is not None
        job_q.put((str(_clip_cache_path(clips_dir, sample)), str(sample.video_path)))

        deadline = time.time() + clip_timeout
        ok = False
        while time.time() < deadline:
            try:
                done_q.get(timeout=2.0)
                ok = True
                break
            except queue_mod.Empty:
                if not worker.is_alive():  # crashed on this clip
                    break

        if ok:
            extracted += 1
            in_worker += 1
        else:
            crashed = not worker.is_alive()
            stop_worker(worker)
            _clip_skip_path(clips_dir, sample).write_text(
                "quarantined\n", encoding="utf-8"
            )
            quarantined += 1
            print(
                f"  QUARANTINE ({'crash' if crashed else 'hang'}): "
                f"{sample.source}:{sample.clip_id} ({sample.label})",
                flush=True,
            )
            worker, job_q, done_q = start_worker()
            in_worker = 0

        if i % 25 == 0 or i == len(todo):
            print(
                f"  [{i}/{len(todo)}] extracted={extracted} quarantined={quarantined}",
                flush=True,
            )

    job_q.put(None)
    stop_worker(worker)
    remaining = sum(1 for s in on_disk if not is_done(s))
    print(f"REMAINING={remaining} quarantined={quarantined}", flush=True)


def run_assemble_combined(
    wlasl_dir: Path,
    msasl_dir: Path,
    cache_dir: Path,
    glosses: list[str],
    seed: int = 0,
    test_fraction: float = 0.2,
    val_fraction: float = 0.15,
) -> None:  # pragma: no cover - real-data path
    """Assemble the per-clip caches written by :func:`run_extract_combined` into the
    ``X/y/splits/signers`` arrays + ``glosses.json`` the trainer and gate read."""
    samples = _build_combined_samples(
        wlasl_dir, msasl_dir, glosses, seed, test_fraction, val_fraction, verbose=False
    )
    clips_dir = cache_dir / "clips"
    vocab = sorted({s.label for s in samples})
    gloss_to_index = {g: i for i, g in enumerate(vocab)}

    features: list[Any] = []
    targets: list[int] = []
    splits: list[str] = []
    signers: list[str] = []
    missing = 0
    for sample in samples:
        path = _clip_cache_path(clips_dir, sample)
        if not path.exists():
            missing += 1
            continue
        features.append(np.load(path))
        targets.append(gloss_to_index[sample.label])
        splits.append(sample.split)
        signers.append(sample.signer_id or "")

    x = np.asarray(features, dtype=np.float64)
    y = np.asarray(targets, dtype=np.int64)
    s = np.asarray(splits, dtype=np.str_)
    sig = np.asarray(signers, dtype=np.str_)

    cache_dir.mkdir(parents=True, exist_ok=True)
    np.save(cache_dir / "X.npy", x)
    np.save(cache_dir / "y.npy", y)
    np.save(cache_dir / "splits.npy", s)
    np.save(cache_dir / "signers.npy", sig)
    (cache_dir / "glosses.json").write_text(json.dumps(vocab), encoding="utf-8")
    n_signers = len({v for v in sig.tolist() if v})
    print(
        f"Assembled cache -> {cache_dir}  X={x.shape} y={y.shape} signers={n_signers}"
    )
    print(f"  ({missing} samples had no clip cache — not downloaded)")
    for split in ("train", "val", "test"):
        print(f"  {split}: {int((s == split).sum())} samples")


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

    exc = sub.add_parser(
        "extract-combined",
        help="extract WLASL u MS-ASL (signer-disjoint splits) -> combined cache",
    )
    exc.add_argument("--wlasl", type=Path, default=DATA_DIR)
    exc.add_argument("--msasl", type=Path, default=MSASL_DATA_DIR)
    exc.add_argument("--model", type=Path, default=MODEL_ASSET)
    exc.add_argument("--out", type=Path, default=COMBINED_CACHE_DIR)
    exc.add_argument("--max-frames", type=int, default=64)
    exc.add_argument("--vocab", choices=sorted(VOCABS), default="expanded")
    exc.add_argument("--seed", type=int, default=0)
    exc.add_argument(
        "--clip-timeout",
        type=float,
        default=90.0,
        help="seconds before a clip is considered hung -> killed + quarantined",
    )
    exc.add_argument(
        "--recycle-every",
        type=int,
        default=150,
        help="respawn the extraction worker every N clips (avoids MediaPipe thread "
        "accumulation that deadlocks long single-process runs)",
    )

    asm = sub.add_parser(
        "assemble-combined",
        help="assemble per-clip caches from extract-combined -> X/y/splits/signers",
    )
    asm.add_argument("--wlasl", type=Path, default=DATA_DIR)
    asm.add_argument("--msasl", type=Path, default=MSASL_DATA_DIR)
    asm.add_argument("--out", type=Path, default=COMBINED_CACHE_DIR)
    asm.add_argument("--vocab", choices=sorted(VOCABS), default="expanded")
    asm.add_argument("--seed", type=int, default=0)

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
    elif args.stage == "extract-combined":
        run_extract_combined(
            args.wlasl,
            args.msasl,
            args.model,
            args.out,
            args.max_frames,
            glosses=list(VOCABS[args.vocab]),
            seed=args.seed,
            clip_timeout=args.clip_timeout,
            recycle_every=args.recycle_every,
        )
    elif args.stage == "assemble-combined":
        run_assemble_combined(
            args.wlasl,
            args.msasl,
            args.out,
            glosses=list(VOCABS[args.vocab]),
            seed=args.seed,
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
