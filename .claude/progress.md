# Progress

Live status tracker. Update at the start/end of every milestone. Milestone detail
is in [`docs/milestones.md`](docs/milestones.md).

## Current state

- **Phase:** **M5 ✅ merged** (PR #7) — levels + profile (ADR-009/010), routing
  (React Router), Settings (level reassign + placement), and Learn mode (guided
  letters + sentence-gated spell-a-word). Core app modes are now in place.
- **Next milestone:** **M6 — Dynamic word-level signs** — now **scoped into four
  sub-milestones** (M6.1–M6.4) in [`docs/milestones.md`](docs/milestones.md).
  Decisions locked: WLASL via Kaggle + own extraction (ADR-014); curated ~15–25-sign
  accuracy-gated starter (ADR-014); MediaPipe HolisticLandmarker (ADR-013); TF.js
  dynamic runtime (ADR-015).
- **Repo:** https://github.com/aakash-tir/sign-app (private).
- **In progress:** **M6.1** — dynamic landmark foundation implemented; all gates
  green locally (ml: ruff/mypy/20 pytest; frontend: prettier/eslint/tsc/93
  vitest/10 playwright). Awaiting commit + PR.
- **M6.2 data ready:** owner downloaded WLASL and it's consolidated (gitignored) at
  `ml/data/wlasl/` — `videos/` (≈11,980 clips), `WLASL_v0.3.json`, `nslt_*.json`,
  `wlasl_class_list.txt`, `missing.txt`. So M6.2 is unblocked on data.

## Milestone checklist

| Milestone | Status | Branch | PR |
| --- | --- | --- | --- |
| M0 — Foundation & tooling | ☑ merged | `milestone/M0-foundation` | [#1](https://github.com/aakash-tir/sign-app/pull/1) |
| M1 — Camera + hand tracking | ☑ merged | `milestone/M1-camera-landmarks` | [#2](https://github.com/aakash-tir/sign-app/pull/2) |
| M2 — Recognition (fingerspelling MVP) | ☑ merged | `milestone/M2-recognition-static` | [#3](https://github.com/aakash-tir/sign-app/pull/3) |
| M3 — Word bank & domain logic | ☑ merged | `milestone/M3-domain` | [#5](https://github.com/aakash-tir/sign-app/pull/5) |
| M4 — Practice mode UI | ☑ merged | `milestone/M4-practice-ui` | [#6](https://github.com/aakash-tir/sign-app/pull/6) |
| M5 — Learn mode + levels | ☑ merged | `milestone/M5-learn` | [#7](https://github.com/aakash-tir/sign-app/pull/7) |
| M6 — Dynamic signs (stretch) | ☐ not started (scoped) | — | — |
| ↳ M6.1 — Dynamic landmark foundation | ◐ in progress | `milestone/M6.1-dynamic-foundation` | — |
| ↳ M6.2 — Dataset + training pipeline | ☐ not started | `milestone/M6.2-wlasl-training` | — |
| ↳ M6.3 — Runtime inference + integration | ☐ not started | `milestone/M6.3-dynamic-runtime` | — |
| ↳ M6.4 — Vocab scale-up + accuracy gate | ☐ not started | `milestone/M6.4-vocab-gate` | — |
| M7 — Offline, polish & deploy | ☐ not started | `milestone/M7-deploy` | — |

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
