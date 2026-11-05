"""Freeze the dynamic-sign CV folds (issue #64).

Uses the shipped ``signer_folds(signers, 5, seed=42)`` (the same call the 0.691 run
made), and stores the fold id per sample plus a hash of the cache, so every run can
prove it uses the identical data and folds. Also writes a human-readable summary.
"""

from __future__ import annotations

import json

import numpy as np
from common import CACHE, FOLD_SEED, FOLDS, N_FOLDS, sha256_file

from sign_ml.dynamic_model import signer_folds


def main() -> None:
    y = np.load(CACHE / "y.npy").astype(np.int64)
    signers = [str(s) for s in np.load(CACHE / "signers.npy").tolist()]
    glosses: list[str] = json.loads((CACHE / "glosses.json").read_text())
    masks = signer_folds(signers, N_FOLDS, FOLD_SEED)
    fold_id = np.full(len(y), -1, dtype=np.int64)
    for f, m in enumerate(masks):
        fold_id[m] = f
    assert (fold_id >= 0).all()

    # Leakage check: no signer in two folds.
    by_signer: dict[str, set[int]] = {}
    for s, f in zip(signers, fold_id.tolist(), strict=True):
        if s:
            by_signer.setdefault(s, set()).add(f)
    leaks = [s for s, fs in by_signer.items() if len(fs) > 1]
    assert not leaks, f"signers straddle folds: {leaks[:5]}"

    FOLDS.mkdir(parents=True, exist_ok=True)
    np.savez(
        FOLDS / "dynamic_folds.npz",
        fold_id=fold_id,
        x_sha256=np.array(sha256_file(CACHE / "X.npy")),
        y_sha256=np.array(sha256_file(CACHE / "y.npy")),
    )
    counts = np.bincount(y, minlength=len(glosses))
    summary = {
        "source": "ml/models/combined (X.npy, y.npy, signers.npy, glosses.json)",
        "method": f"sign_ml.dynamic_model.signer_folds(signers, k={N_FOLDS}, "
        f"seed={FOLD_SEED}) — signer-disjoint",
        "n_samples": int(len(y)),
        "n_classes": len(glosses),
        "n_signers_known": len(by_signer),
        "n_unknown_signer_samples": int(sum(1 for s in signers if not s)),
        "fold_sizes": np.bincount(fold_id).tolist(),
        "samples_per_class": {
            "min": int(counts.min()),
            "median": float(np.median(counts)),
            "max": int(counts.max()),
            "per_class": dict(zip(glosses, counts.tolist(), strict=True)),
        },
        "classes_missing_per_fold": [
            int(len(glosses) - len(np.unique(y[fold_id == f]))) for f in range(N_FOLDS)
        ],
    }
    (FOLDS / "dynamic_folds.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps({k: v for k, v in summary.items() if k != "samples_per_class"}))
    print(
        "samples/class min/median/max:",
        summary["samples_per_class"]["min"],
        summary["samples_per_class"]["median"],
        summary["samples_per_class"]["max"],
    )


if __name__ == "__main__":
    main()
