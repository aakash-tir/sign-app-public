# Architecture

> The big picture: what the app is made of, what each technology does, and how
> the pieces fit together. For *why* particular choices were made, see the
> Architecture Decision Records in
> [`../.claude/docs/decisions.md`](../.claude/docs/decisions.md).

## 1. The shape of the system

```
┌───────────────────────────────────────────────────────────────────────┐
│  Browser (Windows / Android / iOS / Linux — one PWA, four platforms)   │
│                                                                        │
│   React UI                                                             │
│     ├─ Practice mode    ├─ Learn mode    ├─ Camera view  ├─ Settings   │
│                                                                        │
│   Domain logic (pure TypeScript — no React, no DB, no camera)          │
│     ├─ buckets (need-practice / confident)                             │
│     ├─ practice selection (1:2 bias, no-repeat window)                 │
│     ├─ proficiency, sentence unlock                                    │
│                                                                        │
│   Recognition layer                                                    │
│     ├─ camera (getUserMedia, one shared MediaStream)                   │
│     ├─ MediaPipe Tasks Vision  → 21 hand landmarks + body pose         │
│     ├─ static classifier (hand-written MLP on JSON weights)            │
│     ├─ dynamic classifier (TCN, ONNX Runtime Web, 30-frame window)     │
│                                                                        │
│   Persistence                                                          │
│     ├─ IndexedDB (Dexie) — word bank, progress, profile                │
│     └─ Cache Storage (service worker) — app shell, model files         │
└────────────────────────────────────┬──────────────────────────────────┘
                                     │ HTTPS, static files only
            ┌────────────────────────┴────────────────────────┐
            │  Cloudflare Workers Static Assets (the host)     │
            │  Auto-deploys on push to `main` from GitHub      │
            └─────────────────────────────────────────────────┘

   (Build-time only — never runs for the user)
   ┌──────────────────────────────────────────┐
   │  Python ML pipeline (ml/, run by devs)   │
   │  MediaPipe → landmarks → train → export  │
   │  Output: model + metadata bundled into   │
   │  frontend/public/ for the next deploy.   │
   └──────────────────────────────────────────┘
```

Two things to notice:

1. **There is no backend.** Nothing in the request path needs a server. The
   "hosting" is literally a bunch of static files on Cloudflare's edge network
   plus HTTPS. The app runs entirely in the browser.
2. **Python is build-time only.** It produces a model file. That file is
   committed/published into the frontend, and Python is never touched again
   until you want to retrain. See ADR-004.

## 2. The tech stack

### Frontend (what users run)

| Concern | Choice | One-line "why" |
| --- | --- | --- |
| Language | **TypeScript** (strict mode) | Types catch a class of bugs before they ship; strict + `noUncheckedIndexedAccess` keeps it honest. |
| UI library | **React 19** | Industry standard; function components + hooks; cross-platform via the browser. |
| Build tool & dev server | **Vite** | Fast HMR, first-class PWA plugin, no Webpack pain. |
| PWA / offline | **`vite-plugin-pwa`** (Workbox) | Generates the service worker that precaches the app shell and runtime-caches model files so the app works offline. |
| Routing | **React Router** | Mode/level navigation (Practice / Learn / Camera / Settings). |
| State | **Zustand-style stores + React context** | Lightweight stores around pure-TS state. The camera lives in a `CameraProvider` mounted above the router (ADR-018). |
| Camera | **`getUserMedia`** (browser API) | One cross-platform way to access webcams from the web. |
| Landmark extraction | **`@mediapipe/tasks-vision`** (Hand + Holistic Landmarkers) | On-device WASM/WebGL — runs locally, no upload. Returns hand and body skeleton keypoints. |
| Static recognition | **Hand-written MLP** over bundled JSON weights | The letters classifier is tiny. Zero ML runtime dependency. (ADR-011) |
| Dynamic recognition | **ONNX Runtime Web** running a PyTorch-trained TCN | A sequence model needs a real runtime; ONNX is portable. (ADR-015) |
| Storage | **IndexedDB via Dexie** | Local-first; survives offline; per-device. (ADR-005) |
| Lint / format | **ESLint + Prettier** | Quality gate. |
| Types | **`tsc --noEmit`** | Quality gate. |
| Tests | **Vitest** (unit) + **Playwright** (e2e/component) | Domain logic is unit-tested deterministically; flows are e2e-tested with a fake camera. |

### ML pipeline (build-time, in Python)

| Concern | Choice | One-line "why" |
| --- | --- | --- |
| Language | **Python 3.12+** | Where the ML libraries live. |
| Env / deps | **`uv`** | Fast, reproducible dependency management. |
| Landmark extraction | **MediaPipe Python** | Same landmark topology as the browser → no train/serve skew. |
| Static training | **scikit-learn** (MLPClassifier) | Tiny model; exported as JSON weights, not as a TF/ONNX file. (ADR-011) |
| Dynamic training | **PyTorch** | Trains the TCN; exports to ONNX natively via `torch.onnx`. (ADR-015) |
| Dynamic export | **ONNX** | Portable model format the browser can run via ONNX Runtime Web. |
| Format / lint | **ruff** (`ruff format` + `ruff check`) | Quality gate. |
| Types | **mypy** | Quality gate. |
| Tests | **pytest** | Quality gate. |

> Note: an earlier plan used TensorFlow.js for the dynamic model. We switched
> to PyTorch → ONNX because `tensorflow` and `tensorflowjs` don't install
> cleanly on Windows + Python 3.13 with NumPy 2.x. That's ADR-015.

## 3. Repository layout

```
sign-app/
├─ frontend/                     React + TS PWA (runtime)
│  ├─ src/
│  │  ├─ App.tsx, main.tsx       app shell, router, top-level providers
│  │  ├─ modes/
│  │  │  ├─ practice/            PracticeMode.tsx — drill flow
│  │  │  ├─ learn/               LearnMode.tsx — guided learning
│  │  │  └─ settings/            SettingsView.tsx — level, overlay colors, etc.
│  │  │
│  │  ├─ domain/                 PURE TYPESCRIPT — no React, no I/O
│  │  │  ├─ buckets.ts           need-practice ↔ confident transitions
│  │  │  ├─ selection.ts         1:2 bias, no-repeat-within-10 picker
│  │  │  ├─ levels.ts            beginner / intermediate / expert + unlocks
│  │  │  ├─ rng.ts               seedable RNG for deterministic tests
│  │  │  └─ types.ts             domain model types
│  │  │
│  │  ├─ recognition/            camera, landmarks, classifiers, drawing
│  │  │  ├─ cameraProvider.tsx   app-level shared MediaStream owner
│  │  │  ├─ useCamera.ts         hook to attach the shared stream to a <video>
│  │  │  ├─ mediapipeDetector.ts hand-landmarker adapter
│  │  │  ├─ holisticDetector.ts  holistic (pose + hands) adapter
│  │  │  ├─ normalization.ts     static (hand-only) feature normalization
│  │  │  ├─ dynamicNormalization.ts  dynamic (pose + hands) feature normalization
│  │  │  ├─ frameWindow.ts       30-frame sliding window for dynamic
│  │  │  ├─ mlpClassifier.ts     hand-written MLP forward pass (static)
│  │  │  ├─ onnxDynamicClassifier.ts  ONNX Runtime wrapper (dynamic)
│  │  │  ├─ signClassifier.ts    static glue: classify-and-debounce
│  │  │  ├─ dynamicClassifier.ts dynamic glue: classify + threshold
│  │  │  ├─ useSignRecognition.ts        hook for letters
│  │  │  ├─ useDynamicSignRecognition.ts hook for word-level signs
│  │  │  ├─ useUnifiedSignRecognition.ts hook that switches between the two
│  │  │  ├─ drawLandmarks.ts     overlay for static hand landmarks
│  │  │  ├─ drawHolistic.ts      overlay for pose + both hands
│  │  │  ├─ fingerColors.ts      per-finger colorblind-safe palette
│  │  │  ├─ debounce.ts          require N agreeing frames before accepting
│  │  │  ├─ SignReferencePlayer.tsx   plays the in-app reference clip
│  │  │  └─ CameraView.tsx       dev/debug camera view
│  │  │
│  │  ├─ data/                   persistence
│  │  │  ├─ db.ts                Dexie schema
│  │  │  └─ wordBankRepo.ts      repository: words, progress, profile
│  │  │
│  │  └─ content/                curriculum/content data
│  │     ├─ fingerspelling.ts    the 24 static letters
│  │     ├─ dynamicVocab.ts      the 20 shipped dynamic glosses
│  │     ├─ words.ts             practice bank seeding
│  │     └─ signSentences.ts     short multi-sign learn drills
│  │
│  ├─ public/
│  │  ├─ models/                 bundled model files (MLP JSON, dynamic ONNX, metadata)
│  │  └─ reference/              per-gloss reference landmark clips (PWA-precached)
│  │
│  └─ tests/                     Playwright e2e specs
│
├─ ml/                           Python training pipeline (build-time only)
│  └─ src/sign_ml/
│     ├─ extract.py              run MediaPipe over ASL-Alphabet images
│     ├─ data.py                 dataset loading helpers
│     ├─ normalization.py        mirrors frontend static normalization (golden-tested)
│     ├─ model.py                static MLP training (sklearn)
│     ├─ export.py               write JSON weights for the frontend
│     ├─ eval.py                 hold-out accuracy report
│     ├─ pipeline.py             static CLI driver
│     │
│     ├─ wlasl.py                WLASL dataset adapter
│     ├─ msasl.py                MS-ASL adapter (P3M2 ingest)
│     ├─ msasl_download.py       yt-dlp segment fetcher (owner-run)
│     ├─ ingest.py               canonical labels, signer-disjoint splits
│     ├─ dynamic_extract.py      MediaPipe Holistic over clips → landmark arrays
│     ├─ dynamic_normalization.py  mirrors frontend dynamic normalization
│     ├─ dynamic_model.py        TCN/GRU + training + augmentation + cross-validation
│     ├─ dynamic_export.py       PyTorch → ONNX export with metadata
│     ├─ dynamic_pipeline.py     dynamic CLI driver (extract / train / crossval)
│     ├─ reference_export.py     per-gloss reference clip exporter
│     └─ golden_dynamic.py       generates the shared TS↔Python golden fixture
│
└─ .claude/                      project documentation (working notebook)
```

## 4. End-to-end data flow

What happens between a user pointing their camera at it and the app saying
"correct":

```
1. App boots:
   - CameraProvider mounted above the router
   - User grants camera permission once (one-time privacy explainer)
   - getUserMedia() returns a single shared MediaStream

2. View mounts (Practice / Learn / Camera):
   - useCamera attaches the shared stream to its <video> element
   - useUnifiedSignRecognition lazy-loads MediaPipe + the right classifier
   - Recognition loop starts, throttled to ~30 FPS

3. Per frame (throttled, ~30 FPS):
   a. MediaPipe Tasks Vision runs on the <video> frame
      → 21 hand landmarks per hand (and full body pose for dynamic mode)
   b. Landmarks are normalized
      - Static: translate to wrist origin, scale by hand size, mirror left→right
      - Dynamic: shoulder-centered pose + per-hand normalized handshape
                 → fixed 161-d feature vector
   c. Classifier inference:
      - Static (letters): one frame → MLP forward pass → 24-way softmax
      - Dynamic (words):  push frame into 30-frame window → TCN → 114-way softmax
   d. Debounce: require N consecutive high-confidence agreeing frames before
      emitting {label, confidence} upstream

4. Domain layer decides the outcome:
   - The prompted word (the sign the app is asking for) is compared to the
     classifier's emitted label.
   - If they match above threshold → outcome "correct"
   - If the user presses "I forgot" alone → outcome "wrong" (no incorrect
     screen; just silent)
   - If "I forgot" then "That's what I did" → outcome "correct" (manual
     override; absorbs recognition false negatives)
   - Outcome is committed exactly once (deferred-commit model, ADR-008)

5. Bucket transition + persistence:
   - need-practice → +1 streak on correct; promote to confident at 3
   - confident → demoted to need-practice on wrong
   - Dexie writes the new WordProgress to IndexedDB

6. Selection picks the next word:
   - 1:2 bias toward need-practice
   - No repeat within last 10 displayed words
   - Cycle back to step 3
```

## 5. The two recognition paths, side-by-side

| | **Static** (letters) | **Dynamic** (words) |
| --- | --- | --- |
| Vocabulary today | 24 (A–Y minus J,Z) | 20 word-level signs |
| Landmark source | MediaPipe Hand Landmarker | MediaPipe Holistic Landmarker (pose + hands) |
| Feature per frame | 63 numbers (21 × xyz) | 161 numbers (pose + each hand + presence flags) |
| Time window | 1 frame | 30 frames (~1 second) |
| Model | Hand-written MLP, JSON weights | TCN, ONNX file (int8 weights) |
| Runtime size | Tiny (a few KB JSON) | ~296 KB ONNX |
| Inference cost | Negligible | A few ms per window (cached ONNX session, throttled to 30 FPS) |
| Why this split | Letters are single-pose; an MLP is the right tool and the ML runtime saves both download and complexity. | Words involve movement and location, which only a sequence model captures. |

Both paths share the same camera and the same recognition loop wiring
(`useUnifiedSignRecognition`); the per-prompt mode decides which classifier
fires. See [`runtime.md`](runtime.md) for the loop in detail.

## 6. The boundary between deterministic logic and the model

A deliberate split runs through the codebase:

- **`src/domain/`** is **pure TypeScript**, framework-free, deterministically
  testable with seeded RNG. It owns: bucket transitions, the practice
  selection algorithm, level/sentence-unlock rules. Nothing in here knows what
  React, IndexedDB, MediaPipe, or a camera is.
- **`src/recognition/`** is the noisy, model-y, browser-y stuff. It emits
  `{label, confidence}` events. It never decides what to do about them.
- **`src/data/`** owns IndexedDB and exposes repositories (`WordBankRepo`).
  Components never touch IndexedDB directly.
- **React components in `src/modes/`** wire all three together.

This split is what makes the project tractable: the *interesting* logic
(buckets, selection, progress) is tested by deterministic unit tests, and the
*flaky* part (a real ML model running on a real camera) only emits the input
that logic acts on.

## 7. Hosting in one paragraph

Cloudflare Workers Static Assets serves `frontend/dist` from Cloudflare's
global edge. Every push to `main` triggers a build (`npm install && npm run
build`) and a deploy (`npx wrangler deploy`); preview URLs are generated for
PRs. There's nothing dynamic — no functions, no database, no auth. PWAs need
HTTPS to access the camera and register a service worker; the edge gives us
that automatically. See [`deployment.md`](deployment.md) for the full story.

## Where to read next

- **What does the ML actually do?** → [`machine-learning.md`](machine-learning.md)
- **How does a single frame become a "correct"?** → [`runtime.md`](runtime.md)
- **How does this get on the internet?** → [`deployment.md`](deployment.md)
