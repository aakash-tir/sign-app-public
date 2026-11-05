# Backlog

Unscheduled work only: bugs, known gaps, ideas, scaling items. Each is a dated bullet
under its section. Scheduled work is a GitHub issue, not a bullet here. When an item
is done, delete it: `logs/` and the PR history are the record of finished work.

## Bugs / known gaps
- 2026-11-03 — `SIGN_SENTENCES` has no count assertion, so the bank drifted from the
  docs undetected (57 → 59). Pin the count in `signSentences.test.ts`.
- 2026-11-03 — Real-phone sustained-recognition check of the Capacitor Android wrap
  (P6M2 owner follow-up; the emulator can't hold the vision load). Build with
  `./gradlew assembleDebug` (JAVA_HOME = Android Studio's jbr), then
  `adb install frontend/android/app/build/outputs/apk/debug/app-debug.apk`.

## Recognition / model track
- 2026-11-05 — Ship the bake-off's TCN (int8 weights) as the dynamic model, pending
  owner review of `ml/experiments/RESULTS.md` (#64). It scored honest top-1 0.741 against
  0.698, at 156 KB against 698 KB. Needs `sign_ml` export, an app runtime check,
  per-sign gate numbers and on-camera checks.
- 2026-11-05 — A CUDA PyTorch build (in a separate environment, so the `ml/` lock is
  unchanged) would speed up the ~5 h CPU cross-validation runs, if more bake-off rounds
  are planned.
- 2026-11-03 — Push `school` back over the honest 0.50 gate (published, grandfathered at
  0.49). Find its new confuser with `dynamic_pipeline diagnose`, then drop or fetch.
  Low priority.
- 2026-11-03 — P4M6 targeted data collection. Low value: P4M2 showed the low signs are
  under-separated, not data-starved.
- 2026-11-03 — J and Z fingerspelling (motion letters). They're excluded from the 24-letter
  static model, and the alphabet path waits for them (Phase 6 Q-answers).
- 2026-11-03 — Vocabulary expansion for the 13 curriculum placeholder slots
  (`PRIORITY_WORDS` from P6M1) runs as separate model-track milestones.

## Learner app / content
- 2026-11-03 — Tune the Phase-5 per-level sentence length bands and grow the sentence
  bank as the vocabulary grows.
- 2026-11-03 — Visual polish of the teal learner look past the P6M7 first pass. Waits on
  owner review.

## Platform / store
- 2026-11-03 — iOS build needs macOS CI (GitHub Actions macOS runner) and owner-gated
  signing. Not started.

## Tooling
- 2026-11-03 — Code-only knowledge graph. Running a full `/graphify` with semantic
  extraction would add the `.claude/docs/` design notes, at some LLM cost.
