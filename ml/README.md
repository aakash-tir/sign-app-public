# sign-ml

Build-time ML pipeline for Sign App: extracts ASL hand/pose landmarks, trains the
recognition model, and exports it to TensorFlow.js for the on-device frontend.
This code **never runs at app runtime** — see
[`../.claude/docs/recognition.md`](../.claude/docs/recognition.md) and
[`../.claude/rules/python/python.md`](../.claude/rules/python/python.md).

## Setup

```bash
uv sync
```

## Quality gates

```bash
uv run ruff format --check .
uv run ruff check .
uv run mypy .
uv run pytest
```

## Status

M0: minimal scaffold (placeholder package + smoke tests). The real
extract/train/export/eval stages arrive in M2.
