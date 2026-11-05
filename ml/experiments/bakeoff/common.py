"""Shared bake-off harness (issue #64): frozen folds, the CV loop, models, metrics.

Run everything through the ml project so it uses the pinned torch/numpy:

    uv run --project ml --extra train python ml/experiments/bakeoff/<script>.py ...

The CV loop is a **verbatim copy** of ``sign_ml.dynamic_model.cross_validate`` with
two deliberate differences, both needed for a fair multi-seed comparison:

1. Folds come from a saved file (``ml/experiments/folds/dynamic_folds.npz``), so the
   *fold assignment* is fixed while the *training seed* varies. Upstream derives
   both from one ``seed``.
2. The model is built by a factory and an optional feature transform is applied
   after augmentation (the same place upstream applies motion features).

With ``seed=42`` and the baseline factory it reproduces upstream exactly (checked:
see RESULTS.md, "harness fidelity").
"""

from __future__ import annotations

import copy
import hashlib
import json
import os
from collections.abc import Callable
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt

from sign_ml.dynamic_model import augment_sequences, build_sequence_model

REPO = Path(__file__).resolve().parents[3]
# Datasets/caches are git-ignored, so a worktree doesn't have them: point
# BAKEOFF_DATA_ROOT at the checkout that holds ml/models + ml/data (read-only use).
DATA_ROOT = Path(os.environ.get("BAKEOFF_DATA_ROOT", str(REPO)))
CACHE = DATA_ROOT / "ml" / "models" / "combined"
EXP = REPO / "ml" / "experiments"
FOLDS = EXP / "folds"
RUNS = EXP / "runs"  # git-ignored: per-fold weights, ONNX, held-out probs

# The shipped recipe (P4M17): crossval --aug --pooling attention --bidirectional
# --label-smoothing 0.15, epochs/patience/lr/batch at their defaults.
P3M3_AUG: dict[str, float] = {
    "landmark_dropout": 0.1,
    "rotation_deg": 12.0,
    "time_warp_rate": 0.2,
}
RECIPE: dict[str, Any] = {
    "epochs": 150,
    "batch_size": 16,
    "lr": 1e-3,
    "patience": 20,
    "val_frac": 0.15,
    "label_smoothing": 0.15,
    "aug": P3M3_AUG,
}
SEEDS = (42, 43, 44)
N_FOLDS = 5
FOLD_SEED = 42  # the seed the shipped 0.691 used for signer_folds

FloatArray = npt.NDArray[np.float64]
IntArray = npt.NDArray[np.int64]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_dynamic() -> tuple[FloatArray, IntArray, list[str], IntArray]:
    """The cached dataset + the frozen fold id per sample (asserts it's the same
    cache the folds were made from)."""
    # Memory-mapped, read-only: parallel runs share one copy via the OS page cache
    # instead of each holding ~180 MB (the first attempt was reaped for low memory).
    # Same float64 values, so training is bit-identical.
    x = np.load(CACHE / "X.npy", mmap_mode="r")
    y = np.load(CACHE / "y.npy").astype(np.int64)
    glosses: list[str] = json.loads((CACHE / "glosses.json").read_text())
    folds = np.load(FOLDS / "dynamic_folds.npz")
    want = str(folds["x_sha256"])
    got = sha256_file(CACHE / "X.npy")
    if want != got:
        raise RuntimeError(f"X.npy changed since folds were frozen ({got} != {want})")
    return x, y, glosses, folds["fold_id"].astype(np.int64)


# --------------------------------------------------------------------------- models


def build_tcn(n_classes: int, feat: int, seed: int, hidden: int = 96) -> Any:
    """Candidate A: a dilated 1D temporal-conv net over the 30-frame window.

    Pointwise projection → 4 residual blocks (kernel 3, dilation 1/2/4/8 →
    receptive field 31 ≥ the 30-frame window) → the **same** masked attention
    pooling + head as the shipped BiGRU, so only the sequence encoder differs.
    Padding frames (all-zero input) are re-zeroed after every block so the
    front padding can't leak into the pooled context. ~140k params vs the
    BiGRU's ~178k. Hyperparameters fixed a priori, not tuned on any fold."""
    import torch
    from torch import nn

    torch.manual_seed(seed)

    class Block(nn.Module):  # type: ignore[misc]
        def __init__(self, dilation: int) -> None:
            super().__init__()
            self.conv = nn.Conv1d(
                hidden, hidden, 3, padding=dilation, dilation=dilation
            )
            self.norm = nn.GroupNorm(1, hidden)  # LayerNorm over (C, T); ONNX-safe
            self.drop = nn.Dropout(0.2)

        def forward(self, h: Any, real: Any) -> Any:
            out = self.drop(torch.relu(self.norm(self.conv(h))))
            return (h + out) * real

    class TCNClassifier(nn.Module):  # type: ignore[misc]
        def __init__(self) -> None:
            super().__init__()
            self.proj = nn.Conv1d(feat, hidden, 1)
            self.blocks = nn.ModuleList([Block(d) for d in (1, 2, 4, 8)])
            self.attn = nn.Linear(hidden, 1)
            self.head = nn.Sequential(
                nn.Linear(hidden, 64),
                nn.ReLU(),
                nn.Dropout(0.3),
                nn.Linear(64, n_classes),
            )

        def forward(self, x: Any) -> Any:
            real_bt = (x.abs().sum(dim=2) > 0).float()  # (B, T)
            real = real_bt.unsqueeze(1)  # (B, 1, T)
            h = self.proj(x.transpose(1, 2)) * real  # (B, C, T)
            for block in self.blocks:
                h = block(h, real)
            out = h.transpose(1, 2)  # (B, T, C)
            scores = self.attn(out).squeeze(-1).masked_fill(real_bt == 0, -1e9)
            weights = torch.softmax(scores, dim=1).unsqueeze(-1)
            return self.head((out * weights).sum(dim=1))

    return TCNClassifier()


def build_baseline(n_classes: int, feat: int, seed: int) -> Any:
    return build_sequence_model(
        n_classes, feat, seed=seed, pooling="attention", bidirectional=True
    )


# ------------------------------------------------------------- hand-shape features

# MediaPipe hand topology: wrist 0; thumb 1-4, index 5-8, middle 9-12, ring 13-16,
# pinky 17-20. Each finger chain is (base, j1, j2, tip).
_FINGERS = (
    (1, 2, 3, 4),
    (5, 6, 7, 8),
    (9, 10, 11, 12),
    (13, 14, 15, 16),
    (17, 18, 19, 20),
)
_TIPS = (4, 8, 12, 16, 20)
POSE_LEN, HAND_LEN = 33, 63
HAND_SHAPE_DIM = 30  # per hand: 15 joint angles + 10 tip-tip + 5 tip-wrist distances


def _hand_shape(hand: FloatArray) -> FloatArray:
    """Rotation-invariant shape of one hand block ``(..., 63)`` → ``(..., 30)``.

    The hand block is already wrist-centred and palm-scaled (normalize_hand_landmarks),
    so distances are translation/scale invariant; angles and distances are also
    **rotation** invariant, which the raw coordinates are not. Absent hands (all
    zeros) and dropped joints yield zeros rather than NaNs."""
    pts = hand.reshape(*hand.shape[:-1], 21, 3)
    present = np.any(hand != 0.0, axis=-1, keepdims=True)
    feats: list[FloatArray] = []
    for base, j1, j2, tip in _FINGERS:
        chain = (0, base, j1, j2, tip)
        for a, b, c in zip(chain, chain[1:], chain[2:], strict=False):
            u = pts[..., a, :] - pts[..., b, :]
            v = pts[..., c, :] - pts[..., b, :]
            nu = np.linalg.norm(u, axis=-1)
            nv = np.linalg.norm(v, axis=-1)
            denom = nu * nv
            cos = np.where(
                denom > 1e-9, np.sum(u * v, axis=-1) / np.maximum(denom, 1e-9), 0.0
            )
            feats.append(np.clip(cos, -1.0, 1.0))
    for i, a in enumerate(_TIPS):
        for b in _TIPS[i + 1 :]:
            feats.append(np.linalg.norm(pts[..., a, :] - pts[..., b, :], axis=-1))
    for a in _TIPS:
        feats.append(np.linalg.norm(pts[..., a, :], axis=-1))  # wrist is the origin
    out = np.stack(feats, axis=-1)
    return np.where(present, out, 0.0)


def add_hand_shape(x: FloatArray) -> FloatArray:
    """Candidate B transform: ``(B, T, 161)`` → ``(B, T, 221)`` (161 + 2×30).
    Applied after augmentation, so it sees the same jittered landmarks as the
    raw features. Padding frames stay all-zero."""
    left = x[..., POSE_LEN : POSE_LEN + HAND_LEN]
    right = x[..., POSE_LEN + HAND_LEN : POSE_LEN + 2 * HAND_LEN]
    return np.concatenate([x, _hand_shape(left), _hand_shape(right)], axis=-1)


Transform = Callable[[FloatArray], FloatArray]
Factory = Callable[[int, int, int], Any]

CANDIDATES: dict[str, tuple[Factory, Transform | None, int]] = {
    # name: (model factory, feature transform, input feature dim)
    "baseline": (build_baseline, None, 161),
    "tcn": (build_tcn, None, 161),
    "handshape": (build_baseline, add_hand_shape, 161 + 2 * HAND_SHAPE_DIM),
}


# ------------------------------------------------------------------------ CV loop


def cross_validate_frozen(
    x: FloatArray,
    y: IntArray,
    n_classes: int,
    fold_id: IntArray,
    seed: int,
    factory: Factory,
    transform: Transform | None,
    feat: int,
    out_dir: Path,
    log: Callable[[str], None] = print,
) -> dict[str, Any]:
    """Mirror of ``cross_validate`` (see module docstring). Saves per fold:
    held-out logits, the best state_dict, and returns per-fold summary rows."""
    import torch
    from torch import nn

    x_np = np.asarray(x, dtype=np.float64)

    def prep(arr: FloatArray) -> Any:
        out = transform(arr) if transform is not None else arr
        return torch.tensor(np.asarray(out, dtype=np.float32))

    yt = torch.tensor(y)
    logits_all = np.zeros((len(y), n_classes), dtype=np.float32)
    rows: list[dict[str, Any]] = []
    out_dir.mkdir(parents=True, exist_ok=True)

    for fold in range(int(fold_id.max()) + 1):
        test_mask = fold_id == fold
        ckpt = out_dir / f"fold{fold}.pt"
        if ckpt.exists():
            # Resume: a fold finished before an interruption. Folds use independent
            # seeds (seed + fold), so skipping it doesn't change any other fold.
            model = factory(n_classes, feat, seed + fold)
            model.load_state_dict(torch.load(ckpt))
            model.eval()
            with torch.no_grad():
                raw = model(prep(x_np[test_mask])).numpy()
            logits_all[test_mask] = raw
            m = fold_metrics(y[test_mask], raw.astype(np.float64), n_classes)
            m.update(
                {"fold": fold, "epochs_run": None, "best_val": None, "resumed": True}
            )
            rows.append(m)
            log(
                f"  fold {fold}: top1 {m['top1']:.3f} top5 {m['top5']:.3f} "
                f"F1 {m['macro_f1']:.3f} (n={m['n']}, resumed from {ckpt.name})"
            )
            continue
        rng = np.random.default_rng(seed + fold)
        pool = np.where(~test_mask)[0]
        rng.shuffle(pool)
        n_val = max(1, int(round(len(pool) * RECIPE["val_frac"])))
        val_idx, train_idx = pool[:n_val], pool[n_val:]

        torch.manual_seed(seed + fold)
        model = factory(n_classes, feat, seed + fold)
        optimizer = torch.optim.Adam(
            model.parameters(), lr=RECIPE["lr"], weight_decay=1e-4
        )
        loss_fn = nn.CrossEntropyLoss(label_smoothing=RECIPE["label_smoothing"])
        xt_val = prep(x_np[val_idx])
        best_val = float("inf")
        best_state = copy.deepcopy(model.state_dict())
        bad_epochs = 0
        epochs_run = 0
        for _epoch in range(RECIPE["epochs"]):
            epochs_run += 1
            model.train()
            order = rng.permutation(train_idx)
            for start in range(0, len(order), RECIPE["batch_size"]):
                batch = order[start : start + RECIPE["batch_size"]]
                xb = augment_sequences(x_np[batch], rng, **RECIPE["aug"])
                optimizer.zero_grad()
                loss = loss_fn(model(prep(xb)), yt[batch])
                loss.backward()
                optimizer.step()
            model.eval()
            with torch.no_grad():
                val_loss = float(loss_fn(model(xt_val), yt[val_idx]).item())
            if val_loss < best_val:
                best_val, best_state, bad_epochs = (
                    val_loss,
                    copy.deepcopy(model.state_dict()),
                    0,
                )
            else:
                bad_epochs += 1
                if bad_epochs >= RECIPE["patience"]:
                    break

        model.load_state_dict(best_state)
        model.eval()
        with torch.no_grad():
            raw = model(prep(x_np[test_mask])).numpy()
        logits_all[test_mask] = raw
        torch.save(best_state, out_dir / f"fold{fold}.pt")
        m = fold_metrics(y[test_mask], raw.astype(np.float64), n_classes)
        m.update({"fold": fold, "epochs_run": epochs_run, "best_val": best_val})
        rows.append(m)
        log(
            f"  fold {fold}: top1 {m['top1']:.3f} top5 {m['top5']:.3f} "
            f"F1 {m['macro_f1']:.3f} (n={m['n']}, epochs {epochs_run})"
        )

    np.save(out_dir / "heldout_logits.npy", logits_all)
    return {"folds": rows}


# ------------------------------------------------------------------------ metrics


def macro_f1(y_true: IntArray, y_pred: IntArray, n_classes: int) -> float:
    """Macro-F1 over the classes **present in y_true** (a fold can miss rare
    classes; counting those as F1=0 would penalise the split, not the model)."""
    f1s: list[float] = []
    for c in range(n_classes):
        t = y_true == c
        if not t.any():
            continue
        p = y_pred == c
        tp = float(np.sum(t & p))
        prec = tp / float(p.sum()) if p.any() else 0.0
        rec = tp / float(t.sum())
        f1s.append(0.0 if prec + rec == 0 else 2 * prec * rec / (prec + rec))
    return float(np.mean(f1s)) if f1s else 0.0


def fold_metrics(
    y_true: IntArray, logits: FloatArray, n_classes: int
) -> dict[str, Any]:
    ranked = np.argsort(logits, axis=1)
    pred = ranked[:, -1]
    k = min(5, n_classes)
    top5 = np.array([y_true[i] in ranked[i, -k:] for i in range(len(y_true))])
    return {
        "n": int(len(y_true)),
        "top1": float(np.mean(pred == y_true)),
        "top5": float(np.mean(top5)),
        "macro_f1": macro_f1(y_true, pred, n_classes),
    }


def top_confused_pairs(
    y_true: IntArray, y_pred: IntArray, labels: list[str], k: int = 10
) -> list[tuple[str, str, int, int]]:
    """Most-confused **unordered** pairs (a→b plus b→a), with class sizes for
    context. Returns (a, b, confusions, n_a + n_b)."""
    n = len(labels)
    cm = np.zeros((n, n), dtype=np.int64)
    np.add.at(cm, (y_true, y_pred), 1)
    sizes = cm.sum(axis=1)
    pairs: list[tuple[str, str, int, int]] = []
    for a in range(n):
        for b in range(a + 1, n):
            c = int(cm[a, b] + cm[b, a])
            if c:
                pairs.append((labels[a], labels[b], c, int(sizes[a] + sizes[b])))
    pairs.sort(key=lambda p: (-p[2], p[0], p[1]))
    return pairs[:k]
