"""Letters (static fingerspelling) baseline CV (issue #64).

Re-extracts landmarks exactly as the shipped model was trained (run_real_pipeline:
the 24 static letters, the first 500 images per class, normalize wrist-mcp9-mirror),
caches them under ml/experiments/cache/, freezes 5 stratified folds, and runs the
shipped ``train_mlp`` config ((32,) ReLU, max_iter=500) for each seed.

Caveat recorded in RESULTS.md: the ASL Alphabet set has no signer ids (it is
essentially one signer / one setup), so these folds split *images*, not people. The
number is an upper bound on real-camera accuracy, not comparable to the dynamic
model's signer-disjoint figure.

    uv run --project ml --extra images python ml/experiments/bakeoff/letters.py
"""

from __future__ import annotations

import json
import time

import numpy as np
from common import (
    DATA_ROOT,
    EXP,
    FOLDS,
    N_FOLDS,
    SEEDS,
    fold_metrics,
    top_confused_pairs,
)

from sign_ml.data import STATIC_ASL_LETTERS
from sign_ml.export import model_to_dict
from sign_ml.extract import extract_dataset
from sign_ml.model import train_mlp

IMAGES = (
    DATA_ROOT
    / "ml"
    / "data"
    / "asl_alphabet"
    / "asl_alphabet_train"
    / "asl_alphabet_train"
)
ASSET = DATA_ROOT / "ml" / "models" / "hand_landmarker.task"
CACHE = EXP / "cache"
OUT = EXP / "runs" / "letters"


def load_or_extract() -> tuple[np.ndarray, np.ndarray, list[str]]:
    xp, yp, lp = (
        CACHE / "letters_X.npy",
        CACHE / "letters_y.npy",
        CACHE / "letters.json",
    )
    if xp.exists():
        return np.load(xp), np.load(yp), json.loads(lp.read_text())
    CACHE.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    x, y, used = extract_dataset(
        IMAGES, ASSET, labels=STATIC_ASL_LETTERS, max_per_class=500
    )
    print(f"extracted {len(y)} samples in {(time.time() - t0) / 60:.1f} min")
    np.save(xp, x)
    np.save(yp, y)
    lp.write_text(json.dumps(used))
    return x, y, used


def main() -> None:
    x, y, labels = load_or_extract()
    y = y.astype(np.int64)
    n_classes = len(labels)
    folds_path = FOLDS / "letter_folds.npz"
    if folds_path.exists():
        fold_id = np.load(folds_path)["fold_id"]
        assert len(fold_id) == len(y), "letter cache changed since folds were frozen"
    else:
        from sklearn.model_selection import StratifiedKFold

        fold_id = np.full(len(y), -1, dtype=np.int64)
        skf = StratifiedKFold(n_splits=N_FOLDS, shuffle=True, random_state=42)
        for f, (_, test) in enumerate(skf.split(x, y)):
            fold_id[test] = f
        np.savez(folds_path, fold_id=fold_id)
        (FOLDS / "letter_folds.json").write_text(
            json.dumps(
                {
                    "method": "StratifiedKFold(5, shuffle=True, random_state=42) over "
                    "images — NOT signer-disjoint (dataset has no signer ids)",
                    "n_samples": int(len(y)),
                    "n_classes": n_classes,
                    "samples_per_class": dict(
                        zip(
                            labels,
                            np.bincount(y, minlength=n_classes).tolist(),
                            strict=True,
                        )
                    ),
                },
                indent=2,
            )
        )

    OUT.mkdir(parents=True, exist_ok=True)
    for seed in SEEDS:
        rows = []
        pred_all = np.full(len(y), -1, dtype=np.int64)
        for f in range(N_FOLDS):
            test = fold_id == f
            clf = train_mlp(x[~test], y[~test], seed=seed)
            # sklearn returns probs over clf.classes_; map back to label indices.
            probs = np.zeros((int(test.sum()), n_classes))
            probs[:, clf.classes_] = clf.predict_proba(x[test])
            m = fold_metrics(y[test], probs, n_classes)
            m["fold"] = f
            rows.append(m)
            pred_all[test] = probs.argmax(axis=1)
            if seed == SEEDS[0] and f == 0:
                (OUT / "fold0_model.json").write_text(
                    json.dumps(model_to_dict(clf, labels, x.shape[1]))
                )
            print(f"seed {seed} fold {f}: top1 {m['top1']:.4f} F1 {m['macro_f1']:.4f}")
        summary = {
            "candidate": "letters-baseline",
            "seed": seed,
            "folds": rows,
            "confused": top_confused_pairs(y, pred_all, labels),
        }
        (OUT / f"seed{seed}.json").write_text(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
