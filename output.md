# Feedback on the Phase 3 Plan

My thoughts on [`plan.md`](plan.md)'s Phase 3, grounded in the current codebase
(M0–M7 + Phase 2 shipped: 20 dynamic signs, 24 letters, GRU→ONNX runtime). TL;DR:
the *goal* is right, but two of the three items rest on the same misconception that
"more raw footage = more accuracy," and one of them (open-web scraping) is the
highest-effort, highest-risk, lowest-yield path on the list. The single biggest
lever isn't the number of signs — it's **clips-per-sign × signer diversity**, plus
**an honest way to measure real-camera accuracy.** This supersedes the Phase 2
feedback that used to live here (preserved in `.claude/docs/phase2.md`).

---

## Overall — name the tension before building

The goal is *"improve accuracy AND grow to 50 signs."* Those two pull **against**
each other unless data grows faster than vocabulary:

- Today the dynamic model trains on **~193 clips across 20 glosses ≈ 10 clips/sign**,
  from ~36 signers. That is *tiny*. 5-fold CV reads **~62% top-1 / ~95% top-5**, and
  our own notes flag that even this **overstates** real-camera accuracy because of
  shared-signer leakage (the reason P2M5a built `assign_signer_disjoint_splits`).
- Going to **50 signs at the same ~10 clips/sign will lower accuracy, not raise it** —
  more classes, same thin per-class evidence, small GRU. The headline "50 signs"
  is a *vocabulary* target; it is **not** an accuracy strategy.

So reframe the goal: **"50 signs, each with enough signer-diverse clips to clear the
gate."** Set a concrete data floor per gloss (e.g. **≥ 15–20 clips from ≥ 8 distinct
signers**) and let the 50 be *whichever glosses meet that floor* across combined
sources — not a hand-picked 50 we then scrape to fill. Data availability picks the
vocabulary, not the other way around.

**Suggested order: fix measurement → MS-ASL → landmark augmentation → (maybe)
curated extra sources. Open-web scraping last, if at all.** Cheap/foundational and
high-confidence first; risky/low-yield last — same discipline as Phase 1/2.

---

## 0. (New, do first) Make accuracy *measurable* before chasing it

You can't improve what you can't trust. Right now the gate is a **per-gloss top-1
≥ 0.50 in stratified 5-fold CV** (`cross_validate` / `stratified_folds` in
`dynamic_model.py`) — but stratified folds split *clips*, so the same signer lands in
train and test and inflates the number. We already built the fix and only use it for
reporting, not gating.

**Concrete:**
- Make **signer-disjoint** (`assign_signer_disjoint_splits`, `ingest.py`) the
  *default* evaluation and the *gate*, not stratified-clip CV. Expect the honest
  number to be **lower** than 62% — that's the point; it's the one that predicts
  real use.
- Stand up a small **real-camera holdout**: a handful of self-recorded clips per
  sign (you, on the actual app camera) that **never** enter training. This is the
  only metric that catches domain shift directly. Even 3–5 clips/sign is enough to
  see whether each change helps reality or just helps CV.
- Until this exists, every "accuracy went up" claim in Phase 3 is unfalsifiable.

This is a pure-`ml/` milestone, no app changes, and it's the prerequisite that makes
items 1–3 honest.

---

## 1. MS-ASL download → retrain — ✅ green-light, highest leverage

This is the right first *data* move and the most leverage per unit risk:

- **Licensing is already cleared** — C-UDA, training-only, ship the model not the
  videos (ADR-016; the full reading is in the old Phase 2 analysis). No new legal
  work.
- **The ingest layer is built and proven** — `CanonicalSample`, `DatasetAdapter`
  protocol, `canonical_label` + synonyms, `assign_signer_disjoint_splits`, coverage
  reporting. A new source = one small `MsaslAdapter` implementing
  `raw → (canonical_label, landmark_frames, signer_id, split)`.

**Caveats to plan for:**
- **Link rot is real.** MS-ASL ships as **YouTube URLs + time segments**, not video
  files. Years on, many are deleted/private/region-locked. The realized dataset is
  **much smaller** than the ~25k-clip headline. The download script must tolerate
  failures and **report realized clips-per-gloss** so we pick vocabulary from what we
  actually got, not the manifest.
- **Pick the 50 as an intersection.** Best candidates clear *all* of: enough clips in
  MS-ASL ∪ WLASL after rot, ≥ 8 signers, pedagogically useful everyday signs, and the
  honest gate. Start from the 20 we ship, keep the ones that survive the new
  signer-disjoint gate, then add toward 50 from the data floor — don't demote working
  signs on a noisier combined CV (the P2M5b lesson).
- **Namespace signer IDs by source** (`msasl:123`, `wlasl:456`) so the disjoint split
  never accidentally treats two sources' signers as one, and so a signer who appears
  in both can't straddle train/test.
- **Owner action:** the download is large and auth/tooling-gated (`yt-dlp`, possible
  rate-limiting). Per the workflow rule, this is a "stop and ask the owner to run it"
  step — I can write the adapter + download script, you run the fetch.

---

## 2. Scrape the internet for ASL videos — ⚠️ reframe hard; this is the trap

I want to push back on this one directly, because it *sounds* like the biggest win
and is actually the biggest sink. Three problems, in order of severity:

1. **Labeling/segmentation is the killer, not collection.** Random ASL on the web is
   overwhelmingly **continuous signing** — vlogs, songs, interpreted speech — not
   isolated citation-form signs. Our model needs *one sign per clip, segmented and
   glossed*. Turning continuous video into labeled isolated-gloss clips is itself an
   unsolved research problem (it's a harder version of what our app does). So
   "scrape 10,000 videos" yields ~0 usable training clips without enormous manual
   labeling. You'd spend the whole phase annotating.
2. **Label noise destroys small models.** Even when you *can* label scraped clips,
   the web mixes regional variants, non-citation forms, errors, and fingerspelling.
   A 50-class GRU on ~15 clips/sign has no capacity to absorb noisy labels — a few
   bad clips per gloss can erase the gains from MS-ASL.
3. **Licensing is genuinely gray here, unlike MS-ASL.** Scraped clips carry
   all-rights-reserved + platform ToS, *not* C-UDA. The "we only ship the model, a
   Result" argument is plausible but **untested for arbitrary copyrighted scraped
   data** (ML-training fair use is still litigated as of early 2026). For a private
   learning project that never redistributes video the practical risk is low, but
   this is exactly the "stop and verify dataset license" case in the workflow rules —
   and it's a real step *down* in license certainty from MS-ASL.

**Reframe — what actually delivers the diversity you're after:**
- **Curated, licensed, isolated-sign dictionaries** (the Phase 2 discovery indexes:
  the `sign-language-datasets` topic, `yayayru/sign-language-datasets`). These are
  already *isolated, glossed* — vet each one's license individually as you pick it,
  then drop it behind the same `DatasetAdapter`. Far higher signal than open web.
- **Capture your own clips.** This is the *most* underrated lever for **real-camera**
  accuracy: a few volunteers recording each sign on phones/webcams matches the app's
  actual input distribution and directly attacks domain shift. It's unambiguously
  yours (no license question), and 5–10 self-captured clips/sign can move the
  real-camera holdout more than thousands of scraped frames.

**My recommendation:** demote open-web scraping to *last, optional, and gated by a
license check per source*. Spend that energy on MS-ASL + curated dictionaries +
self-capture instead.

---

## 3. Apply blur / modifiers to the data — ⚠️ right idea, wrong layer

This rests on the same misconception the Phase 2 analysis flagged about image size:
**we do not train on pixels.** MediaPipe extracts landmarks, and
`dynamicNormalization.ts` (frozen `pose-shoulder-hands-v1`, 161-d) removes scale and
position. So:

- **Pixel-space augmentation (blur, brightness, color jitter) is almost invisible to
  the model** — it changes the video, MediaPipe re-extracts roughly the same
  landmarks, normalization erases the rest. Blur can even *hurt*: heavy blur degrades
  MediaPipe's detection, injecting *uncontrolled* landmark noise, and it's expensive
  (re-run holistic extraction per augmented video).
- **The right layer is landmark space — and we already do it.** `augment_sequences`
  in `dynamic_model.py` applies per-window **spatial noise (σ=0.01), random scale
  (0.9–1.1), and whole-frame dropout (0.1)** — the last explicitly *"simulates missed
  detections, which the runtime sees often."* That dropout is the cheap, controlled
  equivalent of "blurry/bad-camera" robustness, applied where the model can see it.

**Extend that instead of doing video blur** (cheap, all in `ml/`, no re-extraction):
- **Temporal warping** — resample the sequence faster/slower; signers vary in speed
  and the 30-frame window quantizes it. High value.
- **Per-landmark dropout / jitter** (not just whole-frame) — mimics partial occlusion
  and single-joint detection failures, common on real cameras.
- **Small rotations** about the body axis — viewpoint variance.
- **Horizontal mirroring — with care.** It cheaply doubles data *but* flips
  handedness, and ASL has dominant-hand conventions, so mirroring changes meaning for
  some signs. Apply it consistently and only where the gloss is handedness-agnostic,
  or it becomes label noise. (Worth an explicit decision per gloss.)

Net: keep "augmentation" in Phase 3, drop "blur," move it to landmark space, and
tune/extend the function we already have. Re-check on the **real-camera holdout**, not
just CV — augmentation that only helps CV is theater.

---

## Cross-cutting

- **Model capacity, modestly.** With cleaner/bigger data a BiGRU or a small attention
  layer may help — but for a 50-class problem **data quality dominates architecture**.
  Bump capacity only after the data floor is met, and keep the ONNX small (currently
  **296 KB**) — the offline/PWA bundle budget (M7 fought for it) is a hard constraint.
- **Static letters: leave alone.** Phase 3 is dynamic-signs. The 24-letter MLP isn't
  the bottleneck; don't spend cycles there.
- **Vocabulary is content, gated by data.** Let the realized clips-per-gloss decide
  which 50 ship, behind the (now signer-disjoint) gate. `SHIPPED_GLOSSES` in
  `content/dynamicVocab.ts` stays the single source of truth for what the app prompts.

## Suggested Phase 3 milestones (green-gates, one branch/PR each)

- **P3M1 — Honest eval.** Signer-disjoint as the default gate + a self-recorded
  real-camera holdout harness. (`ml/` only; foundational.)
- **P3M2 — MS-ASL ingest + retrain.** `MsaslAdapter`, download script (owner runs the
  fetch), combine with WLASL, retrain, re-gate, grow vocab toward 50 from the data
  floor.
- **P3M3 — Landmark-space augmentation v2.** Extend `augment_sequences` (temporal
  warp, per-landmark dropout, rotation, careful mirroring); validate on the holdout.
- **P3M4 — (optional) Curated dictionaries + self-capture** to close real-camera
  domain shift; open-web scraping only here, per-source license-gated, if pursued.

## Owner / "stop and ask" items (workflow rule)

- **MS-ASL fetch** — large, `yt-dlp`-based, expect link rot; you run it, I script it.
- **Self-capture / volunteer clips** — needs you + people to record on real cameras.
- **Each scraped/curated source** — license must be vetted *before* it's used; for
  anything outside C-UDA-cleared MS-ASL, I stop and confirm with you per source.

## Open questions to settle before P3M2

- **Vocabulary policy:** fix a target list of 50 and fill it, or let the data floor
  pick the 50? (I recommend the latter.)
- **Data floor:** what minimum clips/signers per gloss is "good enough to ship"?
- **Mirroring:** OK to author a per-gloss handedness-agnostic flag so we can safely
  double data on the eligible ones?
- **Real-camera holdout:** are you up for recording a small fixed holdout set — the
  one investment that makes all of Phase 3 measurable?
