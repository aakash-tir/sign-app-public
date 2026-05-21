# Milestones

> Each milestone = its own branch → PR → **squash-merge** into `main`. A milestone
> may only merge once **all tests pass** and **all quality gates are green**
> (Python: `ruff format` + `ruff check` + `mypy .` + `pytest`; Frontend:
> Prettier + ESLint + `tsc --noEmit` + Vitest + Playwright). Acceptance criteria
> reference the `FR-*` IDs from [`../project-context.md`](../project-context.md).
>
> Status is tracked in [`../progress.md`](../progress.md).

## Conventions

- **Branch name:** `milestone/MX-short-slug` (e.g. `milestone/M1-camera-landmarks`).
- **PR:** opens against `main`, squash-merge only, milestone summary in the body.
- **Definition of Done (every milestone):**
  1. Feature(s) implemented.
  2. Tests added that prove the feature(s) work.
  3. All gates green locally **and** in CI.
  4. Docs in `.claude/` updated (especially `progress.md` + any design changes).
  5. PR squash-merged into `main`.

---

## M0 — Foundation & tooling

**Goal:** an installable empty PWA + the full monorepo toolchain + CI + private
repo, so every later milestone has working gates from day one.

Deliverables:
- Private **GitHub repository** created; `git init`, `main` branch.
- Monorepo layout per [`architecture.md`](architecture.md) §3 (`frontend/`, `ml/`).
- `frontend/`: Vite + React + TS (strict) + `vite-plugin-pwa`; installs as a PWA
  with manifest + service worker; ESLint + Prettier + Vitest + Playwright wired.
- `ml/`: `uv` project; ruff + mypy + pytest configured; placeholder package.
- `.github/workflows/`: CI runs frontend gates and ml gates independently.

Acceptance:
- App shell loads and is installable (FR-1 skeleton); `tsc`, ESLint, Prettier,
  Vitest, `ruff`, `mypy`, `pytest` all pass (even if suites are minimal).
- CI green on the PR.

Tests: smoke test that the app shell renders; trivial Python test so `pytest`
runs; CI proves all gates execute.

---

## M1 — Camera + hand-tracking foundation

**Goal:** live landmarks on screen across platforms.

Deliverables:
- Camera capture via `getUserMedia` with permission/error handling (FR-2).
- `@mediapipe/tasks-vision` Hand Landmarker integrated; live landmark overlay.
- Shared **normalization** utility (TS) per [`recognition.md`](recognition.md) §5,
  with a golden-vector fixture.

Acceptance:
- Live 21-point hand landmarks render at interactive FPS on desktop **and** a real
  mobile browser (incl. iOS Safari sanity check).
- Normalization unit-tested against golden vectors.

Tests: Vitest for normalization; Playwright check that the camera/landmark view
mounts and requests permission (mock stream in CI).

---

## M2 — Recognition pipeline: fingerspelling MVP

**Goal:** end-to-end static-sign recognition (the full vertical slice).

Deliverables:
- `ml/`: extract landmarks from an ASL-alphabet dataset, train static MLP, export
  to TF.js (FR-3). Mirror the normalization spec in Python with a matching golden
  fixture.
- `frontend/`: load the TF.js model, classify static signs live with confidence
  threshold + temporal debounce; cache the model for offline.

Acceptance:
- Recognizes ASL alphabet letters above threshold in the live app.
- Python pipeline reproducible; eval reports per-letter accuracy.
- TS and Python normalization golden vectors agree (no train/serve skew).

Tests: pytest for extract/train/export shapes + the eval metric; Vitest for the
inference adapter (label/confidence mapping, debounce); Playwright happy-path with
a stubbed model.

---

## M3 — Word bank & domain logic (Practice core, no UI)

**Goal:** the pure, framework-free domain layer — the part the spec is most
precise about — fully tested before any UI.

Deliverables:
- IndexedDB schema via Dexie (FR-11): `Word`, `WordProgress`, session state.
- Bucket state machine: need-practice/confident with promotion-at-3 and
  demotion-on-wrong (FR-8) per [`architecture.md`](architecture.md) §5.
- Practice **selection algorithm**: 1:2 bias + no-repeat-within-10 (FR-10) per
  [`architecture.md`](architecture.md) §6.

Acceptance:
- Every bucket-transition rule covered by unit tests, incl. edge cases.
- Selection algorithm tested for: <3 words, single-bucket bank, ≤10-word window
  shrink, and 1:2 ratio holding *on average* over a long run.
- Persistence round-trips through IndexedDB.

Tests: Vitest (domain logic is pure → fast, deterministic with seeded RNG).

---

## M4 — Practice mode UI

**Goal:** the full Practice loop on top of M2 + M3.

Deliverables:
- Display word → capture sign → "Correct" → next (FR-7).
- "I forgot" reveals the sign; "That's what I did" overrides to correct (FR-9).
- Wire correct/incorrect (incl. override) into bucket transitions.
- Resolve the open question: does "I forgot" alone count as wrong? (default: yes.)

Acceptance:
- Full practice session works on a device; override path forces correct and
  advances promotion counters.
- No "incorrect" screen ever appears.

Tests: Playwright component/e2e for the loop including both "I forgot" and "That's
what I did" branches (with stubbed recognition).

---

## M5 — Learn mode + levels + curriculum

**Goal:** guided acquisition with difficulty levels and sentence usage per ADR-009.

Deliverables:
- Level model + behavior (FR-4) per ADR-009: beginner (from scratch, sentences
  **off** until ≥20 confident words → small 2–4-sign sentences), intermediate /
  expert (sentences **on** from the start).
- Optional **placement/self-assessment** for intermediate/expert to seed known
  signs as `confident`.
- **Level reassignment** (FR-13, ADR-010): change level up/down any time from
  settings, non-destructively (progress preserved); sentence enablement recomputes.
- Curriculum/content: signs with reference media + meanings (concrete sign→level
  vocab lists).
- Learn flow: show sign + meaning → copy → verify → "Good job" (FR-5).
- Sentence usage (FR-6): a sign becomes sentence-eligible once `confident`;
  sentences are built **only** from confident words; track correct sentence copying.

Acceptance:
- Learn flow works for a starter curriculum at each level.
- Sentences appear only when ADR-009 gating allows: verify beginner is **off**
  below 20 and **on** at ≥20 confident words; intermediate/expert on from start;
  every sentence contains only confident words; copying is tracked.
- Reassigning level (up or down) preserves the word bank/buckets and recomputes
  sentence enablement correctly (incl. the beginner latch behavior).

Tests: Vitest for level-gating + sentence-eligibility logic (pure, seeded RNG);
Playwright for the learn flow incl. the beginner sentence-unlock transition.

---

## M6 — Dynamic word-level signs (stretch)

**Goal:** expand beyond fingerspelling to a curated set of dynamic signs.

Deliverables:
- `ml/`: sequence model (Holistic/Pose + Hands → GRU/LSTM) trained on WLASL100
  (or a curated subset); export to TF.js.
- `frontend/`: windowed sequence capture + inference.

Acceptance:
- Recognizes the curated dynamic-sign set with **documented, measured** accuracy.
- Vocabulary expansion is explicitly gated on accuracy (see
  [`recognition.md`](recognition.md) §6).

Tests: pytest eval thresholds; Vitest for the windowing/inference adapter.

> This milestone carries the project's main accuracy risk. It is intentionally
> *after* a usable fingerspelling product so the app is shippable without it.

---

## M7 — Offline, polish & deploy

**Goal:** production-quality PWA, fully offline, deployed.

Deliverables:
- Full offline: app shell + MediaPipe assets + model all cached (FR-12).
- Install prompts/UX; icons; responsive layout for phone + desktop.
- Deploy to static HTTPS hosting (recommend **Cloudflare Pages** for a private
  repo — see [`architecture.md`](architecture.md) §8 / ADR-006).

Acceptance:
- Works offline after first load; Lighthouse PWA checks pass; live deployed URL.

Tests: Playwright offline scenario (service worker serves shell + model);
Lighthouse/PWA audit in CI if feasible.

---

## Dependency graph

```
M0 ─► M1 ─► M2 ─┐
            └───► M4 (needs M2 + M3)
M0 ─────────► M3 ─┘
M5 needs M1 (camera) + M3 (progress model)
M6 needs M2 (pipeline patterns) + M1
M7 needs everything shippable (M1–M5 at minimum)
```
