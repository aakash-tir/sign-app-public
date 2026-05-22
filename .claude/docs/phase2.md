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
| **P2M2** | #3 | Camera permission persists across views (shared stream) | ☐ planned |
| **P2M3** | #2 | Full UI redesign (contrast, hierarchy, accessibility) | ☐ planned |
| **P2M4** | #4 | In-app sign reference, rendered from landmarks (no external sites) | ☐ planned |
| **P2M5** | #1 | Dataset expansion behind a canonical ingest-normalization layer | ☐ planned |

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

## P2M2 — Camera permission persists across views *(planned)*

**Plan item #3 · FR-15.** Today each view tears down its own `MediaStream` (per the
"release on unmount" rule) and re-prompts an "Enable camera" click on every tab
switch — the browser permission itself already persists. Plan: **hoist the camera to
one app-level provider** owning a single shared stream + global on/off toggle; views
subscribe; persist the user's preference and **auto-start when permission is already
granted** (`navigator.permissions.query`); keep a **one-time privacy explainer**
("video never leaves your device"); still allow manual disable/enable.

**Pending decision (ADR when scoped):** this **supersedes the current
"release camera on unmount" rule** ([`../rules/frontend/react.md`](../rules/frontend/react.md)).
Proposed compromise: release on tab-hidden / `visibilitychange` + app unload
(battery + privacy LED) and re-acquire silently on return. Needs owner sign-off →
write an ADR before implementation.

## P2M3 — Full UI redesign *(planned)*

**Plan item #2 · FR-16.** Owner: "not user-friendly, buttons not always visible."
From the screenshots the dark theme is fine; the problems are **low-contrast
buttons**, **no visual hierarchy / dead space**, and the **empty camera box reading
as broken**. Plan: a small **design-token layer** (CSS variables) + consistent
button system (primary/secondary/ghost, visible focus), camera **placeholder
state**, WCAG-AA contrast, mobile-first responsive. **Constraint:** do not regress
bundle size / offline — prefer hand-rolled CSS over a heavy component library. Keep
Playwright green throughout; define visual "done" criteria up front.

## P2M4 — In-app sign reference, rendered from landmarks *(planned)*

**Plan item #4 · FR-17 · ADR-017.** Today `content/signReference.ts` links out to
signasl.org, which **breaks the offline guarantee** M7 delivered. Plan
(owner-confirmed): **render teaching visuals from landmark data** — animated for
dynamic signs, stills/arrows for static — so the content is **owned, offline, and
visually consistent with the live tracker**. Prefer landmarks **we fully control**
(authored reference poses / our own captures) over MS-ASL-derived landmarks to keep
the content unambiguously clean (see ADR-017).

## P2M5 — Dataset expansion behind a canonical ingest layer *(planned)*

**Plan item #1 · FR-18 · ADR-016.** Bigger and riskiest; likely splits into
sub-milestones. **Do the ingest-normalization layer first, then add data.** Key
correction from [`../../output.md`](../../output.md) §1: because the model trains on
*landmarks*, **image resolution barely matters** — standardize the **output
contract** (canonical label vocab, fixed window length, signer-disjoint splits,
handedness), not pixel size. Formalize a `DatasetAdapter`
(`raw → (canonical_label, landmark_frames, signer_id, split)`); reuse the
golden-vector fixtures as the regression guard. **Data target:** **MS-ASL**
(training only — cleared under **C-UDA**, see ADR-016) plus individually-vetted
datasets from the discovery lists the owner provided; expect MS-ASL **link rot**
(YouTube-URL-based). No source videos ship in the app.

---

## Dependency / sequencing notes

- **P2M1** is fully independent (rendering only) — safe first.
- **P2M2** and **P2M3** are both UX; P2M2 (shared camera) should land before or with
  P2M3 so the redesign builds on the final camera affordances.
- **P2M4** depends on having landmark data to render from (already available from
  phase-1 training).
- **P2M5** is independent of the UX work but is the largest; it can proceed in
  parallel conceptually but is sequenced last to front-load momentum.
