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

**Goal:** expand beyond static fingerspelling to **dynamic, word-level signs** —
signs with motion, two hands, and upper-body position captured over a window of
frames. This is the project's **main accuracy risk** (research: ~75% top-1 on
WLASL100, ~30–38% on full WLASL2000), so M6 is split into **four sub-milestones**
that de-risk normalization parity first, prove one vertical slice, then scale the
vocabulary **only as far as measured accuracy allows**.

**Decisions locked for M6** (owner, 2026-05-20):
- **Dataset:** **WLASL** via a **Kaggle** mirror, with **our own MediaPipe
  extraction** (not pre-encoded landmarks) so train/serve parity stays under our
  golden-vector guarantee. See ADR-014. *(Owner already has a Kaggle account from
  the M2 ASL-Alphabet download — no new credential, but the download is an owner
  action; see [`../progress.md`](../progress.md).)*
- **Vocabulary:** a **small curated starter (~15–25 high-frequency signs)**,
  **accuracy-gated**, then expand. Not the full WLASL100 up front. See ADR-014.
- **Landmark stack:** MediaPipe **HolisticLandmarker** (Tasks Vision; pose + hands
  in one model), not the deprecated legacy Holistic. See ADR-013.
- **Runtime:** dynamic model trained in **PyTorch**, exported to **ONNX**, run with
  **onnxruntime-web** (the JSON-MLP path of ADR-011 is static-only). TF.js was
  rejected — `tensorflowjs` has no Windows wheels and conflicts with our numpy. See
  ADR-015.

> Each sub-milestone is its own branch → PR → squash-merge, with all gates green,
> per the working agreement. Sub-dependency: **M6.1 → M6.2 → M6.3 → M6.4**; M6.1
> and the dataset-ingestion half of M6.2 can be worked in parallel, but M6.3 needs
> both M6.1 (capture/normalization) and M6.2 (an exported model).

---

### M6.1 — Dynamic landmark foundation (capture + normalization parity)

**Goal:** the **headless** capture + normalization layer for dynamic signs, with a
**frozen, golden-vector-tested** normalization shared TS↔Python. **No model and no
UI yet** — like M3, this lands the hard-to-get-right core fully unit-tested before
any UI. (Live holistic overlay + camera wiring is **M6.3**.)

Deliverables:
- `frontend/src/recognition/`: a **HolisticDetector** interface + a MediaPipe
  **HolisticLandmarker**-backed implementation that emits per-frame
  `{ pose, leftHand, rightHand }` (mirrors the existing `LandmarkDetector` pattern;
  left/right slots give handedness for free). The pure result→observation mapper is
  unit-tested; live camera wiring is deferred to M6.3.
- **Dynamic normalization** (`dynamicNormalization.ts`): pose **shoulder-centered +
  shoulder-width-scaled** block over a fixed upper-body landmark subset, plus
  per-hand shape via the existing `normalizeHandLandmarks`, plus hand-presence flags
  → one fixed-length **frame feature vector**. Frozen + documented in
  [`recognition.md`](recognition.md) §5.
- **Sliding-window frame buffer** + FPS-throttle helper (pure TS): fixed ~30-frame
  window, front zero-padding for short sequences, missing-hand handling.
  Deterministically testable.
- `ml/src/sign_ml/dynamic_normalization.py`: a numerically identical Python mirror.
- **New golden-vector fixture** (`dynamic-normalization.golden.json`): same frame
  inputs → same normalized feature vector in TS and Python.

Acceptance:
- Dynamic normalization reproduces the new golden vectors **on both sides** to 1e-9
  (no train/serve skew).
- Window buffer + throttle behavior unit-tested (full/partial windows, padding,
  reset, sampling cadence).
- The HolisticDetector mapper is unit-tested; the frontend `tsc`/lint gates pass
  with the MediaPipe-backed detector compiling behind the interface.

Tests: Vitest (normalization parity + windowing, seeded); pytest (normalization
shapes + golden-vector parity). Tiny synthetic fixtures only — **no dataset needed**.

---

### M6.2 — Dataset ingestion + sequence-model training (curated subset)

**Goal:** a reproducible Python pipeline that turns the curated WLASL subset into a
trained, exported dynamic model.

Deliverables:
- `ml/src/sign_ml/data/`: **WLASL adapter** — parse the gloss metadata, select the
  curated subset, locate clips, and extract → cached landmark-**sequence** arrays
  using the M6.1 extractor. **Report coverage** (clips available per gloss after
  filtering/any link rot in the mirror).
- `ml/src/sign_ml/train/`: **GRU/LSTM** sequence model (research baseline ≈ 2 dense
  + 2 LSTM); seeded; logs config + metrics.
- `ml/src/sign_ml/` export: export to **ONNX** (`torch.onnx`); record dataset,
  subset, and **measured accuracy** alongside the artifact (ADR-007 gate inputs).
- `ml/src/sign_ml/eval/`: top-1 / top-5 per subset.

Acceptance:
- Pipeline runs end-to-end on the curated subset and reproduces its metrics from a
  seed; an exported **ONNX** model + an accuracy report are produced.
- Python normalization still matches the M6.1 golden vectors.

Tests: pytest for extract/train/export **shapes** + the eval metric on **tiny
fixtures** (not the full dataset).

> **Owner action / credential:** download the WLASL Kaggle mirror (account already
> held). Dataset + `ml/models/` are **gitignored**, exactly like the M2 ASL-Alphabet
> data. Per [`../rules/workflow.md`](../rules/workflow.md), this is flagged, not
> assumed.

---

### M6.3 — Runtime dynamic inference + a dedicated Signs view

**Goal:** the app recognizes dynamic signs **live** through the full runtime stack,
on a dedicated surface. (Merging dynamic glosses into the existing letter-based
Learn/Practice + reference media is **M6.4**, alongside the accuracy gate — the
static modes are letter-based and the model is still a baseline, so a clean merge
belongs with the content work.)

Deliverables:
- Add the **onnxruntime-web** dependency; load the exported ONNX model
  (`createOnnxDynamicClassifier`) and the trained model into
  `frontend/public/models/dynamic/`. *(Service-worker caching for offline is M7.)*
- `DynamicClassifier` interface + ONNX impl behind it; pure helpers (`softmax`,
  `topPrediction`, **per-sign `accepts`** — verification, not open-set N-way) and a
  **skew guard** (`assertMetadataCompatible`) asserting the model's `normalization`
  id + window/feature shape at load (as the static MLP path does).
- `useDynamicSignRecognition`: camera + Holistic detector + `FrameWindow` +
  throttled async inference; **live Holistic overlay** (`drawHolistic`, deferred
  from M6.1); always releases the camera/detector on unmount.
- `DynamicSignView` (route `/signs`): pick a target gloss, perform it, see the live
  prediction + per-sign acceptance.

Acceptance:
- A curated dynamic sign can be prompted on the Signs view and verified live; the
  loaded model is rejected if its normalization id doesn't match the build.
- All gates green (pure classifier helpers + skew guard unit-tested; Playwright
  mounts the view and turns the camera on with a fake stream).

Tests: Vitest for the classifier helpers + skew guard + the view (mocked hook);
Playwright happy-path for the Signs view.

---

### M6.4 — Curated vocabulary scale-up + accuracy gate

**Goal:** lift accuracy, ship the curated dynamic vocabulary at **documented**
accuracy, **merge it into Learn/Practice**, and resolve the open vocabulary
question (Q5).

Deliverables:
- Improve the M6.2 baseline (more clips/gloss, augmentation, model tuning, and/or
  the owner's pre-extracted landmarks); measure **per-gloss accuracy** on the
  20-sign starter (and expand toward WLASL100 as accuracy allows).
- **Accuracy gate:** only glosses meeting the acceptance bar **ship**; the rest are
  excluded or flagged. Publish measured numbers in [`recognition.md`](recognition.md).
- Reference media/content for each shipped dynamic gloss (Learn mode).
- **Merge dynamic glosses into the word bank / curriculum / levels** and wire the
  M6.3 dynamic recognizer into Learn/Practice (the domain layer is already
  word-agnostic — ADR-012); keep the deferred-commit / "That's what I did" valves.
- Resolve **Q5** (how far to expand the dynamic vocabulary) using the accuracy data.

Acceptance:
- Every shipped dynamic gloss has a recorded accuracy at/above the agreed bar; signs
  below it are not shipped.
- The expansion decision (Q5) is recorded with its evidence.

Tests: pytest eval-threshold gate; Vitest for any new content/selection wiring.

> **Optional follow-on (not required for M6):** with real glosses recognized,
> Learn-mode "sentences" could become real multi-sign sequences instead of words
> spelled letter-by-letter (ADR-012). Candidate for a later milestone. **J/Z**
> dynamic fingerspelling letters are also a possible hand-only add-on here *if*
> motion data can be sourced (the static ASL-Alphabet set lacks them).

> M6 carries the project's main accuracy risk. It sits **after** a usable
> fingerspelling product (M2–M5) so the app is already shippable without it.

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
