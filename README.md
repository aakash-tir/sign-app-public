# Sign App

**Learn American Sign Language (ASL) by signing at your camera.** The app watches
you sign and tells you whether you got it right, and the recognition runs entirely
**on your device**: no video ever leaves it. It's a Progressive Web App, so one
React + TypeScript codebase installs on Windows, Android, iOS and Linux, and it
works offline after the first visit.

**Try it:** <https://sign-app.aakashtirathdas.workers.dev> (allow camera access when asked).

> A hobby project, not a commercial product. It recognises **24 fingerspelling
> letters** and **107 dynamic signs**. Recognition is good but not perfect; the
> honest per-sign numbers are in [`docs/machine-learning.md`](docs/machine-learning.md).

## Features

- **Course:** a guided path through words and the alphabet. Each set first
  *teaches* a sign (reference animation + live camera check), then asks you to
  *recall* it later.
- **Alphabet:** fingerspelling A–Y. J and Z are left out because they need motion
  and the letter model reads single frames.
- **Sentences:** practise short ASL sentences sign by sign, with saved progress.
- **Search:** find any sign by name, including typos and synonyms
  ("kitty" → *cat*).
- **Private and offline:** progress is stored locally in IndexedDB. There's no
  account, no backend and no analytics code.
- **Developer mode** (Settings): the raw practice, learn, sign-library and camera
  debugging tabs.

## How it works

```
camera frame ─▶ MediaPipe (in the browser) extracts hand + body landmarks
             ─▶ landmarks are normalised (position and size don't matter)
             ─▶ letters: a tiny MLP on one frame       (JSON weights)
                signs:   a TCN on a 30-frame window    (ONNX, onnxruntime-web)
             ─▶ threshold + debounce decide "correct" vs "keep practising"
```

The models are trained offline by the Python pipeline in `ml/` and shipped as
static files (`frontend/src/recognition/models/fingerspelling.json` and
`frontend/public/models/dynamic/`). Python never runs in the app. One network
dependency: MediaPipe's landmark model is downloaded from Google's CDN on first
load and cached after that.

Full walkthrough, written for developers: [`docs/`](docs/README.md), covering
[architecture](docs/architecture.md), [machine learning](docs/machine-learning.md),
[runtime](docs/runtime.md) and [deployment](docs/deployment.md).

## Quick start

### Run the app

Needs **Node.js 24** (what CI uses; recent versions should also work).

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173
```

The camera needs a secure context: `localhost` works, a LAN IP over plain
`http` does not.

Checks (all run in CI on every pull request):

```bash
npm run format     # Prettier
npm run lint       # ESLint, no warnings allowed
npm run typecheck  # tsc
npm run test       # Vitest
npx playwright install chromium   # once
npm run test:e2e   # Playwright (recognition is stubbed, so no camera is needed)
npm run build      # production PWA build into dist/
```

### The ML pipeline (only to retrain models)

Needs **Python 3.12+** and [**uv**](https://docs.astral.sh/uv/).

```bash
cd ml
uv sync                      # core pipeline + test deps
uv run ruff format --check . && uv run ruff check . && uv run mypy . && uv run pytest
```

Heavier dependencies are optional extras; install only what you need:

| Extra | Adds | Needed for |
| --- | --- | --- |
| `train` | PyTorch, ONNX | Training + exporting the dynamic-sign model (without it, 15 model tests are skipped) |
| `video` | MediaPipe, OpenCV | Extracting landmarks from sign videos |
| `images` | MediaPipe | Extracting landmarks from alphabet images |
| `msasl` | yt-dlp, ffmpeg | Downloading MS-ASL clips (also needs [Deno](https://deno.land/) on `PATH`) |

```bash
uv sync --extra train --extra video
uv run python -m sign_ml.dynamic_pipeline --help   # extract · train · crossval · calibrate …
```

Datasets are **not** in the repo: download them into `ml/data/` yourself (see
below and [`docs/machine-learning.md`](docs/machine-learning.md)). Video
extraction also needs MediaPipe's `holistic_landmarker.task` model in `ml/models/`.

## Repository layout

```
frontend/   the app: React + TypeScript + Vite PWA, recognition in src/recognition/
ml/         Python training pipeline (build-time only), package in src/sign_ml/
docs/       human-readable docs, architecture diagram, backlog (future.md)
tools/      small scripts (accuracy report, public-mirror sync)
logs/       dated change log, one file per day of work
.claude/    the working notes used with Claude Code: plans, decisions (ADRs), progress
```

The project was built with [Claude Code](https://claude.com/claude-code), issue by
issue, and `.claude/` holds the plans and decision log from that process. Every
decision has an ADR in [`.claude/docs/decisions.md`](.claude/docs/decisions.md).

## Contributing

Issues and pull requests are welcome. This public repo is a mirror of a private
working repo, so an accepted PR is applied there and then shows up here on the
next sync (credited to you). Please run the checks above before opening a PR.

## License and training data

The code is released under the [MIT License](LICENSE).

The shipped models were trained on public ASL datasets. **No dataset media
(videos, images or extracted landmarks) is included in this repository**; the ML
pipeline downloads them locally, and each dataset stays under its own terms:

- **WLASL**: <https://github.com/dxli94/WLASL>
- **MS-ASL**: <https://www.microsoft.com/en-us/research/project/ms-asl/>, under the
  [Computational Use of Data Agreement](https://github.com/microsoft/Computational-Use-of-Data-Agreement)
  (see ADR-016 in [`.claude/docs/decisions.md`](.claude/docs/decisions.md))
- **ASL Alphabet** (Kaggle), for the static fingerspelling model

If you reuse the models, check those terms for your use case.
