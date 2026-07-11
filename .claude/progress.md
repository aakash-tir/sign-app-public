# Progress

Live status tracker. Update at the start/end of every milestone. Milestone detail
is in [`docs/milestones.md`](docs/milestones.md).

## Current state

> **Live now (2026-07-10):** Phases 1–5 + the Phase-6 learner surfaces deployed —
> **24 fingerspelling letters + 103 dynamic signs** (114-class BiGRU+attention+ls0.15
> model, T=0.80, per-sign accept bars), the **Sentences** section (Phase 5: 59-sentence
> bank, ADR-028), and the **learner course** (Phase 6 P6M1–P6M6: `/course` words path
> with teach→recall + sentence stage, `/course/alphabet` with the spell-words stage,
> placeholder slots, Dexie v4 progress — not yet the default shell, that's P6M7).
> Latest milestone: **Phase 5** (P5M1–P5M3, [`docs/phase5.md`](docs/phase5.md)) merged +
> deployed + **owner-verified in real use (2026-07-10)**. **Phase 6 (the learner app)
> is underway** — [`docs/phase6.md`](docs/phase6.md), ADR-029; **P6M1 (syllabus) merged
> [#50](https://github.com/aakash-tir/sign-app/pull/50); P6M2 (store-wrap spike) is next.**
> The authoritative status hub is [`CLAUDE.md`](CLAUDE.md) §Status; the
> milestone table + Log below are the running record. The bullets that follow are the
> historical Phase 2→3 narrative (kept for context, not the current truth).

- **🎉 Phase 2 (depth & polish) COMPLETE — all 5 plan items merged + deploying.**
  P2M1 overlay-color toggle ([#13]) · P2M2 shared camera + explainer ([#14]) · P2M3
  full UI redesign ([#15]) · P2M4 in-app sign reference from landmarks ([#16]) ·
  P2M5a canonical ingest layer + signer-disjoint splits ([#17]) · **P2M5b vocab
  expansion** ([PR #18](https://github.com/aakash-tir/sign-app/pull/18), squash
  `3321b7b`): **+4 everyday signs** (`walk`/`tall`/`cold`/`before`) → **20 dynamic
  signs shipped** + 24-letter static. Auto-deploys to Cloudflare on push to `main`.
- **P2M6 ✅ merged** ([PR #19](https://github.com/aakash-tir/sign-app/pull/19),
  `7fcf872`): tab-hidden camera release (ADR-018 deferral resolved).
- **P2M7 ✅ merged** ([PR #20](https://github.com/aakash-tir/sign-app/pull/20),
  `4d04c87`): real multi-sign Learn **"Sign sentences"** drill (ADR-012) — short
  sequences of confident dynamic signs, one at a time, gated by ADR-009; content in
  `content/signSentences.ts` (8 owner-reviewable 2-sign combos). 155 vitest / 15
  playwright. **Phase 2 + all follow-ups now done, merged, and deploying.**
- **Baseline verified for Phase 3 (2026-05-24):** `main` clean + green (frontend
  lint/tsc/vitest, ml ruff/mypy/pytest); deployed app shell + SPA routes + 24-label
  model + reference clips all 200. No open PRs/branches.
- **🚧 Phase 3 (accuracy & vocabulary depth) kicked off** — plan in
  [`docs/phase3.md`](docs/phase3.md) (P3M1 honest eval · P3M2 reviewed-dataset
  expansion toward ~50 signs · P3M3 landmark-space augmentation); ADR-019/020 +
  Q6–Q9 recorded. **P3M1 ✅ merged** ([PR #21](https://github.com/aakash-tir/sign-app/pull/21),
  squash `fa823ec`): signer-disjoint CV is now the ship gate (`signer_folds`,
  `cross_validate(signer_ids=…)`, extract caches `signers.npy`); honest baseline on
  the starter-20 set **top-1 0.570 / top-5 0.922** vs stratified 0.622 / 0.953
  (leakage ≈ +5 pts) — recognition.md §6.3. Real-camera holdout deferred (no clips
  yet, ADR-019). +4 pytest (62); both CI lanes green.
- **✅ P3M2 part 2 (retrain) MERGED + DEPLOYED** ([PR #24](https://github.com/aakash-tir/sign-app/pull/24),
  squash `0851c1a`; auto-deploys to Cloudflare on push to `main`).
  MS-ASL fetched (cookies.txt auth, 909 clips) + combined
  with WLASL through the ingest layer → a **1151-clip / 24-gloss / 128-signer** cache
  (vs the old 193/36). Honest signer-disjoint CV **top-1 0.719 / top-5 0.931** — vs
  the P3M1 baseline 0.570/0.922, a **+15-pt** top-1 gain purely from the data.
  Re-gated under the **strict honest gate** (owner-confirmed): the shipped set stays
  **20** but improves in quality — **promoted** `like`/`bad`/`happy` (now ≥ 0.50),
  **demoted** `good`/`before`/`tall` (now < 0.50 honestly); `thank you` still held
  back. New 24-class ONNX (300 KB) + reference clips bundled; `SHIPPED_GLOSSES`
  updated (frontend + ml). All gates green (155 vitest / 15 playwright; ml 77 pytest).
  Detail in [`docs/recognition.md`](docs/recognition.md) §6.5. **Reaching ~50 signs
  needs a further MS-ASL download pass for new glosses** — this pass reinforced the
  existing 24. Extraction is now resumable + hang-proof (per-clip cache, worker
  recycle, per-clip timeout + quarantine).
- **✅ P3M2c vocab50 (~50-sign push) — MERGED + DEPLOYED** ([PR #25](https://github.com/aakash-tir/sign-app/pull/25),
  squash `cada2e8`; auto-deploys to Cloudflare on push to `main`). **Deploy-verified:**
  live `model.onnx` sha256 `491d35c0…0ff1a2` == local (315,381 bytes, HTTP 200).
  Registered **57 new glosses** (`PHASE3B_GLOSSES`/`vocab50`, after a read-only
  coverage pre-screen), the owner ran the MS-ASL fetch (3 throttle-cooldown retry
  passes; an ffmpeg-on-PATH fix was needed — yt-dlp's partial-download gate ignores
  `--ffmpeg-location`). Combined cache **3583 samples / 81 glosses / 163 signers** (vs
  P3M2's 1151/24/128). Honest signer-disjoint CV **top-1 0.561 plain → 0.615 with P3M3
  augmentation** (enabled for the shipped model via new `train --aug`; recovers both
  P3M2 incumbents, so no demotions). **Re-gate at ≥ 0.50 (owner-confirmed): 63 of 81
  glosses ship** — all 20 from P3M2 + **43 new** (incl. `thank you`, held since M6).
  81-class ONNX (315 KB) + 63 reference clips bundled; `SHIPPED_GLOSSES` 20→63 (frontend
  + ml). Detail in [`docs/recognition.md`](docs/recognition.md) §6.6. **Shipped
  vocabulary: 24 letters + 63 dynamic signs.**
- **Untracked working-tree files** (`1138_Paper.pdf`, `DAI - ASLLVD.pdf`, the ASLLVD
  `.xlsx`) are **dataset-review materials** — ASLLVD/ASL-Citizen were already reviewed
  and **declined** (research-only, no model carve-out; phase3.md review log). Safe to
  ignore or delete; not part of the branch.
- **Phase 2 — P2M3 ✅ merged. (Full UI redesign.)** **P2M3**
  (full UI redesign, plan item #2, FR-16) **merged via
  [PR #15](https://github.com/aakash-tir/sign-app/pull/15)** (squash `1297a6e`):
  CSS-only — light/dark design tokens + a real button system (the app had none — the
  "buttons not visible" cause), pill nav, surface cards across all views, and a
  camera-off placeholder. Owner: "looks a lot cleaner and better." 149 vitest / 15
  playwright.
- **Phase 2 — P2M2 ✅ merged. (Camera persists across views.)** **P2M2** (camera
  persists across views, plan item #3, FR-15, **ADR-018**) **merged via
  [PR #14](https://github.com/aakash-tir/sign-app/pull/14)** (squash `3d66680`):
  app-level **`CameraProvider`** above the router owns one shared `MediaStream`;
  `useCamera` is a thin adapter (callback ref) that attaches it to the current view
  and never stops it on unmount — switching tabs no longer re-prompts "Enable
  camera". One-time privacy explainer (`profile.cameraExplainerSeen`). Review/perf
  fixes: detectors + ONNX cached as app-lifetime singletons, detection throttled to
  ~30 FPS, "Preparing recognition…" first-load indicator. Owner verified "works
  really well." Supersedes the "release on unmount" rule (react.md updated).
  **Deferred:** `visibilitychange` release/resume (ADR-018). **149 vitest / 15
  playwright**, both CI lanes green.
- **Phase 2 — P2M1 ✅ merged** ([PR #13](https://github.com/aakash-tir/sign-app/pull/13),
  squash `91f6e31`): overlay color toggle (plan item #5, FR-14) — `fingerColors.ts`
  (colorblind-safe Okabe–Ito palette, in-frame guard); `drawHands`/`drawHolistic`
  take a `colorMode` param + off-frame stray-line cleanup; **Settings toggle**
  (`classic` default vs `per-finger`) persisted and read live by the draw loops.
  Phase-2 decisions locked: ADR-016 (MS-ASL cleared for training under C-UDA),
  ADR-017 (in-app sign reference rendered from landmarks).
- **Phase 1:** **🎉 M7 ✅ merged + DEPLOYED — the M0–M7 plan is COMPLETE.** The PWA
  is live worldwide at **https://sign-app.aakashtirathdas.workers.dev** (Cloudflare
  Workers Static Assets, auto-deploys on push to `main`). Verified: app shell + SPA
  routing 200, model assets served from the edge.
- **M7 (PR #12):** offline precache (app shell + ONNX model) + runtime-cache CDN
  assets (MediaPipe/ONNX WASM + `.task` models); code-split MediaPipe +
  onnxruntime-web (main bundle 416 kB); dropped the unused 26 MB ORT WASM from the
  build; SPA via `wrangler.jsonc` `not_found_handling`; offline Playwright test
  (FR-12). Deploy = Cloudflare Workers Builds (Pages funnels there now); guide in
  `docs/hosting.md`.
- **M6 (PR #8 + #11):** dynamic word-level signs end to end — Holistic capture +
  frozen 161-d normalization (ADR-013), PyTorch→ONNX→onnxruntime-web (ADR-015),
  5-fold-CV accuracy gate (16/20 signs ship), merged into Practice & Learn via a
  unified single-camera recognizer.
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
| M7 — Offline, polish & deploy | ☑ merged + **deployed** | `milestone/M7-deploy` | [#12](https://github.com/aakash-tir/sign-app/pull/12) |

Legend: ☐ not started · ◐ in progress · ☑ merged

## Phase 2 checklist (see [`docs/phase2.md`](docs/phase2.md))

| Milestone | Plan item | Status | Branch |
| --- | --- | --- | --- |
| P2M1 — Overlay color toggle | #5 | ☑ merged [#13](https://github.com/aakash-tir/sign-app/pull/13) | `milestone/P2M1-finger-colors` |
| P2M2 — Camera persists across views + explainer | #3 | ☑ merged [#14](https://github.com/aakash-tir/sign-app/pull/14) | `milestone/P2M2-camera-permission` |
| P2M3 — Full UI redesign | #2 | ☑ merged [#15](https://github.com/aakash-tir/sign-app/pull/15) | `milestone/P2M3-ui-redesign` |
| P2M4 — In-app sign reference (rendered from landmarks) | #4 | ☑ merged [#16](https://github.com/aakash-tir/sign-app/pull/16) | `milestone/P2M4-sign-reference` |
| P2M5 — Dataset expansion + ingest normalization | #1 | ☑ merged — P2M5a [#17](https://github.com/aakash-tir/sign-app/pull/17) + P2M5b [#18](https://github.com/aakash-tir/sign-app/pull/18) (MS-ASL = future owner action) | `milestone/P2M5b-vocab-expansion` |

## Decisions made during planning

- ASL · PWA-first React/TS · on-device MediaPipe + TF.js · Python build-time only.
  Full rationale in [`docs/decisions.md`](docs/decisions.md).
  *(Historical: the TF.js half was superseded — static ships a JSON-MLP (ADR-011),
  dynamic ships ONNX/`onnxruntime-web` trained in PyTorch (ADR-015).)*

## Open questions to resolve (by milestone)

- ~~Q1 "I forgot" alone = wrong?~~ ✅ Resolved: yes; "That's what I did" overrides to correct via deferred commit (ADR-008).
- ~~Q2 proficiency threshold for sentence unlock~~ ✅ Resolved: sentence-eligible at `confident`; beginner needs ≥20 confident words (ADR-009).
- ~~Q3 sign→level mapping~~ ✅ Resolved: level behavior fixed (ADR-009); vocab lists are M5 content.
- ~~Q4 hosting provider~~ ✅ Resolved: Cloudflare Pages (ADR-006, docs/hosting.md).
- Q5 dynamic vocabulary expansion extent → M6

## Phase 3 checklist (see [`docs/phase3.md`](docs/phase3.md))

| Milestone | Theme | Status | Branch |
| --- | --- | --- | --- |
| P3M1 — Honest accuracy measurement (signer-disjoint gate) | accuracy eval | ☑ merged [#21](https://github.com/aakash-tir/sign-app/pull/21) | `milestone/P3M1-honest-eval` |
| P3M2 — Add reviewed datasets + retrain → ~50 signs | data | ◐ part 1 (ingest) ☑ merged [#22](https://github.com/aakash-tir/sign-app/pull/22); part 2 (MS-ASL fetch + combined retrain + re-gate) ☑ **merged** [#24](https://github.com/aakash-tir/sign-app/pull/24) (squash `0851c1a`). 24-gloss model, honest CV 0.719; ~50 signs needs a further download pass | `milestone/P3M2-download-hardening` |
| P3M2c — vocab50 (~50-sign push) | data | ☑ merged [#25](https://github.com/aakash-tir/sign-app/pull/25) + **deployed**: 81-gloss model (3583 samples / 163 signers), honest CV 0.615 w/ aug, **63 signs ship** (20 + 43 new) | `milestone/P3M2c-vocab50` |
| P3M3 — Expanded landmark-space augmentation | augmentation | ☑ merged [#23](https://github.com/aakash-tir/sign-app/pull/23) | `milestone/P3M3-augmentation` |

## Phase 4 checklist (see [`docs/phase4.md`](docs/phase4.md))

Two tracks: **discovery** (P4M1, shipped) + **accuracy** (P4M2–P4M8). **Accuracy track
paused 2026-06-02** after the big win: the dynamic recognizer went **0.615 → 0.687 honest
top-1, 63 → 71 signs**, plus per-sign calibrated acceptance — all live. The win was the
**temporal-model upgrade (P4M5)**; the cheap data/loss tweaks (P4M4 motion, P4M3
mirror/class-weight) each proved they don't help on top of it (kept as opt-in tooling),
matching the P4M2 diagnosis ("data not the bottleneck"). Remaining: P4M6 (low-value),
P4M8 (the big SSL swing) — owner to decide later. Honest signer-disjoint CV (ADR-019) is
the arbiter; on-device ONNX ≤ ~1.5 MB (shipped 698 KB — the 114-class P4M17 model;
the 690 KB figure quoted in the P4M5 rows below was the 81-class model).

| Milestone | Track | Status | Branch |
| --- | --- | --- | --- |
| P4M1 — Sign search tab | discovery | ☑ merged [#26](https://github.com/aakash-tir/sign-app/pull/26) + deployed (169 vitest / 18 playwright) | `milestone/P4M1-sign-search` |
| P4M2 — Diagnose low signs (confusion + diversity) | accuracy | ☑ merged [#27](https://github.com/aakash-tir/sign-app/pull/27) — **3 confusable / 15 diffuse / 0 data-starved** (recognition.md §6.7) | `milestone/P4M2-diagnose` |
| P4M3 — Augmentation + loss levers (mirroring, class weight) | accuracy | ☑ merged [#31](https://github.com/aakash-tir/sign-app/pull/31) — **negative** (mirror 0.669 / cw 0.674 / both 0.661 < 0.687); mirroring proven parity-correct, kept opt-in (§6.11) | `milestone/P4M3-aug-loss` |
| P4M4 — Motion / velocity features (frame spec v2) | accuracy | ☑ merged [#28](https://github.com/aakash-tir/sign-app/pull/28) — **negative** (0.615→0.594); motion kept opt-in, **not shipped** (§6.8) | `milestone/P4M4-motion-features` |
| P4M5 — Temporal model upgrade (attention pooling) | accuracy | ☑ merged [#29](https://github.com/aakash-tir/sign-app/pull/29) + deployed — **BiGRU + attention: honest CV 0.615→0.687 (+7.2), 63→71 ship** (§6.9) | `milestone/P4M5-temporal-model` |
| P4M6 — Targeted per-gloss data fetch (owner-gated) | accuracy | ☐ not started (low-value — data not the bottleneck per P4M2) | `milestone/P4M6-targeted-data` |
| P4M7 — Runtime confidence (per-sign thresholds, voting) | accuracy | ☑ merged [#30](https://github.com/aakash-tir/sign-app/pull/30) + deployed — per-sign accept bars (69 sub-0.5) + temperature 1.6 + 3-window voting; no retrain (§6.10) | `milestone/P4M7-runtime-confidence` |
| P4M8 — Self-supervised pretraining (big swing) | accuracy | ☑ **tested, honest-negative, NOT shipped** (2026-06-29) — optimistic-SSL 0.689 vs baseline 0.691 (flat); tooling kept opt-in (§6.16, ADR-026) | `milestone/P4M8-ssl-pretrain` |
| P4M9 — Search UX (stem + fuzzy + fingerspell fallback) | discovery | ☑ merged [#33](https://github.com/aakash-tir/sign-app/pull/33) + deployed; resolves the P4M1 deferrals (no model/data work) | `milestone/P4M9-search-ux` |
| P4M10 — Label-smoothing loss | accuracy | ☑ merged [#34](https://github.com/aakash-tir/sign-app/pull/34) + deployed — honest CV **0.687 → 0.732**, 71 → **79 signs**, no demotions (§6.12, ADR-027) | `milestone/P4M10-label-smoothing` |
| P4M16 — MS-ASL download → 100+ signs | accuracy | ☑ merged [#41](https://github.com/aakash-tir/sign-app/pull/41) + deployed — 117-gloss model, 27 new cleared → **106 published** (§6.14) | `milestone/P4M16-vocab-100` |
| P4M17 — Drop confusers (dance/paper/slow) | accuracy | ☑ merged [#42](https://github.com/aakash-tir/sign-app/pull/42) + deployed — 114-class, **103 published**; stand/car recovered, school 0.42→0.49 (§6.15) | `milestone/P4M17-fix-confusers` |
| P4M11 — Search autocomplete (as-you-type ranking) | discovery | ☑ merged [#45](https://github.com/aakash-tir/sign-app/pull/45) + deploying — pure `autocomplete()` ranker (prefix → substring → fuzzy) + keyboard-navigable combobox dropdown in `SearchView`; resolves the P4M9 deferral. Frontend-only, no model/data work | `milestone/P4M11-search-autocomplete` |

## Phase 5 — the Sentences section ([docs/phase5.md](docs/phase5.md))

| Milestone | Status | Branch |
| --- | --- | --- |
| P5M1 — Sentence content bank + pure domain | ☑ merged [#46](https://github.com/aakash-tir/sign-app/pull/46) into the integration branch — 59-sentence bank (2–4 signs over the 103-gloss vocab) + `domain/sentences.ts` (all-confident eligibility, level length bands, seeded selection preferring un-completed) | `milestone/P5M1-sentence-domain` |
| P5M2 — Persisted sentence progress | ☑ merged [#47](https://github.com/aakash-tir/sign-app/pull/47) — Dexie v3 `sentences` table + `SentenceRepo`; v2→v3 migration test | `milestone/P5M2-sentence-progress` |
| P5M3 — Sentences section UI + e2e | ☑ merged [#48](https://github.com/aakash-tir/sign-app/pull/48) — `/sentences` route + nav tab, per-sign verify (rising-edge accept) + valve, reference player, progress line, ADR-009 gating states; in-Learn P2M7 drill removed | `milestone/P5M3-sentences-view` |
| Integration → main | ☑ merged [#49](https://github.com/aakash-tir/sign-app/pull/49) + deployed | `milestone/P5-sentences` |

## Phase 6 — the learner app ([docs/phase6.md](docs/phase6.md), ADR-029)

The owner's plan ([`../plan.md`](../plan.md)): the actual user app — syllabus +
Duolingo-style teach→recall over two always-open paths, a new learner-facing look,
today's tabs behind a dev mode, **store-first** native packaging. All seven
plan-shaping questions answered 2026-07-10 (plan.md §6).

| Milestone | Status | Branch |
| --- | --- | --- |
| P6M1 — Syllabus + reconciliation | ☑ merged [#50](https://github.com/aakash-tir/sign-app/pull/50) (squash `1eb78a1`) — 11 units / 62 sets, 103 glosses + 13 placeholders, 8 letter batches, `PRIORITY_WORDS` | `milestone/P6M1-syllabus` |
| P6M2 — Store-wrap feasibility spike | ☑ merged [#51](https://github.com/aakash-tir/sign-app/pull/51) (squash `b41c15e`) — **GO**; real-device check = owner follow-up | `milestone/P6M2-store-spike` |
| P6M3 — Recall engine (pure domain) | ☑ merged [#52](https://github.com/aakash-tir/sign-app/pull/52) — teach → 3× recall, pool review every 3rd prompt | `milestone/P6M3-recall-engine` |
| P6M4 — Words path UI | ☑ merged [#53](https://github.com/aakash-tir/sign-app/pull/53) — `/course` route: teach → recall → complete, Dexie v4, clean learner video | `milestone/P6M4-words-path` |
| P6M5 — Sentence stage | ☑ merged [#54](https://github.com/aakash-tir/sign-app/pull/54) — shared `SentenceDrill`; also fixed the Dexie teardown flake for good | `milestone/P6M5-sentence-stage` |
| P6M6 — Alphabet path UI | ☑ merged [#55](https://github.com/aakash-tir/sign-app/pull/55) — `/course/alphabet`: 8 batches → recall → spell-words stage | `milestone/P6M6-alphabet-path` |
| P6M7 — Learner shell + new look | ☐ not started | `milestone/P6M7-learner-shell` |
| P6M8 — Progress & polish | ☐ not started | `milestone/P6M8-progress` |
| P6M9 — Store release (owner-gated) | ☐ not started | `milestone/P6M9-store-release` |

## Log

- **2026-07-10** — **Phase-6 verification pass (owner-requested) — everything green,
  one real bug found + fixed.** Re-ran every gate on `main`: ml (ruff/mypy/**108
  pytest**) and frontend (prettier/eslint/tsc/vitest/**26 playwright**) all green. Drove
  the built app in a real browser (fake camera, phone viewport): words path teach →
  forgot-reveal → recall → sentence stage → complete, alphabet path, screenshots
  reviewed — **zero console errors; the full MediaPipe+ONNX pipeline ran live** (visible
  prediction). Live site probes: `/course` + `/course/alphabet` 200. **The catch:** the
  tab-hidden camera-release test flaked under full-parallel load and it was a **real
  ADR-018 privacy edge** — `statusRef` synced to state in a passive effect, so a tab
  hidden in the commit→effect window kept the camera streaming until the next visibility
  flip; fixed by syncing ref+state together (`setCameraStatus`, same pattern as
  `setActiveStream`). Also hardened test infra: testing-library `asyncUtilTimeout` 1s→5s
  (39-suite parallel runs pushed initial IndexedDB loads past the default, flaking
  random DB-backed suites). Verified **0 failures across 8 consecutive full-suite
  default-parallelism runs** (~2,500 test executions). Also learned: `tsc --noEmit` gave
  a stale pass off its incremental cache mid-edit — cache-busted before trusting it.
- **2026-07-10** — **P6M6: the alphabet path UI** (branch
  `milestone/P6M6-alphabet-path`). Second learner path (plan §2.3 path 1) at
  `/course/alphabet`, joined to the words path by a `CoursePathSwitch` pill nav (both
  always open). **Path list**: the 8 alphabetical letter batches (24 letters, no J/Z —
  Q5) with linear-with-review access over the same `curriculumSets` table. **Sessions**
  (`LetterSession`, owns the **static-letter** camera via the unified hook in letter
  mode, LearnMode-style `recognized`-match accept + committing guard + `reset()` between
  prompts): teach cards show the letter + its `LETTER_HINTS` handshape text (no
  stick-figure clips for letters yet) → P6M3 recall drills with valve/forgot/reveal;
  attempts feed the letter word-bank entries. **Spell-words stage**: unlocks when all 8
  batches complete — `SHORT_WORDS` (20, all A–Y) spelled letter-by-letter via the
  existing `FingerspellStage` (gained a `showOverlay` prop; learner surfaces keep clean
  video, Search unchanged). Camera ownership kept exclusive: the session and the spell
  stage never mount recognizers together. Tests: **+7 vitest** (path states, teach
  hints, recognized-accept, forgot/reveal, batch completion + persistence, spell
  unlock/pick) and **+1 playwright** (`alphabet-path.spec.ts`: teach → 9-valve recall →
  complete → reload persistence). All gates green: prettier / eslint / tsc / **308
  vitest** / **26 playwright**. **Merged [#55](https://github.com/aakash-tir/sign-app/pull/55); all CI green + deployed. The learner feature set from the plan is functionally complete — next is the P6M7 shell/new look. Next: P6M7.**
- **2026-07-10** — **P6M5: the sentence stage at set completion** (branch
  `milestone/P6M5-sentence-stage`). Completing a course set now flows into **"use your
  new words in a sentence"** (plan §2.3 path 2) before the set-complete screen.
  **Extracted the per-word sentence drill out of `SentencesView` into a shared
  `SentenceDrill`** (chips + reference + stage + valve + rising-edge advance; keyed
  per drill run — extraction surfaced a real reset bug when the same sentence is
  re-picked, fixed with a round-counter key; the existing SentencesView tests were the
  regression guard, all green unchanged). New pure `stageSentenceCandidates(bank, pool,
  newSigns)` in `domain/curriculum.ts`: buildable-from-pool, **preferring sentences that
  use a just-learned sign**, falling back to any buildable (not every set's words appear
  in the bank); the course stage keys off the **learned pool** while the Sentences tab
  keeps its stricter all-`confident` ADR-009 eligibility. Stage completions **record via
  `SentenceRepo`** (one source of truth with the Sentences tab; `pickSentence` freshness
  bias applies); skippable ("Skip for now"). Learner overlay stays off. Tests: **+6
  vitest** (3 domain candidates, 3 view: stage appears with `want eat`, drilling records
  + lands on set-complete, skip records nothing) and the words-path e2e now drills the
  staged sentence for real. All gates green: prettier / eslint / tsc / **301 vitest** /
  **25 playwright**. **Merged [#54](https://github.com/aakash-tir/sign-app/pull/54).**
  The first CI run failed and it was a real catch: **7 unhandled `DatabaseClosedError`s**
  — the stage test's fire-and-forget writes racing the test teardown's `database.delete()`.
  Same mechanism as the long-standing **"Dexie parallel flake"**: fixed for good across
  all six DB-backed suites with a **drain transaction** before delete (an empty rw
  transaction over the tables queues behind pending writes — IndexedDB serializes
  overlapping scopes). Also fixed two latent races in the SentencesView progress-line
  test the refactor exposed (~1-in-8 repro). Verified 15/15 suite repeats + 4/4
  full-suite **default-parallelism** runs clean; `--no-file-parallelism` no longer
  needed. **Next: P6M6 (alphabet path UI).**
- **2026-07-10** — **P6M4: words path UI — the first learner surface** (branch
  `milestone/P6M4-words-path`). New `/course` route + nav tab (**additive** — the
  current app stays the default until the P6M7 shell flip). `modes/learner/
  WordsPathView`: the curriculum route rendered as units → sets with live access
  states (Q3 linear-with-review via `routeAccess`; placeholder sets render "coming
  soon" stubs, Q6); the current set drills through the P6M3 engine — **teach card**
  (word + stick-figure reference + camera try-it) → **recall prompts** (rising-edge
  accept like SentencesView, "That's what I did" valve, **"I forgot — show me"**
  records `wrong` per ADR-008 then pauses on the reference) → **set-complete screen**.
  Outcomes feed the word bank (`recordAttempt` → buckets, Q4). **Persistence: Dexie v4**
  `curriculumSets` table + `CurriculumRepo` (idempotent `markCompleted`, `completedIds`;
  v3→v4 migration test). **Learner camera is clean video** — new `showOverlay={false}`
  on `DynamicSignStage` hides the landmark canvas (plan §3; dev surfaces unchanged).
  Caught in review: side effects lived in React state-updater functions (StrictMode
  double-invoke would double-record attempts / double-advance teaching) — refactored to
  value-based handlers. Tests: **+12** (5 repo incl. migration, 7 view) + **+2
  playwright** (`words-path.spec.ts`: route/placeholder render; full teach→recall→
  complete walk via the valve + reload persistence). All gates green: prettier / eslint /
  tsc / **295 vitest** / **25 playwright**. **Merged [#53](https://github.com/aakash-tir/sign-app/pull/53); all CI green + deployed — the owner can try `/course` on the live app. Next: P6M5 (sentence stage).**
- **2026-07-10** — **P6M3: recall engine (pure domain)** (branch
  `milestone/P6M3-recall-engine`). The teach → recall state machine
  (`domain/recall.ts`, pure/framework-free, reducer-style immutable state): per set,
  **teach each sign one at a time** (`startRecallSession`/`confirmTaught`; placeholder
  words excluded via `teachableSigns` — a placeholder-only set starts `complete`), then
  **drill recall until every new sign is recalled correctly `RECALL_TARGET_REPS` (3)
  times** (`nextRecallPrompt`/`recordRecallOutcome`); every
  `REVIEW_INTERLEAVE_EVERY` (3)rd prompt **reviews the whole learned pool** so old words
  stay warm (plan.md §2.2); no-immediate-repeat guard; wrong answers never count (the
  sign stays due — "forgot → view again" arrives as a plain `wrong`, ADR-008); review
  outcomes never gate completion. Bucket transitions stay in `applyOutcome` (glue layer,
  Q4 "extend session buckets"); completion feeds `routeAccess` (Q3). Injected seeded RNG
  throughout. Tests: **+21 vitest** (phase transitions, interleave pattern
  new-new-review, empty-pool/1-word/placeholder edges, determinism, full seeded
  session walk). All gates green: prettier / eslint / tsc / **283 vitest** / **23
  playwright**. **Merged [#52](https://github.com/aakash-tir/sign-app/pull/52); all CI green. Next: P6M4 (words path UI).**
- **2026-07-10** — **P6M2: store-wrap feasibility spike — GO** (branch
  `milestone/P6M2-store-spike`). Wrapped the current build in **Capacitor 7**
  (`capacitor.config.ts` + committed `frontend/android/`; provisional appId
  `com.aakashtir.signapp`; CAMERA permission in the manifest; android/ excluded from
  prettier/eslint; `capacitor.config.ts` typechecked via tsconfig.node). **Debug APK
  builds (5.7 MB)** after a `kotlin-bom` pin (duplicate kotlin-stdlib classes). Verified
  on two Android 16 emulator instances (one headless): full UI renders in the WebView at
  `https://localhost` (secure context); **getUserMedia delivers frames** (feed visibly
  rendering; the P2M2 explainer flows as on web); **MediaPipe WASM (CDN) + WebGL2 →
  "Graph successfully started running" on both**; **onnxruntime-web loads** (WebGPU→WASM
  fallback); **no JS errors**. Caveat: both emulators **crashed (qemu) seconds into the
  vision load** — emulator-infrastructure, not app (no preceding JS error); sustained
  recognition moves to a **real-device check** (adb install the debug APK). Production
  TODOs surfaced: in-app native camera-permission flow (spike pre-granted via adb);
  MediaPipe assets are CDN-fetched → native needs network on first run (bundle later).
  Also fixed a real workflow trap found while gating: **playwright's preview port moved
  4173 → 4179** — with `reuseExistingServer`, another project's preview on vite's default
  port silently became the test target ("passed" 1/23 against the wrong app, twice).
  Build recipe: JAVA_HOME = Android Studio JBR 21, `./gradlew assembleDebug`. All gates
  green: prettier / eslint / tsc / **262 vitest** / **23 playwright** (on 4179).
  iOS path: macOS CI (GitHub Actions) at packaging time; signing owner-gated (P6M9).
  Findings in [`docs/phase6.md`](docs/phase6.md) §P6M2. **Merged [#51](https://github.com/aakash-tir/sign-app/pull/51) (squash `b41c15e`); both CI lanes green. Next: P6M3 (recall engine) — the real-device APK check is a parallel owner follow-up.**
- **2026-07-10** — **P6M1: syllabus + reconciliation (content + pure domain)** (branch
  `milestone/P6M1-syllabus`). The learner-app curriculum, designed **ideal-first** then
  reconciled against the live vocabulary. **Content** (`content/curriculum.ts`,
  owner-reviewable): **11 themed units / 62 word sets** (1–2 signs each) covering **all
  103 shipped glosses + 13 placeholder words** (Q6), plus **8 alphabetical letter
  batches** of 3 (the 24 verifiable letters — no J/Z, Q5). **Pure domain**
  (`domain/curriculum.ts`, framework-free, recognized-set injected): derived
  `wordStatus` (reconciliation can't drift from `SHIPPED_GLOSSES`), linear-with-review
  `routeAccess` (Q3; placeholder-only sets never block and are never current),
  `learnedPool`/`sentencesBuildableFrom`/`routeConstructibility` (the plan.md §2.1
  ordering rule: after every set the pool builds ≥ 1 bank sentence — holds from set 1,
  `want eat`; the finished route builds the entire 59-sentence bank), and
  `priorityWords` → **`PRIORITY_WORDS` = goodbye, you, me, my, your, feel, deaf, when,
  why, today, tomorrow, morning, night** (the model-track expansion queue). Tests:
  **+29 vitest** (domain traversal/constructibility edge cases + content invariants,
  incl. exact 103-gloss set equality and an intentional expected-placeholders assertion
  that fires when the model ships one). All gates green: prettier / eslint / tsc /
  **262 vitest** / **23 playwright**. *(Local gotcha: a stale preview server from
  another project was squatting playwright's port 4173 — `reuseExistingServer` tested
  the wrong app; killed it, all green.)* **Merged
  [#50](https://github.com/aakash-tir/sign-app/pull/50) (squash `1eb78a1`); all three CI
  checks green. Next: P6M2 (store-wrap feasibility spike).**
- **2026-07-10** — **Phase 6 planned: the learner app.** The owner wrote the next-phase
  plan in `plan.md` (the real user-facing app: syllabus + teach→recall, two always-open
  paths — alphabet and words — stick-figure reference for now, no landmark overlay for
  learners); it was reformatted + grounded against the live system, and the owner
  answered **all seven plan-shaping questions**: **store-first** packaging (Q1), dev
  mode for today's tabs (Q2), linear-with-review progression (Q3), extend the session
  buckets (Q4), **24 letters — J/Z wait** (Q5), **placeholder slots** for
  not-yet-recognized words (Q6), a **new learner-facing look** (Q7). Authored
  [`docs/phase6.md`](docs/phase6.md) (P6M1–P6M9: syllabus → store-wrap spike → recall
  engine → words path → sentence stage → alphabet path → shell/new look → progress →
  owner-gated store release) + **ADR-029** (extends ADR-003: native wrap around the
  same codebase); doc map + statuses synced. Store accounts/fees are stop-and-ask
  items at P6M9. **Next: P6M1 — draft the syllabus for owner review.**
- **2026-07-10** — **Sentences owner-verified + docs audited against the code.** The owner
  confirmed the Phase 5 Sentences feature **works in real use** — the last open Phase-5
  item. Verified with a **temporary dev-only scaffold** (`devSeedConfident.ts` +
  an `import.meta.env.DEV` hook in `main.tsx`) that marked all 103 dynamic signs
  `confident` through `WordBankRepo`, clearing both ADR-009 gates; `/sentences` showed
  "0 of 46 sentences completed" (beginner band 2–3 → 17 + 29 of the 59-sentence bank).
  **Scaffold removed, never committed.** Then audited every doc claim against the code:
  vocabulary (103/114), calibration (T=0.80), 24 letters, Dexie v3, test counts
  (233 vitest / 23 playwright / 108 pytest) and the accuracy xlsx all **matched**. Fixed
  what didn't: the **sentence bank is 59, not 57** (6 places; no test pins the count), the
  shipped **ONNX is 698 KB, not 690** (that was the 81-class P4M5 model), and — the big one
  — the docs described a **TF.js / TensorFlow-Keras toolchain that does not exist**. Reality:
  scikit-learn `MLPClassifier` → JSON weights (static, ADR-011) and PyTorch →
  `torch.onnx.export` → `onnxruntime-web` (dynamic, ADR-015). Corrected `CLAUDE.md`,
  `architecture.md` (diagram, stack tables, repo tree, data flow, PWA), and both rules files
  (`python.md` was *instructing* TF.js export and a non-existent `sign_ml.train` CLI);
  annotated ADR-002 as superseded rather than rewriting it. Docs-only commit.
- **2026-07-01** — **Phase 5: the Sentences section — complete** (integration branch
  `milestone/P5-sentences`, plan [docs/phase5.md](docs/phase5.md), ADR-028, FR-20;
  owner-approved scope: top-level tab + persisted progress). Sub-milestones each
  branch → PR → squash into the integration branch (CI extended to run both lanes on
  PRs into `milestone/**`): **P5M1** ([#46](https://github.com/aakash-tir/sign-app/pull/46))
  content bank 8 → **59 sentences** + pure `domain/sentences.ts`; **P5M2**
  ([#47](https://github.com/aakash-tir/sign-app/pull/47)) Dexie v3 + `SentenceRepo`;
  **P5M3** ([#48](https://github.com/aakash-tir/sign-app/pull/48)) the `/sentences`
  section (current-word highlight + reference, per-sign calibrated acceptance with a
  rising-edge advance guard, "That's what I did" valve, "N of M completed", locked/empty
  explainers; the old in-Learn drill removed). Frontend-only, no model/data change.
  Tests grew 208 → **233 vitest** / 21 → **23 playwright**; all gates green per PR.
- **2026-07-01** — **P4M11: search autocomplete (as-you-type ranking)** (branch
  `milestone/P4M11-search-autocomplete`). Resolves the P4M9 deferral;
  **frontend-only, no model/data work.** Added a pure `autocomplete(query, glosses,
  synonyms, limit)` ranker to `domain/signSearch.ts` — ranks exact → prefix →
  substring → typo-tolerant fuzzy (edit distance for queries ≥ 3 chars), considers
  gloss names + synonym keys (synonym hits penalized so a gloss's own name wins a
  tie), dedupes by gloss, caps at `MAX_AUTOCOMPLETE` (8). `SearchView` now renders a
  keyboard-navigable combobox dropdown (ARIA combobox/listbox/option,
  ArrowUp/Down + Enter to select, Escape/blur to close, click to pick). CSS: the
  form no longer wraps so the dropdown (anchored under the input) never overlaps the
  Search button. Tests: +11 vitest (autocomplete ranker + view interactions) and +1
  Playwright (type → options → pick). All gates green (prettier/eslint/tsc; vitest
  208; playwright 21). **Merged [#45](https://github.com/aakash-tir/sign-app/pull/45)
  (squash `9b8bd57`); both CI lanes + Cloudflare build green; auto-deploys on push to `main`.**
- **2026-06-29** — **P4M8: self-supervised masked-pose pretraining — tested, honest-negative,
  NOT shipped** (branch `milestone/P4M8-ssl-pretrain`, ADR-026). The last/heaviest accuracy
  lever. Built the full SSL mechanism (isolating the SSL variable — pretrain the **same**
  BiGRU encoder, no arch swap): `mask_frames` (masked-pose corruption) + `pretrain_encoder`
  (GRU autoencoder, reconstruct masked frames) + `init_gru_state` warm-start threaded through
  `build_sequence_model`/`train_and_eval`/`cross_validate`; `pretrain` CLI stage + `train`/
  `crossval --init-from`. **Phase 0 go/no-go:** extracted the **full on-disk pool → 15,811
  sequences / ~2,200 glosses** (the resumable extractor; reused 5,084 existing caches, 9
  quarantined of 15.8k) — ~2–2.4× the 4,680-sample labeled set, high gloss diversity but a
  small ~100-signer WLASL pool. **Honest-protocol wrinkle:** a strict pretrain↔eval signer
  holdout collapses the pool to **376 clips** (labeled set already spans WLASL's signers), so
  ran the **optimistic upper bound** first (full pool, `--keep-labeled-signers`). **Result
  (seed-matched, 5-fold signer-disjoint):** optimistic-SSL **0.689** vs baseline **0.691** —
  **flat, within noise**, and it's the ceiling (honest ≤ optimistic), so **not shipped**;
  deployed model stays the P4M17 114-class 0.691. Pretraining converged (val recon MSE 0.052
  — mechanism works, data scale doesn't pay). Tooling kept **opt-in** like P4M3/P4M4. No
  runtime/spec/model change. recognition.md §6.16. ml gate green (ruff/mypy/pytest 108, +6).
  **Closes the Phase-4 accuracy track.** **Next: PR + merge.**
- **2026-06-18** — **P4M17: drop the 3 confusers to restore degraded shipped signs**
  (branch `milestone/P4M17-fix-confusers`). Owner asked whether P4M16's 117-class model
  hurt existing signs. Per-sign honest CV (old 81-class → new 117-class): 67/81 unchanged,
  6 better, but **3 degraded** — `stand` 0.79→0.47, `school` 0.73→0.42, `car` 0.70→0.43.
  Confusion: `stand`→`dance` 42%, `school`→`paper`/`slow`, `car`→old signs. **Targeted fix
  (owner's call): drop `dance`/`paper`/`slow`** as *trained* classes so probability mass
  returns to the originals → **114 trained classes, 103 published** (106 − 3). Their 3
  reference clips removed; `vocab_dl2` (114 = vocab_dl − 3) wired in. **114-class honest CV
  0.691; recovery confirmed: `stand` 0.47→0.63 ✅, `car` 0.43→0.57 ✅, `school` 0.42→0.49**
  (much improved, ~1 sample under the 0.50 gate; it's grandfathered so stays published — and
  0.49 strictly beats the live 0.42). **No new demotions.** Retrained + recalibrated (T=0.80,
  per-sign accept bars), bundled 114-class ONNX into the frontend, regenerated the accuracy
  report (114 words / 103 deployed / 69.1%). Tests already updated on-branch (vocab 103, bank
  127). Merged PR #42 (`ca595d2`) + deployed + verified (live sha == local). recognition.md §6.15.
- **2026-06-16** — **P4M16: MS-ASL download → 100+ published signs** (branch
  `milestone/P4M16-vocab-100`). The data lever delivered. **Fixed the broken fetch first**
  (merged #40): YouTube's nsig "n challenge" needs yt-dlp ≥ 2026.6 + `yt-dlp-ejs` + a
  **Deno** JS runtime (node 20 too old); the script now auto-finds Deno. Owner supplied
  cookies; ran the 36-gloss `download` fetch over throttle-cooldown passes (needs
  `--sleep` — a no-delay session rate-limits after ~370 clips). **29 of 36 glosses came in
  with coverage.** Trained a **117-gloss** model (`vocab_dl` = vocab50 ∪ download,
  excluding the P4M15 on-disk flops; 4805 samples; same BiGRU+attention+ls0.15). **Honest
  CV 0.696 over 117; 100 of 117 clear 0.50; 27 of the new download glosses cleared** (`live`
  0.89 … `purple` 0.50). Original 79 hold at 0.718 (−1.4); 6 dip just under and are kept
  (no-demote). **Re-gate: 79 + 27 = 106 published signs — TARGET MET.** Retrained +
  recalibrated (P4M7), bundled 117-class ONNX + 27 WLASL reference clips; `SHIPPED_GLOSSES`
  79→106 both sides; tests (vocab 106, bank 130); regenerated the accuracy report.
  recognition.md §6.14. 9 download glosses stayed below (thin from the rate-limit cutoff);
  7 never fetched (grandfather/grandmother were fetched + shipped; night/table/etc. below).
  **Next: full gates + PR + merge + deploy-verify.**
- **2026-06-15** — **P4M15: vocabulary expansion toward 100 — on-disk tested (negative);
  download path prepped** (branch `milestone/P4M15-vocab-100`). Goal: 100 published signs
  (all ≥ 0.50 honest). **Free on-disk lever first:** screened the 11,980 on-disk WLASL
  videos — only **19** new glosses meet the ≥12-clip floor (none ≥20; the 81 are the
  high-coverage ones). Added `vocab100` + `ONDISK_GLOSSES`, extracted (245 clips, 0
  quarantined), honest-gated. **Result: only `bed` (0.54, n=13) of 19 cleared; aggregate
  0.732→0.704; the 79 held (0.731, no regression). NOT shipped** — a 100-class model for
  one borderline sign isn't worth it; on-disk data too thin (as predicted). Kept as
  tooling. **Download path prepped (the real route to 100):** `DOWNLOAD_GLOSSES` (36
  high-coverage everyday MS-ASL glosses, each ≥43 clips) + `vocab136` + a `download` fetch
  vocab + owner guide [`docs/reaching-100-signs.md`](../docs/reaching-100-signs.md).
  recognition.md §6.13. **No model/runtime change** (deployed stays 0.732/79). Also note
  the per-word accuracy report shipped this day (#35–#38) with band colours + counters.
  **Next (owner-gated): run the MS-ASL download, then I extract/train/gate to 100.**
- **2026-06-15** — **P4M10: label-smoothing loss — the accuracy win** (branch
  `milestone/P4M10-label-smoothing`, ADR-027). Where the P4M3/P4M4 cheap levers regressed,
  **label smoothing** lifts the shipped BiGRU+attention model — the capacity-free regulariser
  the P4M2 "under-separated tail" diagnosis pointed at. Added a `--label-smoothing` knob
  threaded through `cross_validate`/`train_and_eval`/`run_calibrate` + CLI (default 0.0).
  Honest signer-disjoint sweep: 0.05→0.730, 0.10→0.729, **0.15→0.732** (best aggregate +
  top-5); baseline reproduced exactly at **0.687**. **Re-gate at 0.15: 0.687 → 0.732 (+4.5),
  71 → 79 signs, NO demotions** — +8 promoted (`hungry` recovers from its P4M5 demotion,
  +`sleep`/`mother`/`before`/`come`/`tall`/`small`/`white`); only `dog` (0.38) + `stop` (0.47)
  stay unshipped; incumbents `need`/`thank you` dip within noise and are retained
  (no-demote-on-noise, P2M5b). **No runtime/spec/size change** — loss-only; same ONNX graph,
  161-d contract, `onnxruntime-web`; re-calibrated (P4M7) under the same loss. Retrained +
  re-calibrated + re-bundled ONNX/metadata + 8 new reference clips; `SHIPPED_GLOSSES` 71→79
  both sides; tests updated (vocab 79, bank 103). recognition.md §6.12. **Next: full gates +
  PR + merge + deploy-verify.**
- **2026-06-15** — **P4M9: search UX — stem + fuzzy suggestions + fingerspell fallback**
  (branch `milestone/P4M9-search-ux`). Resolves the two P4M1 deferrals (ADR-021 update),
  **frontend-only, no model/data work**. `domain/signSearch.ts` gained pure
  `editDistance` + `fuzzySuggestions` + morphological **stemming**: `matchSign` now
  resolves a stem (`walking`→`walk`, `books`→`book`) as `found`, and returns
  `{ status: 'suggestions', suggestions }` (Levenshtein ≤1–2 by length + prefix, over
  shipped glosses ∪ synonym keys, deduped, top 3) on a near miss. New pure
  `domain/fingerspell.ts` (`fingerspellLetters`/`canFingerspell`) + reusable
  `recognition/FingerspellStage` (unified recognizer in letter mode) power a **spell-it-out
  fallback** for a true miss that's a single word in the static alphabet (A–Y, no J/Z).
  `SearchView` rewired: "did you mean…" chips (click = fresh search) + "Fingerspell
  '<word>' instead" on a spellable miss. Tests: +`fingerspell.test.ts`, expanded
  `signSearch.test.ts` (stem/suggestions/editDistance/fuzzy), `SearchView.test.tsx`
  (suggestions + fingerspell offer), +2 `e2e/search.spec.ts`. tsc/eslint/prettier green;
  targeted vitest 30/30. **Next: full gates (CPU-free) + PR + merge.**
- **2026-06-02** — **P4M3: mirroring + class-weighted loss — tested, NOT shipped** (branch
  `milestone/P4M3-aug-loss`). Two cheap levers for the 10 below-gate signs.
  **Mirroring proven feasible** (refutes the P3M3 deferral): because the hand
  normalization is handedness-canonical, a mirror of a normalized frame is exact —
  pose-pair-swap + negate-x, **swap hand blocks (no internal change)**, swap presence;
  a unit test proves `mirror_frames(normalize) == normalize(flipped capture)`. Added
  `class_weights` (inverse-freq weighted CE). **Honest CV: mirror 0.669 / class-weight
  0.674 / both 0.661 — all below the shipped 0.687.** Class-weight only reshuffles the
  tail (same 71-sign count; promotes the hardest signs but demotes 6 currently-shipped at
  lower aggregate). **Owner decision: do not ship** — model stays 0.687/71. Both kept
  opt-in (`--mirror`/`--class-weight`, default off). No model/runtime/frontend change.
  ADR-023; recognition.md §6.11. ml 101 pytest; gates green. **Next: PR + merge, STOP.**
- **2026-06-02** — **P4M7: runtime confidence levers (no retrain)** (branch
  `milestone/P4M7-runtime-confidence`). Three UX/robustness improvements, validated by
  tests (the honest gate doesn't measure felt UX): **(1) per-sign acceptance thresholds**
  — `fit_per_sign_thresholds` (25th pct of calibrated true-class prob, clamped [0.15,0.5],
  **capped at 0.5 so never stricter**); **69/81 signs get a sub-0.5 bar**. **(2) confidence
  calibration** — `fit_temperature` → **T=1.60** softens the over-confident BiGRU;
  `softmax(logits, T)`. **(3) multi-window voting** — `useDynamicSignRecognition` averages
  the last 3 windows (`averageProbs`). Thresholds + temperature ride in `metadata.json`
  (model ONNX unchanged, featureDim 161); fully backward-compatible. New `calibrate` CLI +
  `cross_validate(calibrate=True)`. ADR-025; recognition.md §6.10. ml 96 pytest / frontend
  105+ vitest; all gates green. **Next: full gates + PR + merge + deploy-verify, STOP.**
- **2026-06-02** — **P4M5: temporal model — BiGRU + attention pooling (the win)** (branch
  `milestone/P4M5-temporal-model`). `build_sequence_model` gained `pooling={last,mean,
  attention}` (learned, **padding-masked** weighted sum over real frames) + optional
  `bidirectional`; threaded through train/crossval + CLI (`--pooling`/`--bidirectional`),
  default `last` unchanged. **Honest signer-disjoint CV sweep (positions, aug):** attention
  0.656, attention+motion 0.635, **BiGRU+attention 0.687** vs last-timestep baseline 0.615
  — **+7.2 pts**, biggest gain since P3M2's data jump, architecture-only. Motion still
  drags (reconfirms §6.8). **Re-gate ≥ 0.50: 71/81 ship (was 63)** — +9 promoted (money,
  woman, girl, man, car, good, run, nice, who), `hungry` demoted (0.33, documented).
  **No runtime/spec change** (same 30×161→81 I/O, featureDim 161); new BiGRU+attention
  ONNX **690 KB** (was 315) — verified to load+infer in onnxruntime, within budget;
  9 new reference clips bundled, `hungry.json` removed. ADR-024; recognition.md §6.9. ml
  92 pytest / frontend 173 vitest + 18 playwright; all gates green. **Next: PR + merge +
  deploy-verify, STOP for P4M6/P4M7 go-ahead.**
- **2026-06-01** — **P4M4: motion (velocity) features — tested, NOT shipped** (branch
  `milestone/P4M4-motion-features`). Built a parity-safe motion toolkit:
  `with_motion`/`withMotion` (append per-frame velocity of the 159 spatial dims, gated so
  padding boundaries don't spike) mirrored on both sides with a shared
  `dynamic-motion.golden.json`; per-frame normalization unchanged; metadata gains an
  optional `features` id + larger `featureDim` only for a motion model (ADR-022). **Honest
  signer-disjoint CV: motion 0.594 vs positions-only 0.615 (−2.1 pts; 63→58 glosses ≥
  0.50)** — overfitting from doubling the input dim on 3583 samples + tiny GRU
  (recognition.md §6.8). Caught + fixed a real ordering bug (augmentation ran on the
  motion-appended layout, corrupting presence flags; first run 0.560 → 0.594 after
  deriving motion AFTER augmentation). **Owner decision: do not ship** — shipped model
  stays positions-only 0.615, runtime reverted to 161-d (bundled model untouched). Motion
  kept **opt-in** (`--motion`, default off) for P4M5 to re-test with attention. ml 89
  pytest / frontend 173 vitest + 18 playwright; all gates green. Also folded the P4M2
  "merged #27" tracker tidy. **Next: PR + merge, STOP for P4M5 go-ahead.**
- **2026-06-01** — **P4M2: diagnose the 18 low signs** (branch `milestone/P4M2-diagnose`).
  Added pure, testable diagnostics to `dynamic_model.py` (`confusion_matrix`,
  `distinct_signers_per_class`, `mean_hand_presence_per_class` tracking proxy,
  `classify_low_signs`); `cross_validate` now captures held-out predictions → emits the
  confusion matrix + per-gloss signer/presence (backward-compatible); new `dynamic_pipeline
  diagnose --aug` CLI writes `diagnosis.json` + prints the dossier. Ran it on the 81-gloss
  cache (signer-disjoint, augmented → reproduced CV top-1 **0.615**). **Headline: data is
  NOT the bottleneck** — all 18 low signs have **12–39 signers** + hand presence
  **0.69–0.83**. Causes: **3 confusable** (`come`→car 62 %, `sleep`→eat 44 %, `nice`→school
  37 %), **15 diffuse** (under-separated trajectories), **0 data-starved / 0 poorly-tracked**.
  → **Re-prioritizes the track:** modeling levers (P4M4 motion features, P4M5 temporal
  model) are highest-value; **P4M6 targeted data is low-value for these signs**. Dossier in
  recognition.md §6.7. +5 pytest (**82**); ruff/mypy/pytest green; no on-device or spec
  change. **Next: PR + merge, then STOP for owner go-ahead on P4M3.**
- **2026-06-01** — **Phase 4 accuracy track planned (P4M2–P4M8)** — owner asked to take
  on the full menu from the "improve low-accuracy signs" research. Goal: lift the **18
  dynamic signs below the honest 0.50 gate** (`come` 0.08 … `mother` 0.49) over the bar
  + raise aggregate honest top-1 (baseline **0.615**, **63/81** ship), **without
  bloating the on-device model** (ONNX ≤ ~1.5 MB). Detailed plan in
  [`docs/phase4.md`](docs/phase4.md): **P4M2** diagnose (confusion matrix + per-gloss
  signer counts → classify each low sign confusable / data-starved / poorly-tracked,
  recognition.md §6.7) → **P4M3** mirroring (paired L/R+pose swap) + class-weighted/focal
  loss → **P4M4** motion/velocity features (frame spec **v2**, regenerate golden vectors
  both sides) → **P4M5** temporal attention pooling / BiGRU (optional two-stream) →
  **P4M6** targeted per-gloss MS-ASL fetch (owner-gated, the proven +15-pt lever) →
  **P4M7** runtime per-sign thresholds + calibration + multi-window voting (no retrain,
  independent) → **P4M8** self-supervised masked-pose pretraining (big swing). Cross-
  cutting: honest signer-disjoint CV is the arbiter; normalization parity sacred; never
  silently demote. ADR-022…026 to record per milestone. **Next: start P4M2 (diagnose).**
- **2026-06-01** — **P4M1 implemented** (branch `milestone/P4M1-sign-search`). Built the
  Search tab end to end: pure `matchSign` (`domain/signSearch.ts`, normalize +
  synonym + exact, framework-free) + `SIGN_SYNONYMS` map (`content/signSynonyms.ts`,
  every target asserted shipped); extracted the camera/overlay/controls/prediction/
  acceptance block into a reusable `recognition/DynamicSignStage` and rewired
  `DynamicSignView` onto it (behavior identical, dropdown passed as `targetControl`);
  new `modes/search/SearchView` (search box → found: reference animation + locked-target
  stage; not-found: "isn't in the system yet") + CSS; `Search` nav link + `/search`
  route. FR-19 + ADR-021 recorded. Tests: +`signSearch.test.ts`, +`SearchView.test.tsx`,
  +`e2e/search.spec.ts`. **All frontend gates green: prettier / eslint / tsc / 169
  vitest / 18 playwright** (+14 unit, +3 e2e); no `ml/` changes. **Merged**
  [#26](https://github.com/aakash-tir/sign-app/pull/26) (squash `60176e0`); all three
  CI checks (Frontend, ML, Cloudflare build) green; auto-deploying to Cloudflare.
- **2026-06-01** — **Phase 4 kicked off: P4M1 sign search tab** (branch
  `milestone/P4M1-sign-search`). Authored [`docs/phase4.md`](docs/phase4.md). New
  **Search** tab: type a sign → if it's one of the 63 shipped dynamic signs (exact +
  synonym + case-insensitive match) show its reference animation + a camera that
  recognizes that specific sign; else "not in the system yet". Owner-confirmed scope:
  **dynamic signs only** (reuses the P2M4 `SignReferencePlayer` + M6.3
  `useDynamicSignRecognition`; **no model/data work**) and **exact+synonym** matching
  (mirrors the ingest `canonical_label` synonym idea). Plan: pure `matchSign`
  (`src/domain/signSearch.ts`) + `SIGN_SYNONYMS` map + `SearchView` + nav/route +
  extract a shared `DynamicSignStage`; tests = vitest (matcher + view) + a
  `frontend/e2e/search.spec.ts`. ADR-021 + FR-19 to record on implementation.
  Fingerspelling/spell-unknown fallback + fuzzy ranking explicitly deferred.
  **Next: implement per the plan.**
- **2026-05-31** — **P3M2c: vocab50 ~50-sign push** (branch `milestone/P3M2c-vocab50`).
  Pre-screened + registered **57 new everyday glosses** (`PHASE3B_GLOSSES` + `vocab50`
  in `wlasl.py`, wired into `msasl_download`/`dynamic_pipeline`). Owner ran the MS-ASL
  fetch over ~4 days; **YouTube throttling needed 3× 75-min-cooldown retry passes** (the
  focused final pass recovered `play`/`tired`/`doctor` — throttle, not link rot). Fixed
  a real download blocker: yt-dlp's partial-download gate (`FFmpegFD.available()`)
  ignores `--ffmpeg-location` and checks PATH only, so `_resolve_ffmpeg` now copies the
  imageio-ffmpeg binary to a canonical `ffmpeg.exe` **and** prepends it to `PATH`
  (memory `msasl-download-setup` updated). Combined extract (resumable, 0 new
  quarantines) → **3583 samples / 81 glosses / 163 signers**. Honest signer-disjoint CV
  **0.561 plain → 0.615 with P3M3 augmentation** — augmentation finally tuned on real
  data (+5.4 pts), enabled for the shipped model via a new `train --aug` (threaded
  through `train_and_eval`/`run_train`). **Re-gate ≥ 0.50 (owner-confirmed bar): 63/81
  ship** — all 20 from P3M2 (no demotions; `drink`/`happy` recovered by aug) + 43 new
  incl. `thank you` (0.63). Bundled 81-class ONNX (315 KB) + 63 reference clips;
  `SHIPPED_GLOSSES` 20→63 both sides; tests updated (vocab 63, bank 87). recognition.md
  §6.6. **Merged** [#25](https://github.com/aakash-tir/sign-app/pull/25) (squash `cada2e8`);
  both CI lanes + Cloudflare build green; **deploy-verified** (live `model.onnx` sha256
  `491d35c0…0ff1a2` == local, 315,381 bytes). **Phase 3 complete.**
- **2026-05-28** — **P3M2 part 2: combined MS-ASL ∪ WLASL retrain + honest re-gate**
  (branch `milestone/P3M2-download-hardening`). Fetched the last `want`/`yes` MS-ASL
  clips (cookies.txt auth via "Get cookies.txt LOCALLY" — Chrome ABE blocks
  `--cookies-from-browser`; ffmpeg from pip `imageio-ffmpeg`, no system install — both
  recorded in memory). Wired a combined extract (`extract-combined` → per-clip
  resumable cache → `assemble-combined`) through the P2M5a ingest layer with
  signer-disjoint splits across sources. **Extraction had to be made hang-proof:**
  MediaPipe `detect()` hangs on a few clips (and accumulates threads to a deadlock over
  hundreds of fresh detectors), so extraction now runs in a **recycled worker
  subprocess with a per-clip 90 s timeout + `.skip` quarantine** — 6 MS-ASL clips
  quarantined, 1148 extracted. Combined cache **1151 clips / 24 glosses / 128 signers**
  (vs 193/36). Honest signer-disjoint CV **top-1 0.719 / top-5 0.931** (P3M1 baseline
  0.570/0.922 → **+15 pts** from data); exported model test split 0.716/0.919.
  **Re-gate (strict honest gate, owner-confirmed):** shipped set stays **20** —
  promoted `like`/`bad`/`happy`, demoted `good`/`before`/`tall` (now < 0.50);
  `thank you` still held. Re-bundled 24-class ONNX (300 KB) + reference clips;
  `SHIPPED_GLOSSES` updated (frontend + ml); recognition.md §6.5. All gates green
  (155 vitest / 15 playwright; ml 77 pytest). **~50 signs awaits a download pass for
  new glosses.** **Merged** [#24](https://github.com/aakash-tir/sign-app/pull/24) (squash `0851c1a`); both CI lanes + Cloudflare build green; auto-deploying.
- **2026-05-28** — **P3M2: MS-ASL download hardening + fetch ~complete** (branch
  `milestone/P3M2-download-hardening`, **2 local commits, unpushed, no PR**). The first
  bulk fetch was throttled by YouTube bot-detection (only ~97 clips, most glosses at 0),
  so `msasl_download.py` was hardened: **browser-cookie auth** (`--cookies-from-browser`)
  + a **`--cookies` Netscape file flag** (the Windows + Chromium App-Bound-Encryption
  workaround), **jittered `--sleep` delays**, a **container-agnostic format** string
  (accept webm/m4v, transcode at merge — strict `ext=mp4` was rejecting DASH/HLS), and
  **multi-client extraction** (`player_client = web/mweb/android/ios` to dodge per-video
  blocks). Result, **live read 2026-05-28** (read-only join of `MSASL_*.json` against
  on-disk `<clip_id>.mp4`): **22 of 24 expanded glosses populated, 792/1195 clips
  (66.3%)**, healthy signer diversity (~20–31 distinct signers per gloss) — vs the old
  broken pass. Script still running at check time (alphabetical; `walk` in progress,
  only `want`/`yes` left at 0); **`coverage.json` is stale** (written only at run end,
  so it still shows the old broken pass — recount with the read-only peek, not that
  file). Clips gitignored under `ml/data/msasl/videos/`. **Peek command (read-only, no
  new file):** `cd ml && uv run python -` with a script that loads `load_msasl_index` +
  `EXPANDED_GLOSSES`, filters by `canonical_label`, and counts present `<clip_id>.mp4`.
  **Next:** combined extract + retrain + signer-disjoint re-gate (P3M2 part 2) — see the
  P3M2 bullet under *Current state*.
- **2026-05-24** — **P3M3: landmark-space augmentation** (branch
  `milestone/P3M3-augmentation`, ADR-020). Extended `augment_sequences` with three
  **opt-in (default off)** primitives — `drop_landmarks` (per-joint dropout),
  `rotate_xy` (in-plane rotation; safe — normalization isn't orientation-canonical),
  `time_warp` (end-anchored speed; keeps the GRU-read last frame). Added an `aug`
  pass-through to `cross_validate` + `crossval --aug` preset. **Prototype on the
  starter-20 signer-disjoint gate: top-1 0.570 → 0.601** (+3 pts; top-5 ~flat) —
  directional, final tuning on P3M2 data. **Mirroring + time-shift deferred**
  (skew-prone under the handedness-collapsing hand normalization + front-padded
  last-timestep design; Q9 flags deferred with them) — recognition.md §6.4. +7 pytest
  (75); ruff/mypy/pytest green. Plain training unchanged (knobs default off). **Merged**
  ([PR #23](https://github.com/aakash-tir/sign-app/pull/23), squash `1bec4d2`); both CI
  lanes green.
- **2026-05-24** — **P3M2 (part 1): MS-ASL ingest — adapter + download script**
  (branch `milestone/P3M2-msasl-ingest`). After the dataset review (see
  [`docs/phase3.md`](docs/phase3.md) review log): of the owner-provided candidates,
  **only MS-ASL (C-UDA) is license-clear to train-and-ship** — ASL Citizen and
  ASLLVD are research/non-commercial with no model carve-out (owner declined the
  permission route); SignAvatars (3D mesh) and How2Sign (continuous) rejected; the
  How2Sign related-datasets sweep surfaced nothing new+permissive. Built
  `ml/src/sign_ml/msasl.py` (`MsaslAdapter` + `load_msasl_index` +
  `youtube_id_from_url`; signer ids namespaced `msasl:<id>`) and
  `msasl_download.py` (yt-dlp segment fetch, link-rot-tolerant, realized-coverage
  report; `--extra msasl`, needs ffmpeg). Fixed a Windows `--help` crash (unicode in
  the argparse docstring → ASCII). +6 pytest (68); ruff/mypy/pytest green. Continuous
  ASL (How2Sign) noted as a future **sentence-content** track (ADR-012), not
  recognition. **Next (owner):** download MS-ASL annotations → run the fetch → I wire
  combined extract + retrain + signer-disjoint re-gate. **Merged**
  ([PR #22](https://github.com/aakash-tir/sign-app/pull/22), squash `9972fd7`); both
  CI lanes green. **P3M2 part 2 (extract+retrain) is owner-gated** on the MS-ASL
  download — proceeding to **P3M3** (augmentation, unblocked) meanwhile.
- **2026-05-24** — **P3M1: honest signer-disjoint evaluation** (branch
  `milestone/P3M1-honest-eval`, ADR-019). Made the dynamic ship gate
  **signer-disjoint** instead of stratified-clip: new pure `signer_folds` (whole
  signers per fold, greedy-balanced by sample count, unknown signers → singletons,
  no leakage) + `cross_validate(signer_ids=…)`; `extract_dataset` now also returns a
  signer column and the CLI caches `signers.npy` and uses it by default (`--stratified`
  forces the old comparison). Measured the honest baseline on the starter-20 cache
  (n=193, 36 signers, reconstructed + verified signers aligned to the existing X):
  **signer-disjoint top-1 0.570 / top-5 0.922** vs stratified **0.622 / 0.953**
  (leakage ≈ +5 pts); per-gloss in recognition.md §6.3. Under the honest gate
  good/want/love slip < 0.50 but **we don't re-gate now** (small-n CV is noisy; the
  shipped model is the 24-gloss set — re-gate lands in P3M2 on more data). Real-camera
  holdout deferred (no clips yet). +4 pytest (62 total); ruff/mypy/pytest green. Also
  bundles the Phase-3 plan docs (phase3.md, ADR-019/020, Q6–Q9, output.md analysis).
  **Merged** ([PR #21](https://github.com/aakash-tir/sign-app/pull/21), squash
  `fa823ec`); both CI lanes + Cloudflare build green.
- **2026-05-23** — **P2M6: tab-hidden camera release** (branch
  `milestone/P2M6-camera-visibility`). `CameraProvider` now listens for
  `visibilitychange`: when the browser tab is hidden it stops the camera tracks
  (privacy LED off, battery) while staying logically `on`, and re-acquires silently
  on return (permission persists → no re-prompt; manual stop cancels resume).
  Resolves the ADR-018 deferral (auto-resume across full reloads still intentionally
  out). +1 vitest (151) / 15 playwright; gates green. (Follow-up after the Phase 2
  close.)
- **2026-05-23** — **Phase 2 closed.** All five plan items merged + deployed;
  verified live on the deployed URL (model metadata + the 4 new reference clips
  served from the edge). 20 dynamic signs + 24 letters in production. No work in
  progress. Future backlog (not started): MS-ASL download → retrain (P2M5c, owner),
  tab-hidden camera release (ADR-018), real multi-sign Learn sentences (ADR-012).
- **2026-05-22** — **P2M5b: vocabulary expansion from on-disk WLASL** (branch
  `milestone/P2M5b-vocab-expansion`). Owner chose to broaden signs without a new
  download. Added `EXPANSION_GLOSSES` + a `--vocab expanded` extract flag; extracted
  a 32-gloss set, found adding all 12 candidates regressed the existing signs
  (32-gloss CV 0.46, 7 shipped signs dropped < 0.50), so **subset to the 4 that
  clear the gate with margin** (walk 0.91 / tall 0.69 / cold 0.67 / before 0.62;
  24-gloss CV 0.58). Retrained the 24-gloss GRU → bundled ONNX (`frontend/public/
  models/dynamic/`); **`SHIPPED_GLOSSES` 16 → 20** (existing retained, not demoted on
  noisy CV); generated reference clips for the 4 new signs. recognition.md §6.2
  documents it. +tests updated (vocab 20, practice bank 44). 150 vitest / 15
  playwright / ruff·mypy·pytest 58 green. **P2M5c (future, owner):** MS-ASL download
  for more clips-per-sign.
- **2026-05-22** — **P2M5a: canonical ingest layer** (branch
  `milestone/P2M5-dataset-ingest`, FR-18). Per the plan, built the
  ingest-normalization foundation and **proved it on current data before adding
  new data**. New `ml/.../ingest.py`: `CanonicalSample` + `DatasetAdapter` protocol
  + `canonical_label` (+ synonyms) + **`assign_signer_disjoint_splits`** (whole
  signers dealt to one split → no train/test leakage, the documented
  accuracy-overstatement fix) + vocab/coverage. `wlasl.py` now parses `signer_id`
  and exposes `WlaslAdapter`. CLI proof on current data: 193 samples / 20 labels /
  36 signers / 157-train+36-test signer-disjoint split. +8 pytest (58); ruff/mypy
  green. **P2M5b (owner action):** download a dataset to actually expand — MS-ASL
  is C-UDA-cleared (ADR-016) but YouTube-URL-based (link rot) + large, so it's an
  owner download; then add an `MsaslAdapter`, extract, retrain with signer-disjoint
  splits, re-gate vocab. Awaiting commit + PR.
- **2026-05-22** — **P2M4 implemented** (branch `milestone/P2M4-sign-reference`,
  FR-17, ADR-017). Replaced the external signasl.org links (which broke offline)
  with an **in-app sign reference rendered from landmarks**. New ml
  `reference_export.py` extracts one representative WLASL clip per shipped gloss →
  `frontend/public/reference/<gloss>.json` (16 files, ~304 KB, committed like the
  ONNX model). New `SignReferencePlayer` + `signReferenceData` loader loop the clip
  on a canvas via `drawHolistic`; wired into DynamicSignView / Practice reveal /
  Learn signs; deleted `content/signReference.ts`. Reference precached offline (PWA
  globs json). Letters keep `LETTER_HINTS` (never used the link). Source = WLASL-
  derived skeletons (no self-capture available; abstract derived data per ADR-016).
  Verified "drink" renders a recognizable hand-to-face animation. **150 vitest / 15
  playwright**; ml gates (ruff/mypy/pytest 50) green. Awaiting commit + PR.
- **2026-05-22** — **P2M3 implemented** (branch `milestone/P2M3-ui-redesign`, FR-16).
  Full UI redesign, CSS-only (no new deps). Root cause of "buttons not visible" was
  **no button styling** (browser defaults). Rebuilt `index.css` as a light/dark
  **design-token system** + one **button system** (primary / `*-secondary` /
  `button[aria-pressed]` toggle, focus rings, 44px targets); removed vestigial
  template CSS. New **pill nav** + header (`App.css`); **cards** + token colors
  across Camera/Practice/Learn/Settings; new `CameraPlaceholder` ("Camera is off")
  fills the empty stage. Verified via light+dark screenshots; **149 vitest / 15
  playwright**, format/lint/tsc green. Awaiting commit + PR.
- **2026-05-22** — **P2M2 perf pass.** Owner clarified the remaining slowness was
  the **one-time model warm-up** on the default Practice tab (not a stream
  restart — the stream genuinely persists). Two improvements: (1) **throttled
  detection to ~30 FPS** in all three recognition loops (was per-animation-frame) —
  matches the trained window cadence, halves CPU on 60 Hz devices, keeps navigation
  responsive while the camera stays on; (2) hooks expose **`ready`** and each camera
  view shows a brief **"Preparing recognition…"** note during first load. 149 vitest
  / 15 playwright, all gates green.
- **2026-05-22** — **P2M2 review fixes.** Owner found two regressions from the
  camera staying on: (1) Learn's camera was black — its `<video>` mounts after a
  "Loading…" gate, and the attach effect didn't re-run; fixed by making `useCamera`
  use a **callback ref** (loops read a separate `videoEl`). (2) Tab switches were
  laggy — every mount re-initialized MediaPipe/ONNX; fixed by **caching the Hand +
  Holistic detectors and the ONNX session as app-lifetime singletons** (close() is a
  no-op; cache resets on init failure for retry). +3 tests (`useCamera.test.tsx` +
  an FR-15 Learn-tab e2e); hardened a flaky PracticeMode `setMode` assertion with
  `waitFor`. **149 vitest / 15 playwright**, all gates green.
- **2026-05-22** — **P2M2 implemented** (branch `milestone/P2M2-camera-permission`,
  FR-15, ADR-018). Hoisted the camera to an app-level **`CameraProvider`** above the
  router that owns a single shared `MediaStream`; split context/hook into
  `cameraContext.ts` and the component into `cameraProvider.tsx`. `useCamera` is now
  a thin adapter that wires the shared stream to the current view's `<video>` and
  **never calls `getUserMedia` or stops the camera on unmount** — so switching tabs
  no longer forces "Enable camera" again. Added a **one-time privacy explainer**
  (`profile.cameraExplainerSeen` + `WordBankRepo.setCameraExplainerSeen`). The 3
  recognition hooks were untouched (same `useCamera` shape). Updated react.md
  (camera-ownership rule) per ADR-018. +4 tests (**147 vitest**, **14 playwright**
  incl. an FR-15 tab-switch e2e); all gates green. **Deferred:** tab-hidden
  release/resume via `visibilitychange`. Awaiting commit + PR.
- **2026-05-22** — **P2M1: made the finger coloring a Settings toggle** (owner
  preferred the classic look as default). Added `overlayColorMode` (`classic` |
  `per-finger`) to the profile (default `classic`; legacy profiles default in
  `getProfile`) + `WordBankRepo.setOverlayColorMode`; a module store
  `recognition/overlayColorMode.ts` (read live by the draw loops via
  `getOverlayColorMode`, reactive for UI via `useOverlayColorMode`,
  hydrated once in `App`); draw functions take a `colorMode` param (default
  `classic`); Settings gained an "Overlay colors" Default/Per-finger control. Both
  modes keep the off-frame stray-line guard. +7 tests (**143 vitest** / 13
  playwright); all gates green. Pushed to PR #13.
- **2026-05-22** — **P2M1 implemented** (branch `milestone/P2M1-finger-colors`).
  New pure `frontend/src/recognition/fingerColors.ts`: `fingerOfLandmark` /
  `fingerOfConnection` (a bone is a finger's only when both endpoints share it; wrist
  spokes + knuckle bridges = palm), colorblind-safe Okabe–Ito `FINGER_COLORS`, and an
  `isInFrame` guard. Refactored `drawLandmarks.ts` (`drawHands`) and `drawHolistic.ts`
  to color each finger distinctly (palm/wrist neutral) and to skip off-frame
  points/bones — fixing the stray skeleton lines shooting to the corner (the `fi.png`
  issue). Pose stays single-color. Added a recording mock-canvas test util
  (`src/test/mockCanvas.ts`) + 3 new test files (fingerColors + both draw fns):
  **136 vitest (+18) / 13 playwright**, all gates green; **no model/recognition
  change**. Also gitignored a stray root `MS-ASL/` dataset folder (ADR-014). Awaiting
  commit + PR.
- **2026-05-21** — **Phase 2 kicked off.** Authored [`docs/phase2.md`](docs/phase2.md)
  (P2M1–P2M5 from the owner's 5 plan items, sequenced cheap/isolated-first).
  Registered FR-14…FR-18 in `project-context.md`. Added ADR-016 (MS-ASL cleared for
  **training only** under C-UDA — model is an unrestricted "Result"; source videos
  not shipped) and ADR-017 (in-app sign reference **rendered from landmarks**,
  superseding M6.4's external signasl.org links / restoring offline). **P2M1**
  (per-finger overlay colors, FR-14) fully scoped: pure color-mapping module +
  refactor of `drawLandmarks.ts`/`drawHolistic.ts` + off-frame stray-line cleanup;
  Vitest for the pure mapping and the draw fns (mock canvas); **no model change**.
  Updated `CLAUDE.md` doc map + status. Awaiting go-ahead to implement P2M1.
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
- **2026-05-21** — **🎉 M7 merged (#12) + DEPLOYED — project complete (M0–M7).**
  Live at https://sign-app.aakashtirathdas.workers.dev via **Cloudflare Workers
  Static Assets** (the dashboard now funnels Git deploys to Workers, not classic
  Pages). Setup: build `npm install && npm run build`, deploy `npx wrangler deploy`,
  Path `frontend`, `NODE_VERSION=20`; `frontend/wrangler.jsonc` serves `dist` with
  SPA fallback. First deploy failed on a Pages-style `_redirects` rule (infinite
  loop on Workers) — removed it (SPA handled by wrangler config). Verified shell +
  SPA routing 200 and model assets served from the edge. Auto-deploys on push to
  `main`. (Also untracked stray local files: `/images/`, `/input.md`.)
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
