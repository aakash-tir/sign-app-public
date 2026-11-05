# Python rules — ML pipeline

Applies to `ml/` (build-time training & tooling only — see ADR-004). This code
**never runs at app runtime**; it produces the model artifacts the frontend loads.

## Environment

- **Python 3.12+**, managed with **`uv`** (`uv sync`, `uv run`). Pin deps in
  `pyproject.toml` + lockfile.

## Style & types

- **`ruff format`** is the formatter (the plan's required format check).
- **`ruff check`** for linting.
- **`mypy .`** must pass with no errors (the plan's required type check). Add type
  hints to all public functions; prefer precise array typing where practical.

## Structure

- Package under `ml/src/sign_ml/` as **flat stage modules** — `extract.py`,
  `model.py`, `export.py`, `eval.py`, `data.py`, plus their `dynamic_*`
  counterparts (see [`../../docs/architecture.md`](../../docs/architecture.md) §3).
- Keep stages composable and CLI-runnable. The dynamic pipeline is the main entry
  point: `uv run --project ml python -m sign_ml.dynamic_pipeline <stage>`
  (`extract` · `extract-combined` · `assemble-combined` · `pretrain` · `train` ·
  `crossval` · `calibrate` · `diagnose`; `train` also exports the ONNX).
- Deterministic where possible: seed RNG; log config + metrics for reproducibility.

## Normalization parity

- The landmark **normalization** must match the TS runtime **exactly**
  ([`../../docs/recognition.md`](../../docs/recognition.md) §5). Maintain a shared
  **golden-vector fixture**: identical input → identical normalized output in both
  Python and TS. Treat any divergence as a bug (train/serve skew).

## Model export

- Export into `frontend/public/models/` in one of two formats: **plain JSON
  weights** for the static fingerspelling MLP (trained with scikit-learn;
  `format: mlp-1`, ADR-011) and **ONNX** for the dynamic model (trained in
  PyTorch, exported via `torch.onnx.export`, loaded by `onnxruntime-web`,
  ADR-015). **Never TF.js.**
- Keep models small (MLP for static, TCN + attention for dynamic, ADR-030) for fast
  offline load; the on-device ONNX budget is **≤ ~1.5 MB** (shipped: 156 KB, int8
  weights via `train --int8`).
- Record dataset, subset, and **measured accuracy** alongside each exported model;
  vocabulary expansion is gated on these numbers (ADR-007).

## Quality gates (must pass before PR merge)

- `ruff format --check` · `ruff check` · `mypy .` · `pytest`.

## Testing

- **pytest** for extract/train/export shape contracts and the eval metric.
- Test the normalization against the shared golden vectors.
- Keep tests fast: use tiny fixtures, not full datasets, in CI.
