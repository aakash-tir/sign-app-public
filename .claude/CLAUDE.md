# Sign App — Project Guide

A cross-platform **PWA that teaches American Sign Language (ASL)** by having the
learner perform signs in front of their camera and getting automatic, on-device
feedback. Runs on Windows, Android, iOS, and Linux from one React + TypeScript
codebase; a Python pipeline (build-time only) trains the recognition model.

> **This file is the documentation hub. Read the linked docs before working.**

## Documentation map

| Doc | What's in it |
| --- | --- |
| [`project-context.md`](project-context.md) | **Product spec** — modes, levels, bucket rules, UX. The "what". |
| [`docs/architecture.md`](docs/architecture.md) | **Architecture** — tech stack, repo layout, data model, data flow, hosting. |
| [`docs/recognition.md`](docs/recognition.md) | **ASL recognition & ML pipeline** — MediaPipe + classifier, datasets, risks, research sources. |
| [`docs/milestones.md`](docs/milestones.md) | **Phase 1 milestone plan** — M0–M7 (complete), branches, acceptance criteria, tests. |
| [`docs/phase2.md`](docs/phase2.md) | **Phase 2 plan** — depth & polish milestones (P2M1–P2M5) after M0–M7. |
| [`docs/phase3.md`](docs/phase3.md) | **Phase 3 plan** — accuracy & vocabulary depth (P3M1–P3M3): honest eval, reviewed-dataset expansion toward ~50 signs, landmark-space augmentation. |
| [`docs/phase4.md`](docs/phase4.md) | **Phase 4 plan** — two tracks: **discovery** (P4M1: sign **search** tab, shipped) + **accuracy** (P4M2–P4M8: lift the 18 dynamic signs below the honest 0.50 gate). |
| [`docs/phase5.md`](docs/phase5.md) | **Phase 5 plan** — the **Sentences section** (P5M1–P5M3, shipped): dedicated tab, 59-sentence bank, persisted progress, level bands (ADR-028, FR-20). |
| [`docs/phase6.md`](docs/phase6.md) | **Phase 6 plan** — the **learner app** (P6M1–P6M9, ADR-029): syllabus + teach→recall over two paths, new learner-facing look, dev mode for today's tabs, store-first packaging. |
| [`docs/decisions.md`](docs/decisions.md) | **Decision log (ADRs)** + open questions. |
| [`docs/hosting.md`](docs/hosting.md) | **Hosting** — what Cloudflare Pages is and how we deploy. |
| [`progress.md`](progress.md) | **Live status** — which milestone we're on, what's done. |
| [`rules/`](rules/) | **Coding standards** — frontend, Python, and git/CI workflow. |
| [`../plan.md`](../plan.md) | The owner's plan. **Now holds the Phase 6 learner-app plan** (reformatted 2026-07-10); earlier phase plans live in git history + these `.claude` docs. Phase-2 per-item analysis is in [`../output.md`](../output.md). |

## The 60-second summary

- **Stack:** React + TypeScript + Vite + `vite-plugin-pwa` (runtime).
  **Python** (`uv`, MediaPipe, **scikit-learn** for the static MLP + **PyTorch**
  for the dynamic model) for training only — see ADR-004.
- **Recognition:** MediaPipe Tasks Vision extracts hand/pose landmarks **on-device**,
  then a classifier labels the sign: a **hand-written JSON-weights MLP** for static
  fingerspelling (ADR-011) and an **ONNX model via `onnxruntime-web`** for dynamic
  signs (ADR-015). No video leaves the device; works offline (ADR-002).
  *(No TensorFlow/TF.js anywhere — ADR-002's original "TF.js classifier" was
  superseded by ADR-011 + ADR-015.)*
- **Scope:** MVP = fingerspelling + curated common signs; broad word-level
  recognition is research-hard and phased/accuracy-gated (ADR-007).
- **Persistence:** local-first, IndexedDB via Dexie (ADR-005).

## Working agreement (from the plan — non-negotiable)

1. Work in **milestones**; each milestone is a **branch → PR → squash-merge** into
   `main`.
2. A milestone merges **only when all tests pass and all quality gates are green**:
   - Python (`ml/`): `ruff format` + `ruff check` + `mypy .` + `pytest`.
   - Frontend (`frontend/`): Prettier + ESLint + `tsc --noEmit` + Vitest + Playwright.
3. Every milestone ships **tests proving its features work**.
4. Keep `.claude/` docs current — especially [`progress.md`](progress.md).
5. The repo is **private**.
6. **Stop and ask the owner** for any secret/credential/account-only item (API
   keys, hosting logins, paid sign-ups, dataset auth) — never invent or assume
   them. Explain how to obtain it if the owner doesn't know.

See [`rules/workflow.md`](rules/workflow.md) for the exact branch/PR/gate steps
and the secrets/credentials policy.

## Status

**Phases 1–5 are complete/paused and deployed** — the PWA is live on Cloudflare with
**24 fingerspelling letters + 103 dynamic signs**, a per-finger overlay option, a
persistent shared camera, a redesigned UI, offline in-app sign references, a **Search
tab** (typo/stem-tolerant with a fingerspelling fallback + as-you-type autocomplete, P4M9/P4M11),
and a **Sentences section** (Phase 5). See
[`progress.md`](progress.md); Phase 2 detail in [`docs/phase2.md`](docs/phase2.md).

**✅ Phase 3 (accuracy & vocabulary depth) — all merged + deployed.** Grew the dynamic
recognizer to an **81-gloss MS-ASL ∪ WLASL model** (3583 samples / 163 signers); the
honest ≥ 0.50 gate shipped 63 signs at honest top-1 0.615. *(Superseded by Phase 4 —
now 71 signs at 0.687.)* MS-ASL fetch mechanics are in memory `msasl-download-setup`.

**✅ Phase 4 — discovery shipped; accuracy track ongoing.** Detail in
[`docs/phase4.md`](docs/phase4.md); §6.7–6.15 in [`docs/recognition.md`](docs/recognition.md).

- **Discovery — P4M1 Search tab** ([#26](https://github.com/aakash-tir/sign-app/pull/26))
  + **P4M9 search UX** ([#33](https://github.com/aakash-tir/sign-app/pull/33)):
  type a sign → reference animation + a camera that recognizes it, else "not in the system
  yet". Exact + synonym + **stem + typo-tolerant suggestions**, with a **fingerspelling
  fallback** for spellable misses; reuses `DynamicSignStage` + `SignReferencePlayer`
  (ADR-021, FR-19). P4M9 resolved the P4M1 fuzzy/fingerspell deferrals (frontend-only).
  **P4M11 search autocomplete** adds an as-you-type ranked combobox dropdown (pure
  `autocomplete()` ranker: prefix → substring → fuzzy; keyboard-navigable), resolving
  the last P4M9 deferral (frontend-only).
- **Accuracy + vocabulary track (P4M2–P4M17).** **The recognizer grew from 63 → 103
  shipped signs with per-sign calibrated acceptance — all live.** (Aggregate honest CV
  peaked at 0.732 over the 81-class model; it's 0.691 over the current 114-class model —
  more classes are a harder task, not a regression.)
  - **P4M17 — drop the 3 confusers** ([#42](https://github.com/aakash-tir/sign-app/pull/42)):
    P4M16's new `dance`/`paper`/`slow` were stealing probability mass from shipped signs.
    Dropping them as *trained* classes (→ **114 classes, 103 published**) restored
    `stand` 0.47→0.63 and `car` 0.43→0.57; `school` 0.42→0.49 (improved, kept — grandfathered).
    No new demotions. Re-calibrated **T=0.80**. ADR-019 gate, §6.15.
  - **P4M16 — MS-ASL download → 100+ signs**: fetched 36 everyday glosses, trained a
    117-gloss model; the honest gate cleared 27 new → **79 + 27 = 106 published signs**
    (aggregate 0.696 over 117; the original 79 hold at 0.718; no demotions). Needed a
    download fix first (yt-dlp-ejs + Deno for YouTube's n-challenge, [#40](https://github.com/aakash-tir/sign-app/pull/40)). §6.14, docs/reaching-100-signs.md.
  - **P4M10 — label smoothing** ([#34](https://github.com/aakash-tir/sign-app/pull/34)): a label-smoothing loss (0.15)
    lifted honest CV **0.687 → 0.732**, **71 → 79 signs, no demotions** (`hungry` recovers).
    Loss-only, no runtime/spec/size change. ADR-027, §6.12.
  - **P4M5 — the win** ([#29](https://github.com/aakash-tir/sign-app/pull/29)):
    **bidirectional GRU + masked attention pooling** (read the whole sign, not just the
    last timestep) → **0.687**, 71 signs. ONNX 690 KB. ADR-024, §6.9.
  - **P4M7 — runtime confidence** ([#30](https://github.com/aakash-tir/sign-app/pull/30)):
    per-sign acceptance thresholds + temperature calibration (T=1.6) + 3-window voting; no
    retrain. ADR-025, §6.10.
  - **P4M2 diagnose** ([#27](https://github.com/aakash-tir/sign-app/pull/27)): the 18 low
    signs are **under-separated, not data-starved** — which is why the modeling lever
    (P4M5) won and the cheap data/loss tweaks didn't. §6.7.
  - **P4M4 motion** ([#28](https://github.com/aakash-tir/sign-app/pull/28)) and **P4M3
    mirroring + class-weighted loss** ([#31](https://github.com/aakash-tir/sign-app/pull/31)):
    both **tested, honest-negative, not shipped** — kept as opt-in tooling. (P4M3 notably
    *proved* mirroring is parity-correct, refuting the P3M3 deferral.) ADR-022/023, §6.8/6.11.

- **P4M8 — SSL pretraining: tested, honest-negative, NOT shipped** (2026-06-29, ADR-026,
  §6.16): the last/heaviest lever. Built the full masked-pose mechanism (pretrain the **same**
  BiGRU encoder, no arch swap) + extracted the **full on-disk pool (15,811 seq / ~2,200
  glosses)**. A strict pretrain↔eval signer holdout collapses the pool to 376 clips, so ran the
  **optimistic upper bound** (full pool): **0.689 vs 0.691 baseline — flat, the ceiling → shelve.**
  Tooling kept opt-in. **This closes the Phase-4 accuracy track** — every lever explored.

**✅ Phase 5 — the Sentences section (2026-07-01, [`docs/phase5.md`](docs/phase5.md), ADR-028,
FR-20).** Promoted sentences from the minimal P2M7 Learn drill to a **top-level `/sentences`
tab**: a **59-sentence bank** (2–4 signs over the 103-gloss vocab), pure domain
eligibility/selection (all-confident ∩ per-level length bands; seeded RNG preferring
un-completed), **persisted completion progress** (Dexie v3 + `SentenceRepo`), per-sign
camera verification (ADR-025 acceptance, rising-edge advance) with the "That's what I did"
valve, and ADR-009 gating with locked/empty explainers. In-Learn drill removed. Built as
sub-milestones off an integration branch: P5M1 [#46](https://github.com/aakash-tir/sign-app/pull/46) ·
P5M2 [#47](https://github.com/aakash-tir/sign-app/pull/47) · P5M3 [#48](https://github.com/aakash-tir/sign-app/pull/48)
→ main [#49](https://github.com/aakash-tir/sign-app/pull/49). Frontend-only; no model change.

**✅ Owner-verified (2026-07-10): the Sentences feature works in real use.** Checked
against a locally seeded bank (all 103 dynamic signs forced `confident` via a temporary
dev-only scaffold, since reaching the ADR-009 gate organically needs ≥20 confident words);
`/sentences` unlocked and drilled correctly. Scaffold removed, not committed. **Phase 5 is
closed.** P4M8 tested-negative closed the accuracy track.

**▶ Next up: Phase 6 — the learner app.** All seven plan questions answered (owner,
2026-07-10); plan in [`../plan.md`](../plan.md), detailed milestones in
[`docs/phase6.md`](docs/phase6.md) (P6M1–P6M9, **ADR-029**): **store-first** native wrap
of the same codebase, today's tabs behind a **dev mode**, **linear-with-review**
progression, **bucket-based** recall, **24 letters** (J/Z wait until verifiable),
**placeholder slots** for not-yet-recognized words, a **new learner-facing look**.
**P6M1 (syllabus) merged [#50](https://github.com/aakash-tir/sign-app/pull/50):** 11
units / 62 sets covering all 103 shipped glosses + 13 placeholder words
(`PRIORITY_WORDS`), 8 letter batches (no J/Z) — owner review of the route welcome; it's
plain content (`frontend/src/content/curriculum.ts`).
**P6M2 (store-wrap spike) merged [#51](https://github.com/aakash-tir/sign-app/pull/51) —
verdict GO:** Capacitor Android wrap committed; camera + MediaPipe WASM + onnxruntime-web
all run in the WebView (phase6.md §P6M2). Owner follow-up: sustained-recognition check on
a **real Android phone** (`adb install frontend/android/app/build/outputs/apk/debug/app-debug.apk`
— build it first with `./gradlew assembleDebug`, JAVA_HOME = Android Studio's jbr).
**P6M3 (recall engine) merged [#52](https://github.com/aakash-tir/sign-app/pull/52):** pure teach → recall state machine (`domain/recall.ts`; 3× reps, pool review every 3rd prompt, placeholders excluded). **P6M4 (words path UI) merged [#53](https://github.com/aakash-tir/sign-app/pull/53):** the `/course` tab — path list (linear-with-review, placeholder stubs), teach → recall sessions on the P6M3 engine, Dexie v4 `curriculumSets`, clean learner video (`showOverlay={false}`). Live — owner can try `/course`. **Next: P6M5 (sentence stage at set completion).**
Remaining/parked: push `school` back over 0.50 (find its new confuser via `diagnose`, then
drop/fetch — low priority, it's published); **P4M6** targeted data (low-value — data isn't the
bottleneck); tune the Phase-5 level length bands / grow the sentence bank as vocabulary grows.
Also: `SIGN_SENTENCES` has no count assertion, so the bank size drifted from the docs
undetected (57 → 59) — worth pinning in `signSentences.test.ts`.
