# Feedback on the Phase 2 Plan

My thoughts on each section of [`plan.md`](plan.md), informed by the current
codebase (M0–M7) and your screenshots. TL;DR: the priorities are sound and several
items are cheaper than they look — but a couple rest on assumptions worth
correcting before you build.

---

## Overall

- **Good instinct:** Phase 2 is mostly about *depth and polish* (more data,
  in-app learning, better UX) rather than new features. That's the right thing to
  do before widening scope.
- **Mixed concerns:** the five items span four very different disciplines — ML data
  pipeline (#1), UX/visual design (#2, #3), content/licensing (#4), and rendering
  (#5). Treat each as its own milestone/branch/PR under the existing green-gates
  workflow, not one big push.
- **Suggested order:** **#5 → #3 → #2 → #4 → #1.** Start with the cheap, isolated
  wins (#5 is pure rendering; #3 is a focused refactor), then the UI redesign (#2)
  which #4's teaching media will plug into, and finish with #1 (the largest, riskiest,
  and the one most likely to spawn sub-milestones). The one argument for doing #1
  *first* is that it's foundational — but it won't block the others, so front-load
  momentum instead.

---

## 1. Expand the dataset (with a normalization layer first)

**Verdict: right priority, but disentangle two different "normalizations."**

Doing the normalization layer before adding data is exactly correct. The catch is
that "normalization" means two separate things here, and the plan blurs them:

1. **Landmark normalization** — *already exists and is frozen.* See
   `frontend/src/recognition/normalization.ts` + `dynamicNormalization.ts` and
   their Python mirrors, locked by golden-vector fixtures (spec id
   `pose-shoulder-hands-v1`, 161-d frames). This already makes inputs scale-,
   translation-, and (largely) signer-position-invariant.
2. **Dataset *ingest* normalization** — *what you're actually describing.* Messy
   raw sources → one canonical format. This sits **upstream** of landmark
   extraction.

> **Important correction:** because the model trains on *landmarks*, raw image
> **size/resolution barely matters** — MediaPipe extracts landmarks at any input
> size and our normalization removes scale. So "make everything one size" is the
> wrong axis to standardize on. The things that *actually* cause train/serve skew
> across datasets are:
> - **Label/vocabulary harmonization** — different sources name the same gloss
>   differently. You need one canonical vocab + a per-source mapping.
> - **Signer-disjoint splits** — your own progress notes flag shared-signer
>   leakage as why held-out accuracy (≈99.5% static, ≈62% dynamic CV) overstates
>   real-camera accuracy. Mixing datasets makes this *worse* unless splits are
>   enforced by signer/source.
> - **Dynamic clip length & fps** — for word-level signs, the frame-window
>   contract (30 frames) is the real "one size," not pixels.
> - **Handedness** — left/right normalization must be consistent.

**Concrete suggestion:** formalize a `DatasetAdapter` contract (you already have the
pattern in `ml/src/sign_ml/.../wlasl.py`). Each new source implements
`raw → (canonical_label, landmark_frames, signer_id, split)`. The "one size /
restrictions" you want is best expressed as that **output contract** (fixed landmark
dimensionality + fixed window length + canonical label set), not an image dimension.
Reuse the golden-vector fixtures as the regression guard so "make sure it works for
the current setup first" is an actual passing test, not a vibe.

**Candidate sources (you provided):**

- [`yayayru/sign-language-datasets`](https://github.com/yayayru/sign-lanuage-datasets)
  and the [`sign-language-datasets` GitHub topic](https://github.com/topics/sign-language-datasets)
  — these are **discovery indexes**, not datasets. Each dataset they point to has its
  own license to vet individually before use.
- **MS-ASL** (Microsoft) — ~1000 signs / ~25k clips. Licensing checked below; it's
  cleared for training. Note it ships as **YouTube URLs + time segments**, not video
  files, so expect significant **link rot** (clips deleted/privated over the years) —
  the realized dataset will be smaller than the headline numbers.

### MS-ASL licensing — ✅ cleared for training (you may use it)

You confirmed MS-ASL will be used **only to train the model**, with **no outside
videos shipped in the app**. That is squarely permitted:

- MS-ASL is released under the **Computational Use of Data Agreement (C-UDA v1.0)**.
- **"Computational Use"** = *"activities necessary to enable the use of Data … for
  analysis by a computer."* **Training an AI/ML model qualifies** — this is the exact
  scenario C-UDA was written for.
- **Your trained model is a "Result," not Data.** The license states: *"Artificial
  intelligence models trained on Data (and which do not include more than a de minimis
  portion of Data) are Results,"* and *"the C-UDA does not impose any restriction with
  respect to the use, modification, or distribution of Results."* → **you can ship the
  model freely**, including in a public/free app.
- **What C-UDA does *not* grant:** the right to redistribute the **source Data** (the
  videos) — those carry separate third-party (YouTube) copyright. You already plan
  training-only, so this restriction never bites. The only obligation that *would*
  apply — maintaining attribution and binding downstream recipients to C-UDA — is
  triggered only if you **redistribute the Data**, which you won't.

**Bottom line:** train on MS-ASL ✅, ship the model ✅, ship MS-ASL videos/frames ❌
(you don't intend to). *Caveat: this is an informed reading, not legal advice — for a
commercial launch, a quick counsel review is cheap insurance, but C-UDA is purpose-built
for exactly this use.* Sources:
[C-UDA project](https://github.com/microsoft/Computational-Use-of-Data-Agreement) ·
[C-UDA v1.0 text](https://cdla.dev/computational-use-of-data-agreement-v1-0/) ·
[MS-ASL project](https://www.microsoft.com/en-us/research/project/ms-asl/) ·
[MS-ASL download](https://www.microsoft.com/en-us/download/details.aspx?id=100121).

---

## 2. Redesign the UI

**Verdict: agreed, and the diagnosis can be sharpened.**

Looking at `app1.png` / `app2.png`, the dark navy background itself is fine and
modern — the problems are more specific than "blue screen":

- **Contrast failure:** buttons are pale-gray fills with washed-out text (the
  level toggles, the A–Y grid, "Enable camera"/"Skip"). This likely fails WCAG AA.
  This is the single biggest "looks unfinished" signal.
- **No hierarchy / dead space:** everything is centre-aligned in one column with
  large vertical gaps and no cards or grouping. The Learn screen is ~60% empty.
- **The empty camera box reads as broken:** when the camera is off, `app2.png`
  shows a large black rectangle with no placeholder — it looks like an error, not
  a "press Enable camera" affordance.

**Concrete suggestions:**

- Introduce a tiny **design-token layer** (CSS variables for color/spacing/radius)
  and a consistent button system (primary/secondary/ghost + visible focus states).
- Give the camera area a **placeholder state** (icon + one-line CTA) instead of a
  void.
- **Caution:** you're already fighting bundle size (main chunk 416 kB, M7 fought to
  code-split). Don't pull in a heavy component library — prefer hand-rolled CSS or a
  near-zero-runtime approach so you don't regress the offline/PWA goals.
- Define **"done" criteria** up front (contrast ratios, mobile breakpoints) since a
  redesign is hard to gate automatically — and keep the Playwright tests green
  through it.

---

## 3. Fix camera re-permission on tab switch

**Verdict: real pain, but the stated cause is slightly off — which changes the fix.**

The browser **already persists the camera *permission* per origin** — the OS won't
re-prompt once granted. What's actually happening: per the frontend rule "always
release the camera (`.stop()`) on unmount," each view tears down its `MediaStream`
and shows its own "Enable camera" button, so *you* are re-acquiring the stream (and
making the user re-click) on every tab switch — not the browser re-asking.

So "the camera does not remove data from the local device" is true but beside the
point; nothing is stored either way. The friction is the manual re-enable + camera
re-acquire.

**Concrete suggestions:**

- **Hoist the camera to one app-level provider/context** that owns a single shared
  `MediaStream` and a global on/off toggle, instead of each mode owning its own.
  Views *subscribe* to the shared stream.
- Persist the user's "camera on" preference and **auto-start when permission is
  already granted** (`navigator.permissions.query({ name: 'camera' })`).
- Keep the **one-time privacy explainer** ("video never leaves your device") — it
  reinforces the on-device value prop and is genuinely reassuring.
- **Tension to resolve (worth an ADR):** this contradicts the current "release on
  unmount" rule. Compromise: release on the **`visibilitychange`/tab-hidden** and
  app-unload events (saves battery + the privacy LED), and re-acquire silently on
  return — permission persists, so no re-prompt. Still expose a manual disable.

---

## 4. Teach signs in-app (no external sites)

**Verdict: strongly agree — and it's actually an *offline correctness bug*, not just polish.**

Today `content/signReference.ts` links out to signasl.org. That doesn't just "feel"
wrong — it **breaks the offline guarantee M7 was built to deliver** (external links
fail with no network). So this aligns with a core product promise, not a nice-to-have.

The hard part is **content + licensing, not code.** Copyright-free ASL imagery is
genuinely scarce, and the WLASL videos you trained on carry their own license terms —
don't slice frames out of them as "teaching images" without checking redistribution
rights (this is exactly the kind of dataset-license item the workflow rules say to
stop and verify).

**Confirmed approach — render from landmark data** (you said yes to this):

- You already *have* landmark sequences for every sign in the training set. Render
  teaching visuals **from those landmarks** (a canonical hand/pose drawing, animated
  for dynamic signs, stills-with-arrows for static).
- This **sidesteps copyright entirely** (it's your own generated art), **works
  offline**, and is **visually consistent with the live tracker** the user sees —
  so the "target" and their "attempt" look like the same thing.
- For static letters specifically, this is easy; for dynamic signs, animated
  landmark playback solves the "images can't show motion" problem that otherwise
  forces you toward hard-to-find videos.

**One clean-room caution:** prefer rendering teaching media from landmarks you
**fully control** — your own captured signs, or idealized poses you author — rather
than from MS-ASL-derived landmarks. Landmark animations are *arguably* "Results"
under C-UDA, but authoring your own reference poses keeps the teaching content
unambiguously yours and removes any dependency on a dataset's terms. (This also
replaces the `signReference.ts` external links, restoring the offline guarantee.)

---

## 5. Per-finger colors in the hand tracker

**Verdict: nice, cheap, do it — but correct one expectation.**

This is the lowest-risk item: it lives entirely in `drawLandmarks.ts` /
`drawHolistic.ts`, is pure rendering, and needs **no model changes or retraining**.
MediaPipe's 21 hand landmarks have fixed finger groupings (thumb 1–4, index 5–8,
middle 9–12, ring 13–16, pinky 17–20; wrist + palm connections), so mapping each
finger's connections to its own color is straightforward.

**One correction:** you wrote that coloring fingers will make *recognition*
differentiate similar signs better. It won't — the model classifies from
**normalized coordinates, not colors**; the overlay is invisible to it. What
per-finger color genuinely helps is the **human**: the learner reading their own
hand, and *you* debugging why two signs get confused. That's still very worth doing —
just don't expect an accuracy bump from it.

**Bonus from your screenshot:** `fi.png` shows long stray lines shooting to the
corner — those are holistic **pose** connections running toward the body/off-frame.
Cleaning those up (skip low-visibility pose connections, or clip to frame) is a
*bigger* clarity win than the colors alone, and fits naturally in the same change.

**Suggestions:** use a colorblind-safe palette, keep the palm/wrist the default
color as you said, and add a small legend so the mapping is learnable.

---

## Open questions — resolved

- **#1 datasets:** ✅ MS-ASL (training only) + the two discovery lists. MS-ASL is
  **cleared under C-UDA** (see the licensing block in §1). Remaining sub-task: vet
  the *individual* datasets surfaced by the discovery lists as you pick them.
- **#2 direction:** ✅ **full redesign** — "not user-friendly, buttons not always
  visible." Full discretion to rebuild the visual layer (contrast, hierarchy,
  component system), keeping the bundle-size and offline constraints in mind.
- **#4 teaching media:** ✅ **render from landmarks** confirmed — no external source
  videos shipped in the app.

## Execution model (your call, noted)

You'll tackle these **one at a time, each on its own branch with its own
milestone** — i.e. continue the phase-1 green-gates workflow (next would be
**M8+**). Each milestone still ships tests and passes all gates before merge.
Suggested sequence stands: **#5 → #3 → #2 → #4 → #1** (cheap/isolated first,
biggest/riskiest last).

## Still worth confirming as each milestone starts

- **#1:** which specific datasets from the discovery lists make the cut (license +
  signer-disjoint-split feasibility per source).
- **#3:** OK to add an ADR superseding the "release camera on unmount" rule with the
  shared-stream + release-on-tab-hidden model?
