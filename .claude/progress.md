# Progress

Live status tracker. Update at the start/end of every milestone. Milestone detail
is in [`docs/milestones.md`](docs/milestones.md).

## Current state

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
- **Future data work (P2M5c → folded into P3M2):** download **MS-ASL** + any
  owner-curated, reviewed datasets for more clips-per-sign → real dynamic-sign
  accuracy; the ingest layer is ready via a small `MsaslAdapter` (ADR-016).
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
| P3M2 — Add reviewed datasets + retrain → ~50 signs | data | ◐ part 1 (ingest) ☑ merged [#22](https://github.com/aakash-tir/sign-app/pull/22); part 2 (retrain) **owner-gated** on MS-ASL fetch | `milestone/P3M2-msasl-ingest` |
| P3M3 — Expanded landmark-space augmentation | augmentation | ☑ merged [#23](https://github.com/aakash-tir/sign-app/pull/23) | `milestone/P3M3-augmentation` |

## Log

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
