"""Dynamic-sign sequence model: a small GRU over windowed landmark features.

PyTorch is imported lazily (heavy, optional `--extra train`) so the module — and
the pure helpers below — import and unit-test without it. We use PyTorch (not
TensorFlow) because tensorflowjs has no Windows wheels and TF pins numpy<2.2,
which conflicts with the project's numpy; Torch coexists with numpy 2.x and
exports ONNX natively (ADR-015, runtime = onnxruntime-web).

Front zero-padded windows mean the real frames sit at the *end*, so the model
reads the GRU's last-timestep output.
"""

from __future__ import annotations

import copy
from collections.abc import Sequence
from typing import Any

import numpy as np
import numpy.typing as npt

FloatArray = npt.NDArray[np.float64]
IntArray = npt.NDArray[np.int64]
BoolArray = npt.NDArray[np.bool_]


def top_k_accuracy(y_true: IntArray, probs: FloatArray, k: int) -> float:
    """Fraction of rows whose true label is in the model's top-``k`` predictions."""
    if y_true.shape[0] == 0:
        return 0.0
    k = min(k, probs.shape[1])
    topk = np.argsort(probs, axis=1)[:, -k:]
    hits = [
        int(true) in set(row.tolist()) for true, row in zip(y_true, topk, strict=True)
    ]
    return float(np.mean(hits))


def resolve_splits(
    splits: npt.NDArray[np.str_],
    seed: int = 42,
    val_frac: float = 0.15,
) -> tuple[BoolArray, BoolArray, BoolArray]:
    """Boolean train/val/test masks from WLASL split labels, with fallbacks for
    the small curated set: if ``test`` is empty, promote ``val`` to test; if
    ``val`` is then empty, carve a deterministic fraction off ``train``."""
    train = splits == "train"
    val = splits == "val"
    test = splits == "test"

    if not test.any():
        if val.any():
            test, val = val.copy(), np.zeros_like(val)
        else:
            train, test = _carve(train, val_frac, seed)

    if not val.any():
        train, val = _carve(train, val_frac, seed + 1)

    return train, val, test


def _carve(mask: BoolArray, frac: float, seed: int) -> tuple[BoolArray, BoolArray]:
    """Move a deterministic ``frac`` of the True positions of ``mask`` into a new
    mask (used to synthesize a val/test split when WLASL's is empty)."""
    rng = np.random.default_rng(seed)
    idx = np.where(mask)[0]
    rng.shuffle(idx)
    k = max(1, int(round(len(idx) * frac))) if len(idx) > 1 else 0
    picked = idx[:k]
    new = np.zeros_like(mask)
    new[picked] = True
    remaining = mask.copy()
    remaining[picked] = False
    return remaining, new


def drop_landmarks(
    x: FloatArray, rng: np.random.Generator, p: float = 0.1
) -> FloatArray:
    """Zero individual landmarks (their whole ``x,y,z`` triplet) per frame with
    probability ``p`` — mimics the per-joint detection misses the runtime hits all
    the time (occlusion, motion blur, hand leaving frame). Finer-grained than the
    whole-frame ``frame_dropout``. A zeroed landmark matches how a missing landmark
    is already encoded; the presence flags (last two features) are left intact.

    Layout assumption: the spatial features (all but the last two) are landmark
    ``x,y,z`` triplets — true for the frozen 161-d frame (``pose-shoulder-hands-v1``).
    """
    out = np.asarray(x, dtype=np.float64).copy()
    if p <= 0.0:
        return out
    b, t, f = out.shape
    n_lm = (f - 2) // 3
    mask = rng.random((b, t, n_lm)) < p
    drop = np.repeat(mask, 3, axis=2)  # one bool per coordinate
    spatial = out[:, :, : n_lm * 3]
    spatial[drop] = 0.0
    out[:, :, : n_lm * 3] = spatial
    return out


def rotate_xy(
    x: FloatArray, rng: np.random.Generator, max_deg: float = 12.0
) -> FloatArray:
    """Rotate every landmark's ``(x, y)`` by a small **per-sample** angle (``z`` and
    the presence flags untouched) — in-plane viewpoint / camera-roll variance. Safe
    for our normalization, which centers and scales but is **not** orientation-
    canonical (it never rotation-aligns), so this doesn't create train/serve skew.
    Zero (padding / missing) landmarks rotate to zero, so they stay zero."""
    out = np.asarray(x, dtype=np.float64).copy()
    if max_deg <= 0.0:
        return out
    b, t, f = out.shape
    n_lm = (f - 2) // 3
    coords = out[:, :, : n_lm * 3].reshape(b, t, n_lm, 3)
    angle = np.deg2rad(rng.uniform(-max_deg, max_deg, size=b))
    cos = np.cos(angle).reshape(b, 1, 1)
    sin = np.sin(angle).reshape(b, 1, 1)
    xv = coords[..., 0].copy()
    yv = coords[..., 1].copy()
    coords[..., 0] = xv * cos - yv * sin
    coords[..., 1] = xv * sin + yv * cos
    out[:, :, : n_lm * 3] = coords.reshape(b, t, n_lm * 3)
    return out


def time_warp(
    x: FloatArray, rng: np.random.Generator, max_rate: float = 0.2
) -> FloatArray:
    """Per-sample speed warp: resample frames on a rate-warped timeline **anchored
    at the last frame**. Windows are front zero-padded and the GRU reads the last
    timestep, so the anchor keeps the most-recent (real) frame fixed while
    stretching/compressing the history. Whole-frame nearest-neighbor selection means
    presence flags stay valid. ``max_rate`` is the max fractional speed change."""
    src = np.asarray(x, dtype=np.float64)
    if max_rate <= 0.0:
        return src.copy()
    out = np.empty_like(src)
    b, t, _f = src.shape
    base = np.arange(t) - (t - 1)  # 0 at the last frame
    for i in range(b):
        rate = rng.uniform(1.0 - max_rate, 1.0 + max_rate)
        idx = np.clip(np.round(base * rate + (t - 1)).astype(np.int64), 0, t - 1)
        out[i] = src[i, idx]
    return out


def augment_sequences(
    x: FloatArray,
    rng: np.random.Generator,
    noise_std: float = 0.01,
    scale_range: tuple[float, float] = (0.9, 1.1),
    frame_dropout: float = 0.1,
    landmark_dropout: float = 0.0,
    rotation_deg: float = 0.0,
    time_warp_rate: float = 0.0,
) -> FloatArray:
    """Augment a batch of ``(B, T, F)`` windows — the main lever for the tiny
    curated dataset. The **last two** features are hand-presence flags, left
    untouched by spatial jitter; frame dropout zeroes whole frames (simulating
    missed detections, which the runtime sees often).

    The P3M3 additions — ``landmark_dropout`` (per-joint misses), ``rotation_deg``
    (in-plane viewpoint), ``time_warp_rate`` (speed) — **default to off** so existing
    training behavior is unchanged; they are enabled and tuned on the honest
    signer-disjoint gate once more data lands (ADR-020). Mirroring and time-shift are
    intentionally **not** included — both are skew-prone under this normalization /
    front-padded last-timestep design (see ``.claude/docs/phase3.md`` P3M3)."""
    out = np.asarray(x, dtype=np.float64).copy()
    b, t, f = out.shape
    spatial = f - 2
    out[:, :, :spatial] *= rng.uniform(scale_range[0], scale_range[1], size=(b, 1, 1))
    out[:, :, :spatial] += rng.normal(0.0, noise_std, size=(b, t, spatial))
    if rotation_deg > 0.0:
        out = rotate_xy(out, rng, rotation_deg)
    if time_warp_rate > 0.0:
        out = time_warp(out, rng, time_warp_rate)
    if landmark_dropout > 0.0:
        out = drop_landmarks(out, rng, landmark_dropout)
    if frame_dropout > 0.0:
        out[rng.random((b, t)) < frame_dropout] = 0.0
    return out


def stratified_folds(y: IntArray, k: int, seed: int = 42) -> list[BoolArray]:
    """Assign each sample to one of ``k`` folds, balanced per class. Returns a
    per-fold boolean test mask (every sample is in exactly one fold).

    NB: this splits **clips**, so a signer can land in both train and test —
    which inflates held-out accuracy. Prefer :func:`signer_folds` for the gate
    (ADR-019); this is kept for comparison/reporting only.
    """
    rng = np.random.default_rng(seed)
    fold_id = np.empty(len(y), dtype=np.int64)
    for cls in np.unique(y):
        idx = np.where(y == cls)[0]
        rng.shuffle(idx)
        fold_id[idx] = np.arange(len(idx)) % k
    return [fold_id == f for f in range(k)]


def signer_folds(
    signer_ids: Sequence[str | None], k: int, seed: int = 42
) -> list[BoolArray]:
    """Assign whole **signers** to ``k`` folds; return a per-fold boolean test mask
    over samples. A sample's fold is its signer's fold, so **no signer's clips ever
    straddle folds** — the leakage that makes stratified-clip CV overstate real
    accuracy (ADR-019). This is the honest gate.

    Signers are balanced across folds by **sample count** (greedy, largest group
    first → emptiest fold), so folds stay comparable in size. A sample with an
    unknown signer (``None`` or ``""``) forms its **own singleton group**, so it
    distributes without creating leakage. Deterministic for a given ``seed``.
    """
    n = len(signer_ids)
    groups: dict[str, list[int]] = {}
    for i, sid in enumerate(signer_ids):
        key = sid if sid else f"__unknown_{i}"
        groups.setdefault(key, []).append(i)

    rng = np.random.default_rng(seed)
    keys = list(groups)
    keys = [keys[i] for i in rng.permutation(len(keys))]  # seeded tie-break
    keys.sort(key=lambda key: len(groups[key]), reverse=True)  # largest first

    fold_sizes = [0] * k
    fold_id = np.full(n, -1, dtype=np.int64)
    for key in keys:
        f = int(np.argmin(fold_sizes))
        for i in groups[key]:
            fold_id[i] = f
        fold_sizes[f] += len(groups[key])
    return [fold_id == f for f in range(k)]


def build_sequence_model(
    n_classes: int, feat: int, hidden: int = 64, seed: int = 42
) -> Any:  # pragma: no cover - needs torch
    """A 2-layer GRU classifier reading the last-timestep state (logits output)."""
    import torch
    from torch import nn

    torch.manual_seed(seed)

    class GRUClassifier(nn.Module):  # type: ignore[misc]
        def __init__(self) -> None:
            super().__init__()
            self.gru = nn.GRU(
                input_size=feat,
                hidden_size=hidden,
                num_layers=2,
                batch_first=True,
                dropout=0.3,
            )
            self.head = nn.Sequential(
                nn.Linear(hidden, 64),
                nn.ReLU(),
                nn.Dropout(0.3),
                nn.Linear(64, n_classes),
            )

        def forward(self, x: Any) -> Any:
            out, _ = self.gru(x)
            return self.head(out[:, -1, :])

    return GRUClassifier()


def train_and_eval(
    x: FloatArray,
    y: IntArray,
    splits: npt.NDArray[np.str_],
    n_classes: int,
    seed: int = 42,
    epochs: int = 150,
    batch_size: int = 16,
    lr: float = 1e-3,
    patience: int = 20,
    augment: bool = True,
) -> tuple[Any, dict[str, Any]]:  # pragma: no cover - needs torch
    """Train the GRU with early stopping on val loss; report top-1/top-5 on test."""
    import torch
    from torch import nn

    torch.manual_seed(seed)
    rng = np.random.default_rng(seed)
    x_np = np.asarray(x, dtype=np.float64)
    xt = torch.tensor(x_np.astype(np.float32))
    yt = torch.tensor(np.asarray(y, dtype=np.int64))
    train, val, test = resolve_splits(splits, seed)

    model = build_sequence_model(n_classes, xt.shape[2], seed=seed)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    loss_fn = nn.CrossEntropyLoss()

    train_idx = np.where(train)[0]
    best_val = float("inf")
    best_state = copy.deepcopy(model.state_dict())
    bad_epochs = 0
    epochs_run = 0
    for _epoch in range(epochs):
        epochs_run += 1
        model.train()
        order = rng.permutation(train_idx)  # one shuffle per epoch
        for start in range(0, len(order), batch_size):
            batch = order[start : start + batch_size]
            xb = augment_sequences(x_np[batch], rng) if augment else x_np[batch]
            optimizer.zero_grad()
            loss = loss_fn(model(torch.tensor(xb.astype(np.float32))), yt[batch])
            loss.backward()
            optimizer.step()

        model.eval()
        with torch.no_grad():
            val_loss = float(loss_fn(model(xt[val]), yt[val]).item())
        if val_loss < best_val:
            best_val, best_state, bad_epochs = (
                val_loss,
                copy.deepcopy(model.state_dict()),
                0,
            )
        else:
            bad_epochs += 1
            if bad_epochs >= patience:
                break

    model.load_state_dict(best_state)
    model.eval()
    with torch.no_grad():
        logits = model(xt[test])
        probs = torch.softmax(logits, dim=1).numpy().astype(np.float64)

    metrics: dict[str, Any] = {
        "top1": top_k_accuracy(y[test].astype(np.int64), probs, 1),
        "top5": top_k_accuracy(y[test].astype(np.int64), probs, 5),
        "n_train": int(train.sum()),
        "n_val": int(val.sum()),
        "n_test": int(test.sum()),
        "epochs_run": epochs_run,
        "n_classes": n_classes,
    }
    return model, metrics


def cross_validate(
    x: FloatArray,
    y: IntArray,
    glosses: list[str],
    folds: int = 5,
    seed: int = 42,
    epochs: int = 150,
    batch_size: int = 16,
    lr: float = 1e-3,
    patience: int = 20,
    val_frac: float = 0.15,
    signer_ids: Sequence[str | None] | None = None,
    aug: dict[str, Any] | None = None,
) -> dict[str, Any]:  # pragma: no cover - needs torch
    """k-fold CV → a trustworthy aggregate + per-gloss top-1, since the native WLASL
    test split is ~1 clip/gloss. Each sample is predicted exactly once (in its
    held-out fold); per-gloss top-1 pools those predictions.

    When ``signer_ids`` is given, folds are **signer-disjoint** (the honest gate,
    ADR-019); otherwise they fall back to stratified-clip folds (reporting only).
    """
    import torch
    from torch import nn

    x_np = np.asarray(x, dtype=np.float64)
    xt = torch.tensor(x_np.astype(np.float32))
    yt = torch.tensor(np.asarray(y, dtype=np.int64))
    n_classes = len(glosses)
    top5 = min(5, n_classes)

    if signer_ids is not None:
        fold_masks = signer_folds(signer_ids, folds, seed)
        fold_kind = "signer-disjoint"
    else:
        fold_masks = stratified_folds(y, folds, seed)
        fold_kind = "stratified"

    correct1 = np.zeros(len(y), dtype=bool)
    correct5 = np.zeros(len(y), dtype=bool)

    for fold, test_mask in enumerate(fold_masks):
        rng = np.random.default_rng(seed + fold)
        pool = np.where(~test_mask)[0]
        rng.shuffle(pool)
        n_val = max(1, int(round(len(pool) * val_frac)))
        val_idx, train_idx = pool[:n_val], pool[n_val:]

        torch.manual_seed(seed + fold)
        model = build_sequence_model(n_classes, x_np.shape[2], seed=seed + fold)
        optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
        loss_fn = nn.CrossEntropyLoss()
        best_val = float("inf")
        best_state = copy.deepcopy(model.state_dict())
        bad_epochs = 0
        for _epoch in range(epochs):
            model.train()
            order = rng.permutation(train_idx)
            for start in range(0, len(order), batch_size):
                batch = order[start : start + batch_size]
                xb = augment_sequences(x_np[batch], rng, **(aug or {}))
                optimizer.zero_grad()
                loss = loss_fn(model(torch.tensor(xb.astype(np.float32))), yt[batch])
                loss.backward()
                optimizer.step()
            model.eval()
            with torch.no_grad():
                val_loss = float(loss_fn(model(xt[val_idx]), yt[val_idx]).item())
            if val_loss < best_val:
                best_val, best_state, bad_epochs = (
                    val_loss,
                    copy.deepcopy(model.state_dict()),
                    0,
                )
            else:
                bad_epochs += 1
                if bad_epochs >= patience:
                    break

        model.load_state_dict(best_state)
        model.eval()
        with torch.no_grad():
            probs = torch.softmax(model(xt[test_mask]), dim=1).numpy()
        ranked = np.argsort(probs, axis=1)
        for row, sample in enumerate(np.where(test_mask)[0]):
            correct1[sample] = bool(ranked[row, -1] == y[sample])
            correct5[sample] = bool(y[sample] in ranked[row, -top5:])

    per_gloss = {}
    for cls, gloss in enumerate(glosses):
        mask = y == cls
        per_gloss[gloss] = {
            "n": int(mask.sum()),
            "top1": float(correct1[mask].mean()) if mask.any() else 0.0,
        }
    return {
        "cv_top1": float(correct1.mean()),
        "cv_top5": float(correct5.mean()),
        "fold_kind": fold_kind,
        "aug": aug or {},
        "folds": folds,
        "n_samples": int(len(y)),
        "per_gloss": per_gloss,
    }
