# Architecture

> How the app is built. Product requirements live in
> [`../project-context.md`](../project-context.md); rationale for the big choices
> is in [`decisions.md`](decisions.md); the recognition pipeline has its own
> deep-dive in [`recognition.md`](recognition.md).

## 1. High-level shape

```
┌──────────────────────────────────────────────────────────────┐
│  Single React + TypeScript PWA  (Windows / Android / iOS / Linux) │
│                                                                │
│   UI (React)                                                   │
│     ├─ Learn mode        ├─ Practice mode     ├─ Shell/levels  │
│                                                                │
│   Domain logic (pure TS, framework-free, heavily unit-tested) │
│     ├─ word-bank buckets (need-practice / confident)          │
│     ├─ practice selection algorithm (1:2, no-repeat-10)       │
│     ├─ proficiency tracking                                    │
│                                                                │
│   Recognition layer                                           │
│     ├─ camera (getUserMedia)                                  │
│     ├─ MediaPipe Tasks Vision  → hand/pose landmarks (WASM)   │
│     ├─ classifier (TF.js)      → sign label + confidence      │
│                                                                │
│   Persistence:  IndexedDB (word bank, progress) + Cache API   │
│                 (app shell, models) via service worker        │
└──────────────────────────────────────────────────────────────┘
            ▲                                   ▲
            │ trained + exported offline        │
┌───────────┴───────────────┐        ┌──────────┴───────────────┐
│  Python ML pipeline        │        │  Static hosting (HTTPS)   │
│  (training/tooling only)   │        │  Cloudflare/Netlify/Pages │
│  ruff · mypy · pytest      │        └───────────────────────────┘
└────────────────────────────┘
```

Everything that runs at **runtime** is in the browser/PWA. **Python is build-time
only** — it produces the recognition model artifacts that get bundled/served to
the client. Nothing in the request path needs a server; hosting is just static
files over HTTPS.

## 2. Tech stack

### Frontend (runtime)

| Concern | Choice | Notes |
| --- | --- | --- |
| Language | **TypeScript** (strict) | |
| UI | **React 18+** | function components + hooks |
| Build/dev | **Vite** | fast HMR, first-class PWA plugin |
| PWA | **vite-plugin-pwa** (Workbox) | service worker, manifest, offline precache |
| Routing | **React Router** | mode/level navigation |
| State | **Zustand** (lightweight) | domain state kept in pure TS; store is thin |
| Camera | **getUserMedia / WebRTC** | cross-platform camera access |
| Landmarks | **`@mediapipe/tasks-vision`** | Hand Landmarker / Gesture Recognizer, on-device WASM/WebGL |
| Inference | **TensorFlow.js** (`@tensorflow/tfjs`) | runs the exported sign classifier client-side |
| Storage | **IndexedDB** via **Dexie** | word bank, progress, proficiency |
| Lint/format | **ESLint + Prettier** | |
| Types | **tsc --noEmit** | gate |
| Tests | **Vitest** (unit) + **Playwright** (e2e/component) | |

### ML pipeline (build-time, Python)

| Concern | Choice | Notes |
| --- | --- | --- |
| Language | **Python 3.12+** | |
| Env/deps | **uv** | fast, reproducible |
| Landmark extraction | **MediaPipe (Python)** | same landmark topology as the web runtime |
| Training | **TensorFlow / Keras** | static MLP + dynamic sequence model |
| Export | **tensorflowjs converter** | → TF.js format the frontend loads |
| Format/lint | **ruff** (`ruff format` + `ruff check`) | gate |
| Types | **mypy .** | gate |
| Tests | **pytest** | gate |

> See [`recognition.md`](recognition.md) for why MediaPipe + a small classifier
> (rather than an end-to-end video model) is the right call, plus the exact model
> shapes, datasets, and the MVP scope.

## 3. Repository layout (monorepo)

```
sign-app/
├─ frontend/                 # React + TS PWA (runtime)
│  ├─ src/
│  │  ├─ app/                # shell, routing, providers
│  │  ├─ modes/learn/        # Learn-mode UI
│  │  ├─ modes/practice/     # Practice-mode UI
│  │  ├─ domain/             # PURE TS: buckets, selection algo, proficiency
│  │  ├─ recognition/        # camera, mediapipe, tf.js classifier
│  │  ├─ data/               # Dexie schema + repositories
│  │  └─ content/            # curriculum / sign reference assets metadata
│  ├─ public/models/         # exported TF.js model(s) + mediapipe wasm/assets
│  ├─ tests/                 # vitest + playwright
│  └─ package.json
├─ ml/                       # Python training + tooling (build-time)
│  ├─ src/sign_ml/
│  │  ├─ extract/            # video/image → landmarks
│  │  ├─ train/              # static + sequence model training
│  │  ├─ export/             # → tfjs
│  │  └─ data/               # dataset adapters (ASL alphabet, WLASL)
│  ├─ tests/
│  └─ pyproject.toml
├─ .claude/                  # documentation (this directory)
├─ .github/workflows/        # CI: frontend gates + ml gates
└─ plan.md
```

Rationale for the monorepo split: the TS app and the Python pipeline have totally
different toolchains and run at different times. Keeping them in sibling folders
lets CI gate each independently (`ruff`/`mypy`/`pytest` for `ml/`;
ESLint/Prettier/`tsc`/Vitest/Playwright for `frontend/`) while the trained
artifact crosses the boundary as a checked-in/published model file.

## 4. Recognition data flow (runtime)

1. `getUserMedia` provides a `MediaStream` → `<video>` element.
2. Per frame (throttled to a target FPS), MediaPipe Tasks Vision extracts **21
   hand landmarks** (and, for dynamic signs, pose/holistic landmarks).
3. Landmarks are **normalized** (translate to wrist origin, scale by hand size,
   canonicalize handedness) — shared logic, mirrored between TS runtime and
   Python training so train/serve features match.
4. The normalized feature vector (static) or window of frames (dynamic) is fed to
   the **TF.js classifier** → `{label, confidence}`.
5. Domain layer decides **correct / not-correct** by comparing the predicted
   label to the prompted word above a confidence threshold (with deb: requiring N
   consecutive agreeing frames to debounce).
6. The **"That's what I did"** override bypasses recognition and forces a correct
   result (see product spec FR-9).

See [`recognition.md`](recognition.md) for normalization details and thresholds.

## 5. Data model (local-first, IndexedDB via Dexie)

```ts
// Indicative shapes — finalized in M3.
type Bucket = "need-practice" | "confident";

interface Word {
  id: string;            // gloss id, stable
  gloss: string;         // display word, e.g. "HELLO"
  level: "beginner" | "intermediate" | "expert";
  // ...reference assets resolved from content/, not stored per-user
}

interface WordProgress {
  wordId: string;
  bucket: Bucket;
  // consecutive correct answers while in need-practice; promote at 3.
  needPracticeStreak: number;   // reset to 0 on wrong; →confident at 3
  learnProficiency: number;     // drives Learn-mode sentence unlock
  timesSeen: number;
  lastSeenAt: number;
  // sliding history to enforce the no-repeat-within-10 window at session level
}

interface SessionState {
  recentWordIds: string[];      // last up to 10 shown, for no-repeat window
}

// Profile-scoped (one per user/device). Level is independent of progress.
interface UserProfile {
  level: "beginner" | "intermediate" | "expert"; // reassignable any time — ADR-010
  sentencesUnlocked: boolean;   // latch: true once confident-word count first ≥ 20
}
```

**Changing level is non-destructive:** reassigning `level` (up or down) never
alters `WordProgress`/buckets — it only changes curriculum and sentence behavior.
Sentence enablement is recomputed as `level ∈ {intermediate, expert}` **or**
`sentencesUnlocked`. See ADR-010.

### Attempt resolution model (no revert)

Each prompted word is one **attempt** with a single terminal **outcome** ∈
{`correct`, `wrong`}. Crucially, **no bucket change is applied until the attempt
resolves** — pressing "I forgot" does *not* immediately mutate state, so there is
nothing to undo. The outcome is determined once, at resolution:

- Camera verifies the sign → `correct`.
- **"I forgot"** reveals the sign and enters a *revealed* sub-state (still
  pending — nothing committed yet):
  - then **"That's what I did"** → `correct` (the camera missed a real attempt).
  - otherwise, advancing to the next word → `wrong`.
- No "incorrect" screen is ever shown; a `wrong` outcome is silent.

Exactly **one** transition is committed per attempt. This is the cleaner
alternative to apply-on-"I forgot"-then-revert-on-"That's what I did": same
observable behavior, but no need to snapshot and restore the prior bucket/streak,
and the outcome is a pure function of the attempt's events. See ADR-008.

### Bucket transitions (Practice) — authoritative

Applied **once**, at attempt resolution:

- New word → `need-practice`, `needPracticeStreak = 0`.
- Outcome `correct` (camera **or** "That's what I did") while `need-practice`:
  `needPracticeStreak += 1`; if it reaches **3** → `confident`,
  `needPracticeStreak = 0`.
- Outcome `wrong` (includes "I forgot" *without* "That's what I did") while
  `need-practice`: `needPracticeStreak = 0`, stays `need-practice`.
- Outcome `correct` while `confident`: stays `confident` (no counter needed).
- Outcome `wrong` while `confident`: → `need-practice`, `needPracticeStreak = 0`.

## 6. Practice selection algorithm

Goal: honor **1:2 confident:need-practice** bias and **no-repeat within 10**.

```
function pickNextWord(bank, recentWordIds /* last ≤10 */):
  eligible = bank.filter(w => not in recentWordIds)
  if eligible is empty:                      # bank ≤ 10 words
      eligible = bank.filter(w => w != recentWordIds.last)   # smallest window
  # weighted bucket choice: P(need-practice)=2/3, P(confident)=1/3,
  # falling back to whichever bucket is non-empty
  bucket = weightedChoice(need:2, confident:1) constrained to non-empty buckets
  candidates = eligible.filter(w => w.bucket == bucket) or eligible
  next = randomChoice(candidates)
  recentWordIds.pushFront(next.id); truncate to 10
  return next
```

Edge cases (all covered by unit tests in M3):

- Bank with <3 words; bank with words in only one bucket.
- Bank with exactly 10 / fewer than 10 words (window shrinks).
- Long runs must still respect the 1:2 ratio *on average*, not strictly
  alternating.

## 7. Offline & PWA

- `vite-plugin-pwa` (Workbox) precaches the **app shell** (HTML/CSS/JS).
- **MediaPipe WASM/model assets** and the **TF.js classifier** are served from
  `public/models/` and runtime-cached (cache-first) so recognition works offline
  after first load.
- Word-bank/progress live in **IndexedDB** — fully local, survives offline.
- Manifest provides install metadata (icons, name, display: standalone) so the
  app installs on all four platforms.

## 8. Hosting

Static HTTPS hosting is all that's needed (PWAs require HTTPS for camera +
service worker).

- The repo itself is **private** (per plan).
- **Decision:** deploy to **Cloudflare Pages** (free, HTTPS, deploys from a
  private repo). See [`hosting.md`](hosting.md) for what it is and how it works,
  and ADR-006 in [`decisions.md`](decisions.md). GitHub Pages is unsuitable here
  because *private* Pages requires a paid GitHub plan. Set up in M7.

## 9. Key cross-cutting risks

| Risk | Mitigation |
| --- | --- |
| Word-level (dynamic) ASL recognition accuracy is research-grade. | MVP = fingerspelling + curated common signs; expand vocabulary later (M6 stretch). UX "That's what I did" absorbs false negatives. See [`recognition.md`](recognition.md). |
| iOS Safari PWA camera/SW quirks. | Test on real iOS early (M1); document fallbacks. |
| Model size vs. offline first load. | Keep classifier tiny (MLP/GRU); lazy-load + cache; show download progress. |
| Train/serve feature skew. | Single shared normalization spec, mirrored & tested in both TS and Python. |
