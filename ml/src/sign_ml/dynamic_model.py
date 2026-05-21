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


def augment_sequences(
    x: FloatArray,
    rng: np.random.Generator,
    noise_std: float = 0.01,
    scale_range: tuple[float, float] = (0.9, 1.1),
    frame_dropout: float = 0.1,
) -> FloatArray:
    """Augment a batch of ``(B, T, F)`` windows — the main lever for the tiny
    curated dataset. The **last two** features are hand-presence flags, left
    untouched by spatial jitter; frame dropout zeroes whole frames (simulating
    missed detections, which the runtime sees often)."""
    out = np.asarray(x, dtype=np.float64).copy()
    b, t, f = out.shape
    spatial = f - 2
    out[:, :, :spatial] *= rng.uniform(scale_range[0], scale_range[1], size=(b, 1, 1))
    out[:, :, :spatial] += rng.normal(0.0, noise_std, size=(b, t, spatial))
    if frame_dropout > 0.0:
        out[rng.random((b, t)) < frame_dropout] = 0.0
    return out


def stratified_folds(y: IntArray, k: int, seed: int = 42) -> list[BoolArray]:
    """Assign each sample to one of ``k`` folds, balanced per class. Returns a
    per-fold boolean test mask (every sample is in exactly one fold)."""
    rng = np.random.default_rng(seed)
    fold_id = np.empty(len(y), dtype=np.int64)
    for cls in np.unique(y):
        idx = np.where(y == cls)[0]
        rng.shuffle(idx)
        fold_id[idx] = np.arange(len(idx)) % k
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
) -> dict[str, Any]:  # pragma: no cover - needs torch
    """Stratified k-fold CV → a trustworthy aggregate + per-gloss top-1, since the
    native WLASL test split is ~1 clip/gloss. Each sample is predicted exactly once
    (in its held-out fold); per-gloss top-1 pools those predictions."""
    import torch
    from torch import nn

    x_np = np.asarray(x, dtype=np.float64)
    xt = torch.tensor(x_np.astype(np.float32))
    yt = torch.tensor(np.asarray(y, dtype=np.int64))
    n_classes = len(glosses)
    top5 = min(5, n_classes)

    correct1 = np.zeros(len(y), dtype=bool)
    correct5 = np.zeros(len(y), dtype=bool)

    for fold, test_mask in enumerate(stratified_folds(y, folds, seed)):
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
                xb = augment_sequences(x_np[batch], rng)
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
        "folds": folds,
        "n_samples": int(len(y)),
        "per_gloss": per_gloss,
    }
