# sign-ml

Build-time ML pipeline for Sign App: extracts ASL hand landmarks, trains the
recognition model, and exports it as JSON weights for the on-device frontend
(see ADR-011). This code **never runs at app runtime** — see
[`../.claude/docs/recognition.md`](../.claude/docs/recognition.md) and
[`../.claude/rules/python/python.md`](../.claude/rules/python/python.md).

## Setup

```bash
uv sync
```

## Train the model

```bash
# Synthetic data (fast, no dataset needed):
uv run python -m sign_ml

# Real ASL Alphabet data (needs the `images` extra + dataset + hand model):
uv sync --extra images
curl -sL -o models/hand_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
uv run --extra images python -m sign_ml \
  --images ../asl_alphabet_train/asl_alphabet_train \
  --model models/hand_landmarker.task --per-class 500
```

Both write `frontend/src/recognition/models/fingerspelling.json`. The dataset and
`models/` are gitignored — only the trained model JSON is committed.

## Quality gates

```bash
uv run ruff format --check .
uv run ruff check .
uv run mypy .
uv run pytest
```

## Status

The static fingerspelling model is trained on the **ASL Alphabet** dataset
(24 static letters; J and Z are dynamic). See the project progress log for
current accuracy. The dynamic sequence model arrives in M6.
