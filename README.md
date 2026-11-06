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

A hobby project, not a product. The app is live with 24 fingerspelling letters
and 100+ dynamic signs. See [`.claude/progress.md`](.claude/progress.md) for the
detailed status.

## License and training data

The code is released under the [MIT License](LICENSE).

The shipped models in `frontend/public/models/` were trained on public ASL
datasets. **No dataset media (videos, images or extracted landmarks) is included
in this repository**; the ML pipeline downloads them locally, and each dataset
stays under its own terms:

- **WLASL**: <https://github.com/dxli94/WLASL>
- **MS-ASL**: <https://www.microsoft.com/en-us/research/project/ms-asl/>, under the
  [Computational Use of Data Agreement](https://github.com/microsoft/Computational-Use-of-Data-Agreement)
  (see ADR-016 in [`.claude/docs/decisions.md`](.claude/docs/decisions.md))
- **ASL Alphabet** (Kaggle), for the static fingerspelling model

If you reuse the models, check those terms for your use case.
