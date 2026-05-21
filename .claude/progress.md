# Progress

Live status tracker. Update at the start/end of every milestone. Milestone detail
is in [`docs/milestones.md`](docs/milestones.md).

## Current state

- **Phase:** **M6 ✅ merged** (PR #8 + #11) — dynamic word-level signs end to end:
  Holistic capture + frozen 161-d normalization (ADR-013), PyTorch→ONNX→
  onnxruntime-web runtime (ADR-015), 5-fold-CV accuracy gate (16/20 signs ship),
  and dynamic signs **merged into Practice & Learn** via a unified single-camera
  recognizer. The app now teaches/verifies fingerspelling **and** word-level signs.
- **Current milestone:** **M7 — Offline, polish & deploy** (in progress, branch
  `milestone/M7-deploy`). **Done:** offline precache (app shell + ONNX model) +
  runtime-cache CDN assets (MediaPipe/ONNX WASM + `.task` models); code-split
  MediaPipe + onnxruntime-web into lazy chunks (main bundle 416 kB, no >500 kB
  warning); dropped the unused 26 MB ORT WASM from `dist` (Cloudflare 25 MB/file
  limit); offline Playwright test (FR-12). **Blocked on owner:** the **Cloudflare
  Pages deploy needs the owner's account/login** (ADR-006).
- **Repo:** https://github.com/aakash-tir/sign-app (private).
- **Dynamic model (20-sign starter, 193 clips, GRU + augmentation):** 5-fold CV
  **top-1 ≈62% / top-5 ≈95%**. **Accuracy gate (≥0.50 per-gloss top-1): 16/20 signs
  ship**; held back: `like` (0.00), `bad`, `happy`, `thank you`. Per-gloss table in
  `recognition.md` §6.1. ONNX (296 KB) bundled at `frontend/public/models/dynamic/`;
  the app only prompts shipped glosses (`content/dynamicVocab.ts`). Real-camera
  accuracy will be lower (domain shift); "That's what I did" absorbs misses.
- **Data:** WLASL + ASL-Alphabet consolidated (gitignored) under `ml/data/`;
  holistic model at `ml/models/holistic_landmarker.task`.

## Milestone checklist

| Milestone | Status | Branch | PR |
| --- | --- | --- | --- |
| M0 — Foundation & tooling | ☑ merged | `milestone/M0-foundation` | [#1](https://github.com/aakash-tir/sign-app/pull/1) |
| M1 — Camera + hand tracking | ☑ merged | `milestone/M1-camera-landmarks` | [#2](https://github.com/aakash-tir/sign-app/pull/2) |
| M2 — Recognition (fingerspelling MVP) | ☑ merged | `milestone/M2-recognition-static` | [#3](https://github.com/aakash-tir/sign-app/pull/3) |
| M3 — Word bank & domain logic | ☑ merged | `milestone/M3-domain` | [#5](https://github.com/aakash-tir/sign-app/pull/5) |
| M4 — Practice mode UI | ☑ merged | `milestone/M4-practice-ui` | [#6](https://github.com/aakash-tir/sign-app/pull/6) |
| M5 — Learn mode + levels | ☑ merged | `milestone/M5-learn` | [#7](https://github.com/aakash-tir/sign-app/pull/7) |
| M6 — Dynamic signs (stretch) | ☑ merged | (sub-milestones below) | [#8](https://github.com/aakash-tir/sign-app/pull/8) + [#11](https://github.com/aakash-tir/sign-app/pull/11) |
| ↳ M6.1 — Dynamic landmark foundation | ☑ merged | `milestone/M6.1-dynamic-foundation` | [#8](https://github.com/aakash-tir/sign-app/pull/8) |
| ↳ M6.2 — Dataset + training pipeline | ☑ merged | `milestone/M6.4-vocab-gate` | [#11](https://github.com/aakash-tir/sign-app/pull/11) |
| ↳ M6.3 — Runtime inference + Signs view | ☑ merged | `milestone/M6.4-vocab-gate` | [#11](https://github.com/aakash-tir/sign-app/pull/11) |
| ↳ M6.4 — Accuracy gate + Practice/Learn merge | ☑ merged | `milestone/M6.4-vocab-gate` | [#11](https://github.com/aakash-tir/sign-app/pull/11) |
| M7 — Offline, polish & deploy | ◐ in progress | `milestone/M7-deploy` | — |

Legend: ☐ not started · ◐ in progress · ☑ merged

## Decisions made during planning

- ASL · PWA-first React/TS · on-device MediaPipe + TF.js · Python build-time only.
  Full rationale in [`docs/decisions.md`](docs/decisions.md).

## Open questions to resolve (by milestone)

- ~~Q1 "I forgot" alone = wrong?~~ ✅ Resolved: yes; "That's what I did" overrides to correct via deferred commit (ADR-008).
- ~~Q2 proficiency threshold for sentence unlock~~ ✅ Resolved: sentence-eligible at `confident`; beginner needs ≥20 confident words (ADR-009).
- ~~Q3 sign→level mapping~~ ✅ Resolved: level behavior fixed (ADR-009); vocab lists are M5 content.
- ~~Q4 hosting provider~~ ✅ Resolved: Cloudflare Pages (ADR-006, docs/hosting.md).
- Q5 dynamic vocabulary expansion extent → M6

## Log

- **2026-05-20** — Plan formatted; `.claude/` documentation set authored
  (product spec, architecture, recognition/ML research, milestones, decisions,
  rules). Tech stack confirmed with owner. Awaiting go-ahead for M0.
- **2026-05-20** — Resolved Q1 ("I forgot" = wrong; "That's what I did" overrides
  to correct via deferred-commit model, ADR-008) and Q4 (hosting = Cloudflare
  Pages, ADR-006). Added `docs/hosting.md` explaining Cloudflare for newcomers.
- **2026-05-20** — Resolved Q2 + Q3 via ADR-009 (level definitions + behavior;
  sentences gated by level, beginner unlocks small 2–4-sign sentences at ≥20
  confident words, sentences built only from confident words). Added the
  "stop and ask for secrets/credentials" rule to the workflow rules. Only Q5
  (dynamic-vocab expansion, M6, accuracy-gated) remains — non-blocking.
- **2026-05-20** — Added FR-13 / ADR-010: non-destructive level reassignment
  (change level up/down any time, progress preserved, sentence enablement
  recomputes; beginner unlock latched). Lands in M5.
- **2026-05-20** — **M0 merged (PR #1).** Created private repo
  `aakash-tir/sign-app`; monorepo scaffold: frontend (Vite + React 19 + TS
  strict PWA via vite-plugin-pwa, gates = Prettier/ESLint/tsc/Vitest/Playwright)
  and ml (uv project, gates = ruff/mypy/pytest). CI runs both lanes; all green.
- **2026-05-20** — **M1 merged (PR #2).** Camera (`useCamera`) + MediaPipe Hand
  Landmarker (`mediapipeDetector`) behind a `LandmarkDetector` interface; live
  21-point overlay (`CameraView` + `drawLandmarks`); pure-TS `normalizeHand­Landmarks`
  with golden-vector fixture (10 Vitest tests) and a fake-media Playwright camera
  test. Follow-ups: bundle/cache MediaPipe assets for offline (later); manual iOS
  Safari device check (can't automate).
- **2026-05-20** — **M2 merged (PR #3).** End-to-end fingerspelling: `ml/`
  pipeline (sklearn MLP → JSON `mlp-1` export, ADR-011) with Python normalization
  verified against the shared golden fixture; frontend `mlpClassifier` +
  `signClassifier` (skew-guard) + `debounce`, wired into `CameraView`.
  **Follow-up (needs Kaggle creds):** train on the real ASL Alphabet dataset via
  `extract.py` — current model is synthetic-trained, so it doesn't recognize real
  letters yet.
- **2026-05-20** — **Real-data training done** (branch `milestone/M2-real-data`).
  Owner downloaded the ASL Alphabet dataset; installed MediaPipe (`images` extra,
  Python 3.13), extracted ~10.8k landmark samples (24 letters × ~500 imgs), trained
  + exported the real model → **~99.5%** held-out accuracy. Dataset + `ml/models/`
  gitignored. Caveat: held-out split shares signer/conditions; real-world camera
  accuracy will be lower (domain shift).
- **2026-05-20** — Live testing: most letters recognize well. **Known issues
  (accepted for now, fix later):** S-like fist letters (A/E/M/N/S/T/O) sometimes
  all read as "S"; J/Z (dynamic) misclassified — not in the static model, slated
  for M6. Details in `docs/recognition.md`.
- **2026-05-20** — **M3 merged (PR #5).** Pure domain layer: `buckets`
  (promote-at-3/demote) + `selection` (`PracticeSession`, 1:2 bias,
  no-repeat-within-10, seeded RNG) + Dexie persistence (`WordBankRepo`). 42
  Vitest incl. the 1:2 ratio over a long seeded run and an IndexedDB round-trip
  (fake-indexeddb). No UI.
- **2026-05-20** — **M4 merged (PR #6).** Practice mode UI on the M2 recognizer +
  M3 domain: `useSignRecognition` hook (shared with CameraView), `PracticeMode`
  loop with deferred-commit (I forgot / that's-what-I-did override / Next),
  bank = 24 letters (ADR-012), App mode toggle. Vitest component (mocked
  recognition) + Playwright button branches. Routing deferred to M5.
- **2026-05-21** — **M7 started: offline + code-split.** vite-plugin-pwa now
  precaches the app shell + bundled ONNX model and runtime-caches the CDN
  recognition assets (MediaPipe/ONNX WASM + `.task` models, CacheFirst) →
  recognition works offline after first load. Code-split MediaPipe + onnxruntime-web
  via dynamic `import()` (main bundle 416 kB, chunk warning gone); a Vite plugin
  drops onnxruntime-web's unused 26 MB WASM from `dist` (it loads from CDN; would
  break Cloudflare's 25 MB/file limit). Added an offline Playwright test (FR-12).
  Gates green (118 vitest / 13 playwright). **Remaining: Cloudflare Pages deploy
  (needs owner account/login, ADR-006).**
- **2026-05-21** — **M6 merged.** Squash-merged to `main`: **#8** (M6.1) and **#11**
  (M6.2–M6.4 consolidated — the stacked squash-merge tangled overlapping doc edits,
  so M6.2/6.3/6.4 landed together; #9/#10 closed as superseded). CI green both lanes
  on both PRs. M6 (dynamic word-level signs) is done. Next: **M7** (offline + deploy).
- **2026-05-21** — **M6.4: Practice/Learn merge (full).** Built a unified
  single-camera recognizer (`useUnifiedSignRecognition`): one Holistic detector
  feeds both the static letter MLP (on the detected hand) and the dynamic ONNX
  classifier (on the 30-frame window), switched by a per-prompt mode — so one
  camera serves letters and signs. Practice now seeds letters + 16 shipped signs
  (`ensurePresent`) and prompts both; Learn gained a "Learn signs" view with
  dictionary reference links. `isDynamicGloss` routes each item. +6 vitest (118);
  all gates green incl. 12 playwright. **M6 feature-complete** (kept local per
  owner; no PRs yet).
- **2026-05-21** — **M6.4: CV eval + accuracy gate + reference media.** Added
  5-fold stratified CV (`cross_validate`, `stratified_folds`, `crossval` CLI) →
  **top-1 ≈62% / top-5 ≈95%**; documented per-gloss table in `recognition.md` §6.1.
  **Ship gate at 0.50 → 16/20 glosses ship** (`content/dynamicVocab.ts`; held back
  like/bad/happy/thank you); Signs view only prompts shipped glosses. Reference
  media = external ASL-dictionary links (`content/signReference.ts` → signasl.org)
  shown in the Signs view. **Q5 resolved** (stay at curated 20, no WLASL100
  expansion now). +1 pytest, +6 vitest. All gates green. **Remaining M6.4:** the
  deeper curriculum merge into the letter-based Practice/Learn bucket flow.
- **2026-05-21** — **M6.4 started: accuracy push** (branch
  `milestone/M6.4-vocab-gate`, stacked on M6.3). Added landmark-sequence
  augmentation (`augment_sequences`: scale/noise jitter + frame dropout, presence
  flags preserved), per-epoch shuffle fix, Adam weight decay. Retrained →
  **top-1 52.4% / top-5 95.2%** (from 47.6% / 90.5%); refreshed bundled ONNX.
  +3 pytest (45). Decisions for the rest of M6.4: **push accuracy first** and
  **Learn reference media = external ASL-dictionary links**. Still open: a robust
  per-gloss accuracy estimate (tiny test split), the ship gate, curriculum merge,
  and Q5.
- **2026-05-21** — **M6.3 dynamic runtime + Signs view** (branch
  `milestone/M6.3-dynamic-runtime`, stacked on M6.2). Added **onnxruntime-web**;
  trained ONNX model bundled at `frontend/public/models/dynamic/`. Pure classifier
  helpers (`softmax`/`topPrediction`/per-sign `accepts`) + skew guard
  (`assertMetadataCompatible`) in `dynamicClassifier.ts`; ONNX impl in
  `onnxDynamicClassifier.ts`; `useDynamicSignRecognition` (camera + Holistic +
  `FrameWindow` + throttled async inference) + live overlay (`drawHolistic`); new
  `/signs` route (`DynamicSignView`). +16 vitest (109), +2 playwright (12); all
  gates green. **Curriculum merge into Learn/Practice + reference media + accuracy
  gate moved to M6.4.**
- **2026-05-21** — **M6.2 pipeline + first model** (branch
  `milestone/M6.2-wlasl-training`, stacked on M6.1). WLASL adapter (`wlasl.py`),
  holistic extraction (`dynamic_extract.py`, IMAGE-mode fresh-detector-per-clip),
  GRU training (`dynamic_model.py`), ONNX export (`dynamic_export.py`), CLI
  (`dynamic_pipeline.py`). **Toolchain pivot (ADR-015): TF.js → PyTorch/ONNX/
  onnxruntime-web** — `tensorflowjs` has no Windows wheels and TF pins numpy<2.2
  (conflicts with our numpy 2.4.6). Extracted 193 clips for the 20-sign starter →
  trained GRU → **top-1 47.6% / top-5 90.5%** (test n=21); ONNX 296 KB exported.
  +22 pytest (now 42); all gates green. Optional extras `video` (mediapipe+opencv)
  and `train` (torch+onnx). Datasets/model artifacts gitignored under `ml/`.
- **2026-05-20** — **M6.1 implemented** (branch `milestone/M6.1-dynamic-foundation`).
  Headless dynamic-capture foundation: `HolisticDetector` interface +
  HolisticLandmarker-backed impl (`holisticDetector.ts`); frozen dynamic
  normalization (`dynamicNormalization.ts`, spec `recognition.md` §5.1, id
  `pose-shoulder-hands-v1`, 161-d frame); pure `FrameWindow` + FPS-throttle
  (`frameWindow.ts`); Python mirror (`dynamic_normalization.py`) + committed
  fixture generator (`golden_dynamic.py`) → shared golden fixture. New tests: 3
  Vitest files (+29) and 1 pytest file (+9); all gates green locally. No UI/model
  (deferred to M6.3). Also: consolidated the owner's WLASL download into
  `ml/data/wlasl/` and gitignored it. Awaiting commit + PR.
- **2026-05-20** — **M6 scoped** into four sub-milestones (M6.1 dynamic landmark
  foundation → M6.2 dataset + training → M6.3 runtime inference + integration →
  M6.4 vocab scale-up + accuracy gate); detail in `docs/milestones.md`. Owner
  decisions captured as ADR-013 (HolisticLandmarker), ADR-014 (WLASL via Kaggle +
  our own extraction; curated ~15–25-sign accuracy-gated starter), ADR-015 (TF.js
  dynamic runtime). Q5 (vocab expansion) now revisited in M6.4. Pending owner
  action for M6.2: download the WLASL Kaggle mirror (account already held; dataset
  gitignored). Awaiting go-ahead to start M6.1.
- **2026-05-20** — **M5 merged (PR #7).** Levels + profile (ADR-009/010, Dexie
  v2): `sentencesEnabled` + unlock latch, non-destructive `setLevel`, placement
  (`markKnown`). React Router (Practice/Learn/Settings/Camera). SettingsView and
  LearnMode (guided letters + gated spell-a-word). 64 Vitest + 10 Playwright.
  Follow-up: code-split MediaPipe (>500 kB chunk warning) in M7.
