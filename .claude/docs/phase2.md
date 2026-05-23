# Phase 2 — Depth & Polish

> **Phase 1 (M0–M7) is complete and deployed.** The app works end-to-end and is
> live (see [`../progress.md`](../progress.md)). Phase 2 is about **depth and
> polish** — more data, in-app learning, and a better, more usable experience —
> not new top-level features.
>
> This file is kept **separate from** [`milestones.md`](milestones.md) (phase 1) so
> neither grows unwieldy. The owner's phase-2 plan is in
> [`../../plan.md`](../../plan.md); per-section analysis is in
> [`../../output.md`](../../output.md).

## Source of the plan

Phase 2 originates from five owner-raised improvements (numbered #1–#5 in
[`../../plan.md`](../../plan.md)). They are sequenced cheap/isolated-first, so the
**plan-item number ≠ milestone number**:

| Milestone | Plan item | Theme | Status |
| --- | --- | --- | --- |
| **P2M1** | #5 | Hand-overlay color toggle (classic / per-finger) | ☑ merged [#13](https://github.com/aakash-tir/sign-app/pull/13) |
| **P2M2** | #3 | Camera persists across views (shared stream) + one-time explainer | ☑ merged [#14](https://github.com/aakash-tir/sign-app/pull/14) |
| **P2M3** | #2 | Full UI redesign (contrast, hierarchy, accessibility) | ☑ merged [#15](https://github.com/aakash-tir/sign-app/pull/15) |
| **P2M4** | #4 | In-app sign reference, rendered from landmarks (no external sites) | ☑ merged [#16](https://github.com/aakash-tir/sign-app/pull/16) |
| **P2M5** | #1 | Dataset expansion behind a canonical ingest-normalization layer | ☑ merged — P2M5a [#17](https://github.com/aakash-tir/sign-app/pull/17) + P2M5b [#18](https://github.com/aakash-tir/sign-app/pull/18); MS-ASL = future owner action |

Legend: ☐ planned · ◐ in progress / scoping · ☑ merged. Order after P2M1 is
tentative and may be re-prioritized; items are independent enough to reorder.

## Conventions (unchanged from phase 1)

Same working agreement and green-gates workflow as
[`../rules/workflow.md`](../rules/workflow.md):

- **Branch:** `milestone/P2MX-short-slug` (e.g. `milestone/P2M1-finger-colors`).
- **One milestone at a time**, each its own branch → PR → **squash-merge** into
  `main`; merge only when **all gates are green** (Frontend: Prettier + ESLint +
  `tsc --noEmit` + Vitest + Playwright; Python: `ruff format` + `ruff check` +
  `mypy` + `pytest`).
- **Every milestone ships tests** proving its feature and updates `.claude/` docs
  (especially [`../progress.md`](../progress.md)).
- New functional requirements **FR-14 … FR-18** are registered in
  [`../project-context.md`](../project-context.md) §6 and referenced below.

---

## P2M1 — Per-finger colors in the hand-tracking overlay

**Plan item #5 · FR-14 · branch `milestone/P2M1-finger-colors`**

**Goal:** make the live hand overlay easier to read by offering a **per-finger color
mode** (each finger a distinct, colorblind-safe color; palm/wrist neutral) **as a
user-selectable choice in Settings**, alongside the original **classic** look (pink
dots / blue bones) which stays the **default**. Applies to both the static-letter and
holistic overlays. This is the cheapest, most isolated phase-2 win: **pure rendering
— no model, no retraining, no recognition change.**

> **Why a toggle:** the owner preferred the cleaner classic look as the default but
> wanted per-finger available — so the choice is persisted in the profile and read
> live by the draw loops.

### Scope & rationale

- The overlay color change is **purely a human-readability aid**. The classifier
  works from normalized coordinates and never sees the overlay, so this **does not
  change recognition accuracy** — it helps the *learner* self-correct and helps *us*
  debug confusable signs. (Expectation correction from
  [`../../output.md`](../../output.md) §5.)
- Two draw paths exist and both must be updated:
  - `frontend/src/recognition/drawLandmarks.ts` (`drawHands`) — static letter view,
    used by `useSignRecognition`. Currently one connection color + one landmark
    color.
  - `frontend/src/recognition/drawHolistic.ts` (`drawHolistic`) — dynamic / unified
    view, used by `useDynamicSignRecognition` + `useUnifiedSignRecognition`. Pose +
    both hands.
- `HAND_CONNECTIONS` in `recognition/types.ts` is already grouped by finger, which
  makes the mapping straightforward (thumb 1–4, index 5–8, middle 9–12, ring 13–16,
  pinky 17–20; wrist 0 + palm bridges stay default).

### Deliverables

1. **Pure color-mapping module** (e.g. `recognition/fingerColors.ts`):
   - `fingerOfLandmark(index)` → `thumb | index | middle | ring | pinky | palm`
     for all 21 hand-landmark indices.
   - `fingerOfConnection([a, b])` → finger group for each `HAND_CONNECTIONS` entry;
     palm/inter-finger bridges (`[0,17]`, `[0,5]`, `[5,9]`, `[9,13]`, `[13,17]`)
     classify as `palm` (default color).
   - A **colorblind-safe palette** (e.g. Okabe–Ito) mapping each finger → color,
     with the palm/wrist using the existing default. Exported as data so tests and
     both draw functions share one source of truth.
2. **Refactor `drawHands` and `drawHolistic`** to color hand points and bones
   per-finger via the mapping. Pose drawing keeps its current style.
3. **Stray-line cleanup (the `fi.png` issue):** guard pose/hand connections so
   segments with an **off-frame endpoint** (outside [0,1], or unset/zero points)
   are **not drawn** — this removes the long lines shooting to the corner.
   *(Capturing per-landmark `visibility` into the `Landmark` type for smarter
   culling is a larger change and is an optional follow-up, not in P2M1.)*
4. **Settings toggle + persistence:** an `overlayColorMode` (`classic` | `per-finger`)
   field on the user profile (default `classic`); a module store
   (`overlayColorMode.ts`) read live by the draw loops and exposed to React via
   `useOverlayColorMode`; a Settings UI control to switch. The draw functions take a
   `colorMode` param (default `classic`).
5. *(Optional / stretch)* a small **legend** component showing the finger→color key.

### Acceptance

- The overlay defaults to the **classic** look; the user can switch to **per-finger**
  in Settings and the choice **persists** and takes effect live (FR-14).
- In per-finger mode each finger renders in its own distinct, colorblind-safe color
  in **both** the static (`drawHands`) and holistic (`drawHolistic`) overlays;
  palm/wrist use the neutral color.
- The pure color-mapping module classifies **all 21 landmark indices** and **all
  `HAND_CONNECTIONS` entries** unambiguously (each to exactly one group).
- Off-frame connection segments are no longer drawn (stray-line guard, both modes).
- No change to any model, normalization, or recognition behavior.
- All gates green.

### Tests

- **Vitest (pure logic):** `fingerColors` — every landmark index 0–20 maps to one
  finger; each finger has a distinct palette color; connection classification
  (finger bones vs palm bridges); palette is colorblind-distinct; the off-frame
  guard predicate skips out-of-range/unset endpoints.
- **Vitest (draw functions):** call `drawHands` / `drawHolistic` with a **mock
  `CanvasRenderingContext2D`** (jsdom) and assert the recorded `strokeStyle` /
  `fillStyle` sequence matches the expected per-finger colors and that a
  fabricated off-frame segment is skipped. *(There are currently no `draw*.test.ts`
  files — this milestone adds them.)*
- **Playwright:** existing camera/overlay views still mount and render with a fake
  stream (no pixel-color assertion — color logic is covered by Vitest).

### Non-goals (P2M1)

- No recognition / model / training changes.
- No camera-permission or shared-stream work (that is **P2M2**).
- No capture of landmark `visibility` into the type system (optional follow-up).

---

## P2M2 — Camera persists across views (shared stream) + one-time explainer

**Plan item #3 · FR-15 · ADR-018.** Each view used to tear down its own
`MediaStream` (per the old "release on unmount" rule), forcing an "Enable camera"
click on every tab switch — even though the browser permission already persists.

**Built:**

- **`CameraProvider`** (`recognition/cameraProvider.tsx`) mounted **above the
  router** in `App` owns the **single shared `MediaStream`** + status; the stream
  survives view switches.
- **`useCamera` is now a thin adapter** (`recognition/cameraContext.ts` holds the
  context + `useCameraContext`): it attaches the shared stream to the current
  view's `<video>` and re-exposes `status`/`start`/`stop`. It **never calls
  `getUserMedia` and never stops the camera on unmount** — only `stop()` (user) or
  app teardown releases the device. The 3 recognition hooks were unchanged (same
  `useCamera` shape).
- **One-time privacy explainer** before the first acquire, remembered via
  `profile.cameraExplainerSeen` ("video never leaves your device"). Manual
  enable/disable stays in each camera view.
- **ADR-018** records this and **supersedes** the "release on unmount" rule in
  [`../rules/frontend/react.md`](../rules/frontend/react.md).

**Two fixes from owner review** (the camera now staying on exposed these):

- **Late-mounted video:** `useCamera` uses a **callback ref** so a `<video>` that
  mounts *after* the stream is on (behind the "Loading…" gate in Learn/Practice)
  still attaches the shared stream. (Previously the attach effect only ran on
  mount/stream-change, so Learn's video stayed black.)
- **Tab-switch lag:** the MediaPipe detectors and the ONNX session are now
  **app-lifetime singletons** (cached in `holisticDetector.ts` / `mediapipeDetector.ts`
  / `onnxDynamicClassifier.ts`), so navigating between camera views reuses them
  instead of re-initializing WASM + models on every mount.
- **Main-thread saturation:** detection is **throttled to ~30 FPS** in all three
  recognition loops (was every animation frame) — it matches the dynamic model's
  trained window cadence, roughly halves CPU on 60 Hz devices, and keeps navigation
  responsive while the camera stays on. (The fake-stream e2e didn't catch this; real
  Holistic inference is far heavier.)
- **First-load feedback:** the hooks expose `ready`, and each camera view shows a
  brief **"Preparing recognition…"** note while the model loads, so the one-time
  warm-up (first enable on the default Practice tab) reads as loading, not frozen.

**Tests:** `cameraContext.test.tsx` (explainer gating, enable→on, stop releases
the track), repo `setCameraExplainerSeen`, and an e2e proving the camera **stays on
across a Camera→Signs tab switch with no re-enable** (FR-15). 147 vitest / 14
playwright.

**Deferred follow-up:** release tracks on `visibilitychange`→hidden + re-acquire on
return (battery/privacy LED), and optional auto-resume across reloads — see ADR-018.
Until then the camera stays on across all routes until the user stops it.

## P2M3 — Full UI redesign

**Plan item #2 · FR-16.** Owner: "not user-friendly, buttons not always visible."
Root cause: the app had **no button styling at all** (browser defaults — pale and
low-contrast on dark), hardcoded slate colors per view, a fixed 1126px column, and
leftover Vite-template CSS.

**Built (CSS-only — no new deps, bundle unaffected):**

- **Design-token foundation** (`index.css`): light/dark token system (bg, surface,
  text, muted, border, accent, success, danger, radii, shadow, focus ring) + a
  single **button system** — default = primary (solid accent), `*-secondary` = quiet
  surface, `button[aria-pressed]` = segmented toggle (selected = accent). Consistent
  focus-visible rings and ≥44px touch targets. Removed the vestigial template CSS.
- **Header + pill nav** (`App.css`): centered 760px column; rounded nav bar with an
  accent pill for the active tab; wraps on mobile.
- **View styling to tokens + cards** (Camera/Practice/Learn/Settings): prompt and
  settings **cards** (surface + border + shadow), readable hierarchy, letter-grid
  tiles, result chips; all hardcoded colors replaced with tokens; the explainer
  modal aligned too.
- **Camera-off placeholder** (`CameraPlaceholder.tsx`): a camera icon + "Camera is
  off" inside the stage so it no longer reads as a broken black box.

**Verified:** screenshots in **light + dark** (Settings + Practice) look clean and
high-contrast; **149 vitest / 15 playwright**, format/lint/tsc green.

## P2M4 — In-app sign reference, rendered from landmarks

**Plan item #4 · FR-17 · ADR-017.** `content/signReference.ts` linked out to
signasl.org, which **broke the offline guarantee** M7 delivered (and only dynamic
signs used it — letters already show in-app `LETTER_HINTS` text).

**Built:**

- **ML exporter** (`ml/.../reference_export.py`): one representative WLASL clip per
  shipped gloss → holistic re-extraction → raw pose+hand **x,y** frames
  (downsampled to 24, rounded) → `frontend/public/reference/<gloss>.json` (~18 KB
  each, 16 files). Deterministic clip pick; committed artifacts like the ONNX model.
- **`SignReferencePlayer`** + `signReferenceData` loader: fetches a gloss's clip and
  **loops it on a canvas via the same `drawHolistic`** overlay the learner sees live.
  Precached for offline (PWA `globPatterns` already includes `json`).
- Replaced the external `<a>` links in DynamicSignView / PracticeMode reveal /
  LearnMode signs with the player; deleted `content/signReference.ts`.

**Source note (ADR-017):** lacking self-capture, the reference uses **WLASL-derived
landmark skeletons** (not source video) — abstract derived data, consistent with
ADR-016's computational-use framing.

**Verified:** the "drink" reference renders a recognizable hand-to-face animation
(screenshot); **150 vitest / 15 playwright**, all ml + frontend gates green.

## P2M5 — Dataset expansion behind a canonical ingest layer

**Plan item #1 · FR-18 · ADR-016.** Per the plan, **the ingest layer comes first
and is proven on the current data before any new dataset is added.**

**Built (P2M5a — the foundation, autonomous, no new download):**

- **`ml/.../ingest.py`** — the canonical contract: `CanonicalSample`
  (`label, source, clip_id, signer_id, split, video_path`), a `DatasetAdapter`
  Protocol, `canonical_label` (lowercase/whitespace + synonym map), `merge`,
  `vocabulary`, `coverage_by_label`, and **`assign_signer_disjoint_splits`** — the
  key correction from [`../../output.md`](../../output.md) §1: standardize the
  **output contract** (canonical labels + **signer-disjoint splits**), not pixel
  size. Signer-disjoint splits prevent the train/test signer leakage that inflates
  held-out accuracy.
- **`wlasl.py`** now parses `signer_id` and exposes a **`WlaslAdapter`** conforming
  to the contract — proving it on the current data: `python -m sign_ml.ingest`
  reports 193 samples / 20 labels / **36 signers**, a 157-train / 36-test
  signer-disjoint split, and per-label coverage. +8 pytest (58 total); ml gates
  green.
- A **new dataset plugs in by implementing one `DatasetAdapter`** — the heavy
  landmark extraction stays in `dynamic_extract.py`.

**Done (P2M5b — expand from WLASL clips already on disk, owner-chosen):**

- Screened 12 high-coverage everyday glosses; **shipped the 4 that cleared the
  0.50 gate with margin** — `walk`/`tall`/`cold`/`before` (24-gloss CV ≈ 0.58 top-1;
  see [`recognition.md`](recognition.md) §6.2). The other 8 scored < 0.45 and were
  dropped (local coverage ~10–16 clips/gloss caps accuracy).
- Retrained the 24-gloss GRU → bundled ONNX; `SHIPPED_GLOSSES` now **20 signs**
  (curated 16 retained + 4 new); reference clips generated for the 4. `--vocab`
  flag on the extract CLI makes it reproducible.

**Future (P2M5c — needs the owner + a big retrain):**

- For meaningfully **more clips per sign** (accuracy, not just breadth), download a
  new dataset. **MS-ASL** is cleared for training (C-UDA, ADR-016) but
  **YouTube-URL-based → link rot** and large — an **owner action** (per
  [`../rules/workflow.md`](../rules/workflow.md)). Then add an `MsaslAdapter` (the
  ingest layer is ready), extract, retrain with signer-disjoint splits, re-gate.

---

## Dependency / sequencing notes

- **P2M1** is fully independent (rendering only) — safe first.
- **P2M2** and **P2M3** are both UX; P2M2 (shared camera) should land before or with
  P2M3 so the redesign builds on the final camera affordances.
- **P2M4** depends on having landmark data to render from (already available from
  phase-1 training).
- **P2M5** is independent of the UX work but is the largest; it can proceed in
  parallel conceptually but is sequenced last to front-load momentum.
