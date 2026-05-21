# Progress

Live status tracker. Update at the start/end of every milestone. Milestone detail
is in [`docs/milestones.md`](docs/milestones.md).

## Current state

- **Phase:** **M2 ✅ merged** (PR #3) + **real-data training** — the
  fingerspelling model is now trained on the real **ASL Alphabet** dataset
  (24 static letters, ~99.5% held-out accuracy), replacing the synthetic model.
- **Next milestone:** **M3 — Word bank & domain logic** (not started).
- **Repo:** https://github.com/aakash-tir/sign-app (private).
- **Blocked on:** owner's go-ahead to begin M3.

## Milestone checklist

| Milestone | Status | Branch | PR |
| --- | --- | --- | --- |
| M0 — Foundation & tooling | ☑ merged | `milestone/M0-foundation` | [#1](https://github.com/aakash-tir/sign-app/pull/1) |
| M1 — Camera + hand tracking | ☑ merged | `milestone/M1-camera-landmarks` | [#2](https://github.com/aakash-tir/sign-app/pull/2) |
| M2 — Recognition (fingerspelling MVP) | ☑ merged | `milestone/M2-recognition-static` | [#3](https://github.com/aakash-tir/sign-app/pull/3) |
| M3 — Word bank & domain logic | ☐ not started | `milestone/M3-domain` | — |
| M4 — Practice mode UI | ☐ not started | `milestone/M4-practice-ui` | — |
| M5 — Learn mode + levels | ☐ not started | `milestone/M5-learn` | — |
| M6 — Dynamic signs (stretch) | ☐ not started | `milestone/M6-dynamic` | — |
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
