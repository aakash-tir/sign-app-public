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

- Package under `ml/src/sign_ml/` with clear stages: `extract/`, `train/`,
  `export/`, `eval/`, `data/` (see [`../../docs/architecture.md`](../../docs/architecture.md) §3).
- Keep stages composable and CLI-runnable (e.g. `uv run python -m sign_ml.train`).
- Deterministic where possible: seed RNG; log config + metrics for reproducibility.

## Normalization parity

- The landmark **normalization** must match the TS runtime **exactly**
  ([`../../docs/recognition.md`](../../docs/recognition.md) §5). Maintain a shared
  **golden-vector fixture**: identical input → identical normalized output in both
  Python and TS. Treat any divergence as a bug (train/serve skew).

## Model export

- Export to **TF.js** format into `frontend/public/models/`.
- Keep models small (MLP for static, GRU/LSTM for dynamic) for fast offline load.
- Record dataset, subset, and **measured accuracy** alongside each exported model;
  vocabulary expansion is gated on these numbers (ADR-007).

## Quality gates (must pass before PR merge)

- `ruff format --check` · `ruff check` · `mypy .` · `pytest`.

## Testing

- **pytest** for extract/train/export shape contracts and the eval metric.
- Test the normalization against the shared golden vectors.
- Keep tests fast: use tiny fixtures, not full datasets, in CI.
