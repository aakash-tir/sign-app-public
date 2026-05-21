# Sign App

A cross-platform **PWA that teaches American Sign Language (ASL)**. Learners
perform signs in front of their device camera and get automatic, **on-device**
feedback. Runs on Windows, Android, iOS, and Linux from a single React +
TypeScript codebase; a Python pipeline (build-time only) trains the recognition
model.

> Full documentation lives in [`.claude/`](.claude/CLAUDE.md). Start there:
> [product spec](.claude/project-context.md) ·
> [architecture](.claude/docs/architecture.md) ·
> [recognition/ML](.claude/docs/recognition.md) ·
> [milestones](.claude/docs/milestones.md) ·
> [decisions](.claude/docs/decisions.md).

## Repository layout

```
frontend/   React + TypeScript PWA (runtime)
ml/         Python training & tooling pipeline (build-time only)
.claude/    Project documentation
```

## Quick start

### Frontend

```bash
cd frontend
npm install
npm run dev        # local dev server
npm run build      # production build (PWA)
npm run lint       # eslint
npm run format     # prettier --check
npm run typecheck  # tsc --noEmit
npm run test       # vitest
npm run test:e2e   # playwright
```

### ML pipeline

```bash
cd ml
uv sync            # install deps
uv run ruff format --check .
uv run ruff check .
uv run mypy .
uv run pytest
```

## Status

Early development. See [`.claude/progress.md`](.claude/progress.md) for the
current milestone.
