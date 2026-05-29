# Phase 3 — Accuracy & Vocabulary Depth

> **Phase 1 (M0–M7) and Phase 2 are complete and deployed.** The app is live with
> 24 fingerspelling letters + 20 dynamic signs (see [`../progress.md`](../progress.md)).
> Phase 3 is **depth, not new features**: make the dynamic recognizer **more
> accurate** and **grow the dynamic vocabulary toward ~50 signs** — without letting
> breadth outrun the accuracy gate.
>
> Kept **separate from** [`milestones.md`](milestones.md) (phase 1) and
> [`phase2.md`](phase2.md). The owner's phase-3 plan is in
> [`../../plan.md`](../../plan.md); per-item analysis is in
> [`../../output.md`](../../output.md).

## Source of the plan

Phase 3 originates from the owner's plan ([`../../plan.md`](../../plan.md)), whose
stated goal is *"improve the accuracy and increase the data to 50 signs."* It listed
three ideas; **two are carried forward, one is dropped**:

| Plan idea | Disposition |
| --- | --- |
| **MS-ASL download → retrain** for more clips-per-sign | ✅ Carried — **P3M2** (was the parked P2M5c); now **one candidate among owner-curated datasets** (see *Dataset sourcing & review* below). |
| Apply **modifiers (blur, etc.)** to the data | ✅ Carried but **reframed** — augmentation belongs in **landmark space, not pixel space** (we don't train on pixels). Expanded into **P3M3**. |
| **Scrape the internet** for ASL videos | ❌ **Dropped** (owner decision). Open-web video is unlabeled continuous signing, not isolated glosses; segmenting/labeling it is its own research problem, label noise wrecks a small model, and the license footing is far weaker than C-UDA-cleared MS-ASL. See [`../../output.md`](../../output.md) §2. **Replaced by** owner-curated, reviewed datasets (below). |

One milestone is **added ahead of both**: before chasing accuracy we must be able to
**measure it honestly** (today's headline CV number overstates real-camera accuracy).

| Milestone | Theme | Status |
| --- | --- | --- |
| **P3M1** | Honest accuracy measurement — signer-disjoint gate (real-camera holdout optional/deferred) | ☑ merged [#21](https://github.com/aakash-tir/sign-app/pull/21) |
| **P3M2** | MS-ASL ingest + retrain → grow dynamic vocabulary toward ~50 signs | ☑ part 1 (ingest) merged [#22](https://github.com/aakash-tir/sign-app/pull/22); **part 2 (MS-ASL fetch + combined retrain + honest re-gate) merged** [#24](https://github.com/aakash-tir/sign-app/pull/24) (squash `0851c1a`) — 24-gloss model, honest CV **0.719** (+15 pts), shipped 20. ~50 needs a further download pass |
| **P3M3** | Expanded landmark-space augmentation (the "modifiers") | ☑ merged [#23](https://github.com/aakash-tir/sign-app/pull/23) (toolkit; tuning deferred to P3M2 data) |

> **P3M1 baseline measured (2026-05-24):** starter-20 signer-disjoint **top-1 0.570 /
> top-5 0.922** vs stratified 0.622 / 0.953 (leakage ≈ +5 pts) — [`recognition.md`](recognition.md)
> §6.3. Gate is now signer-disjoint by default; re-gate of the shipped vocab lands in
> P3M2 on more data.

Legend: ☐ planned · ◐ in progress / scoping · ☑ merged.

## The central framing (read this first)

The goal *"better accuracy AND 50 signs"* contains a tension that must be managed,
or the phase backfires:

- The dynamic model trains on **~193 clips / 20 glosses ≈ 10 clips per sign**, from
  ~36 signers. 5-fold CV reads **~62% top-1 / ~95% top-5**, but our own notes (and
  the reason P2M5a exists) flag that this **overstates** real-camera accuracy because
  stratified folds split *clips*, leaving the same signer in train and test.
- **More signs at the same thin clips-per-sign lowers accuracy.** "50 signs" is a
  *vocabulary* target, not an accuracy strategy. The levers that actually move
  accuracy are **clips-per-sign**, **signer diversity**, and **augmentation** — in
  that order.

So Phase 3 treats the vocabulary as **gated by data, not chosen then backfilled**:
fix a per-gloss **data floor** — *eligible at ≥ 12 clips from ≥ 5 distinct signers,
preferred ≥ 20 clips / ≥ 8 signers* (Q7) — and let the ~50 be *whichever glosses
clear that floor and the honest accuracy gate* (signer-disjoint per-gloss top-1
≥ 0.50) across the accepted sources ∪ WLASL. Don't demote working signs on a noisier
combined run (the P2M5b lesson). ~50 is the Phase-3 target; broadening toward most
everyday signs is intended **later** and accuracy-gated, not now (Q6).

## Dataset sourcing & review (owner-curated)

Instead of open-web scraping, **the owner curates candidate datasets and provides
them for review**; I vet each one and we decide together whether to include it. No
dataset is ingested until it passes this gate — this keeps licensing and data
quality under control (and satisfies the "stop and verify dataset licenses" rule in
[`../rules/workflow.md`](../rules/workflow.md)).

**Review checklist (applied per candidate):**

1. **License** — is training-use permitted, and may we ship the *model* (a "Result")?
   C-UDA / CC / explicit research-use are green; all-rights-reserved or unclear terms
   are a stop-and-ask. (MS-ASL is already cleared under C-UDA — **ADR-016**.)
2. **Isolated glosses, not continuous signing** — clips must be one sign each,
   labeled; otherwise segmentation cost makes it unusable for our pipeline.
3. **Signer metadata** — is there a signer/speaker id? Required for the P3M1
   signer-disjoint split; if absent, the source can only go entirely into one split.
4. **Coverage** — clips-per-gloss and distinct-signers-per-gloss vs the **data floor**
   (Q7), reported via `coverage_by_label` after a trial extract.
5. **Label mapping** — can its glosses map onto our canonical vocabulary via
   `canonical_label` + a synonym entry?
6. **Format/feasibility** — video files vs URL list (link-rot risk), handedness
   convention, fps/length.

Each **accepted** source is recorded (one short note: name, license, why included,
coverage) and gets its own `DatasetAdapter`. Each **rejected** source gets a one-line
reason so the decision is traceable. This review is the gate at the front of **P3M2**.

### Dataset review log (owner-provided candidates, 2026-05-24)

Reviewed ASL-only, from `input.md` + the two papers + the ASLLVD `.xlsx`:

| Source | ASL / isolated? | Data | License | Verdict |
| --- | --- | --- | --- | --- |
| **MS-ASL** | ✅ / ✅ | ~25k clips (YouTube URLs → link rot) | **C-UDA** — training is "computational use", trained model is an unrestricted "Result" → **ship the model OK** (ADR-016) | ✅ **Accepted** (primary volume source; owner download) |
| **WLASL** | ✅ / ✅ | ~21k clips; 36 signers in our subset | research; Kaggle mirror | ✅ **Already integrated** |
| **ASL Citizen** (Microsoft) | ✅ / ✅ | **~84k actual video files** (no link rot), **~2,700 signs, ~2,700 signers** — *the best data by far* | **Non-commercial, non-revenue, research-purposes only**; *"you may not distribute the data or your modifications to the data"*; **no model carve-out** | ❌ **Declined (owner, 2026-05-24)** — license caps use at "research purposes only"; owner chose not to pursue permission |
| **ASLLVD / ASLLRP** (BU/Rutgers) | ✅ / ✅ citation form | ~9.8k tokens but only **~6 signers** (~3 tokens/sign) + rich handshape labels | *"research and education purposes"*; *"cannot be redistributed without permission"*; **no model carve-out** ([dai-terms](https://www.bu.edu/asllrp/dai-terms.html)) | ❌ **Declined** — research-license (no model carve-out) + weak data (~6 signers) |
| **SignAvatars** | ⚠️ (ASL part = How2Sign/WLASL) | 3D **SMPL-X/MANO mesh params**, not video | NC research, form-gated | ❌ **Rejected** — format mismatch with our MediaPipe-video pipeline; its ASL-isolated content is just WLASL we already have |
| **How2Sign** | ✅ but **continuous** | sentence-level instructional video | (verify per use) | ❌ **Rejected for the recognizer** (continuous ≠ isolated glosses); ✅ **candidate for *sentence content*** — see Future work |

**License bottom line:** **only MS-ASL (C-UDA) is cleared to train-and-ship a model
in a public app.** ASL Citizen and ASLLVD are research/non-commercial with **no
model-as-Result carve-out** → both **declined** (owner won't pursue permission).
Informed reading, **not legal advice**.

**How2Sign related-datasets sweep (2026-05-24):** reviewed the full list. Its only
ASL *isolated-sign* entries are **ASLLVD / MS-ASL / WLASL** (all covered above) plus
**ASL-LEX / ASL-LEX 2.0** — which are **lexical/phonological databases (~1 video per
sign)**, not multi-clip training data (and CC-NC), so useless for clips-per-sign. Its
fingerspelling sets (ChicagoFSWild, Purdue RVL-SLLL) aren't needed (we already do 24
static letters). The big newer ASL sets it predates (ASL Citizen, Sem-Lex) are both
consent/research-NC. **Net: no new license-clear *training* source exists beyond
MS-ASL — P3M2 trains on MS-ASL (C-UDA) + the WLASL we already have.** The continuous
ASL sets (How2Sign, NCSLGR) are reserved for the sentence-content track (Future work).

## Conventions (unchanged from phases 1–2)

Same working agreement and green-gates workflow as
[`../rules/workflow.md`](../rules/workflow.md):

- **Branch:** `milestone/P3MX-short-slug` (e.g. `milestone/P3M1-honest-eval`).
- **One milestone at a time**, each its own branch → PR → **squash-merge** into
  `main`; merge only when **all gates are green** (Frontend: Prettier + ESLint +
  `tsc --noEmit` + Vitest + Playwright; Python: `ruff format` + `ruff check` +
  `mypy` + `pytest`).
- **Every milestone ships tests** and updates `.claude/` docs (especially
  [`../progress.md`](../progress.md) and [`recognition.md`](recognition.md) §6).
- Phase 3 is **mostly `ml/`** (training pipeline). The only frontend touch is the
  re-bundled ONNX + `SHIPPED_GLOSSES` when vocabulary grows — no UX redesign.
- **Owner / "stop and ask" items** (per [`../rules/workflow.md`](../rules/workflow.md)):
  the **MS-ASL download** (large, `yt-dlp`-based, auth/rate-limited) is an owner
  action — I script it, the owner runs the fetch. *(A self-recorded real-camera
  holdout is **optional and deferred** — the owner can't record clips yet — so it is
  not a required action; see P3M1.)*

---

## P3M1 — Honest accuracy measurement

**Goal:** make accuracy **measurable and trustworthy before changing anything else.**
You cannot improve what you cannot honestly measure, and the current gate flatters
itself. This milestone is `ml/`-only, ships no model change, and is the prerequisite
that makes P3M2/P3M3 falsifiable.

### Scope & rationale

The core gap to close — plus an optional second one:

1. **Signer leakage in the gate (the fix).** The ship gate runs on `stratified_folds`
   / `cross_validate` (`ml/src/sign_ml/dynamic_model.py`), which split **clips**, so a
   signer appears in both train and test → inflated numbers. We already built the
   fix in P2M5a — `assign_signer_disjoint_splits` (`ml/src/sign_ml/ingest.py`) — but
   only use it for *reporting*, not *gating*. Making it the gate means holding out
   **whole signers' clips** as the test set (no recording, free) — this *is* "use some
   videos for testing and not in training," done correctly.
2. **Real-camera domain shift (deferred, optional).** Even a signer-disjoint dataset
   split still measures generalization *within the source distribution*; it can't
   measure the gap to the user's actual webcam. The ideal check is a small set of
   self-recorded clips — but **the owner can't record clips yet**, so this is
   **optional and not required to ship Phase 3**. Mitigation in the meantime: once
   MS-ASL lands, **prefer held-out MS-ASL signers** as the proxy (YouTube footage is
   closer to real use than WLASL studio clips).

### Deliverables

1. **Signer-disjoint evaluation as the default + the gate.** Add a CV variant that
   folds by **signer** (whole signers per fold), reuse `assign_signer_disjoint_splits`
   semantics, and make the **per-gloss ship gate read this number**, not stratified
   CV. Keep stratified CV available for comparison/reporting only.
2. **Honest-baseline write-up** in [`recognition.md`](recognition.md) §6: record the
   signer-disjoint number for the current 20-sign model (expected **lower** than the
   62% stratified figure) as the Phase-3 starting line, and note it is an *optimistic
   ceiling* for live accuracy (the deferred real-camera holdout is what would close
   that gap).
3. *(Optional / deferred)* **Real-camera holdout harness** — built **only when clips
   exist**: a loader for a fixed set of self-recorded clips (gitignored), scored
   through the **same** `dynamic_extract` + frozen `dynamicNormalization`
   (`pose-shoulder-hands-v1`, 161-d), reporting top-1/top-5 + per-gloss confusion, and
   **skipping cleanly when no clips are present** so CI is unaffected. The recording
   protocol is kept on file below for when the owner can record.

### Acceptance

- The dynamic ship gate is computed from a **signer-disjoint** split; the figure and
  its (lower) value are documented as the new baseline.
- No change to the shipped model, normalization, or app behavior. All gates green.
- *(If the optional holdout harness is built)* it runs from a single command and
  **skips cleanly when no clips are present**.

### Tests

- **pytest:** signer-fold assignment puts every signer in exactly one fold and never
  splits a signer across train/test (the leakage guard); the gate function reads the
  signer-disjoint score; normalization parity unchanged (golden vectors still pass).
  *(If the holdout harness is built: the loader handles the empty-set case and a tiny
  fixture set.)*

### Non-goals (P3M1)

- No new data, no retraining, no vocabulary change, no augmentation work.

### Real-camera holdout — how to record it (optional, for later)

> **Deferred:** the owner can't record clips yet, so this is **not required** for
> Phase 3 — the signer-disjoint dataset gate carries the milestone. Kept here as the
> protocol for when recording becomes possible.

A **holdout set** is clips the model is **never trained on**, used only to score it.
"**Fixed**" means it's the *same* set every time, so accuracy is comparable across
model versions — if the test set changed each run you couldn't tell whether a number
moved because the model improved or because the test got easier. "**Real-camera**"
means recorded on an actual webcam/phone in everyday conditions, so it measures the
**domain shift** between WLASL training clips and live use (the gap that makes the
~62% CV optimistic).

Minimal protocol:

1. **Coverage** — for each shipped gloss, record **3–5 short clips** (one sign each,
   ~1–3 s, citation form, natural speed). 20 signs × 3 ≈ 60 clips is enough for a
   first signal.
2. **Conditions** — vary them on purpose: different lighting, background, distance,
   and **≥ 2 people** if possible. Frame yourself like the app does (head + torso,
   hands in view) on the kind of camera the app runs on.
3. **Files** — save as video (mp4/webm), **one folder per gloss** so the label is the
   folder name: `holdout/drink/drink_01.mp4`. Kept **gitignored** like other media.
4. **Keep it fixed & separate** — store it in its own directory the training pipeline
   **never reads**; don't edit it once recorded (you may *add* clips later, but keep
   the originals so trends stay comparable).

You don't extract landmarks yourself — the P3M1 harness runs the same MediaPipe
extraction + frozen normalization and reports per-gloss top-1/top-5 + a confusion
breakdown. I'll provide the exact folder path and command when P3M1 starts.

> **ADR-019** ([`decisions.md`](decisions.md)): *Accuracy is gated and reported on
> **signer-disjoint** splits; a self-recorded **real-camera holdout** is the ideal
> domain-shift check but is **optional/deferred** (no clips yet).* Refines the ADR-007
> accuracy-gating posture and supersedes stratified-clip CV as the gate.

---

## P3M2 — Add reviewed datasets + retrain → grow toward ~50 signs

**Was the parked P2M5c, now generalized.** The highest-leverage *data* move: add the
datasets that **pass the review gate** above — **MS-ASL** (already C-UDA-cleared,
**ADR-016**) plus whatever the **owner curates and provides for review** — through the
ingest layer P2M5a built, and let the vocabulary grow to whatever clears the P3M1 gate
and the data floor.

> **Workflow:** the owner hands me candidate datasets; I run each through the *Dataset
> sourcing & review* checklist; **only accepted sources are ingested.** MS-ASL is a
> pre-cleared candidate but not the only one. This milestone may land **incrementally**
> — one accepted source (one adapter) per PR — rather than as a single big push.

### Scope & rationale

- Each accepted source is **training-only, ship-the-model** (the review confirms the
  license permits this; MS-ASL settled in **ADR-016**). We never redistribute source
  video; datasets stay **gitignored** (ADR-014 handling).
- A new source = **one small `DatasetAdapter`** (`ml/src/sign_ml/<source>.py`)
  implementing `raw → CanonicalSample` (`label / source / clip_id / signer_id /
  split`). Heavy landmark extraction stays in `dynamic_extract.py`; `canonical_label`
  + a synonym map harmonize each source's glosses onto the shared canonical vocabulary.
- **Realized coverage, not headline coverage:** sources that ship as URL lists
  (e.g. MS-ASL's YouTube URLs + segments) suffer **link rot**, so vocabulary is picked
  from **what we actually obtained**, reported per-gloss via `coverage_by_label`.

### Deliverables

1. **Per accepted source: a download/ingest script** (owner-run when a fetch is
   needed) that tolerates missing/dead items and emits a **realized-coverage report**
   (clips & distinct signers per canonical gloss).
2. **Per accepted source: a `DatasetAdapter`** conforming to the contract, parsing
   its signer/speaker field into `signer_id` and mapping its labels through
   `canonical_label` (+ synonyms) to the shared vocabulary. *(MS-ASL → `MsaslAdapter`
   in `ml/src/sign_ml/msasl.py`.)*
3. **Signer-ID namespacing across sources** (`<source>:<id>`, e.g. `msasl:123`,
   `wlasl:456`) so the P3M1 signer-disjoint split never treats two sources' signers as
   one, and a signer present in two sources can't straddle train/test.
4. **Combined extract + retrain + re-gate:** merge the accepted sources ∪ WLASL via
   `ingest.merge`, extract landmarks, retrain the GRU, evaluate on the **P3M1
   signer-disjoint gate**, and grow `SHIPPED_GLOSSES`
   (`frontend/src/content/dynamicVocab.ts`) to every gloss that clears the gate **and**
   the data floor — targeting ~50, **without demoting** currently-shipped signs that
   still pass.
5. **Re-bundle artifacts:** new ONNX (`frontend/public/models/dynamic/`) + refreshed
   `metadata.json` (labels / normalization id / window-feature shape skew guard),
   plus reference clips (`reference_export.py`) for any newly shipped gloss.
6. **Docs:** [`recognition.md`](recognition.md) §6 — accepted-source list + license,
   new per-gloss table, realized coverage, and the honest (signer-disjoint) accuracy
   for the grown vocabulary.

### Acceptance

- Each included source passed the review gate (license + isolated-gloss + coverage)
  and plugs into the ingest contract; combined ingest reports per-gloss coverage and a
  clean signer-disjoint split across all sources.
- The dynamic vocabulary grows toward **~50 signs**, every shipped gloss **clears the
  P3M1 gate and the data floor**, and no previously-shipped sign is demoted while
  still passing.
- New ONNX + metadata bundled; reference clips exist for every shipped gloss; the app
  prompts only `SHIPPED_GLOSSES`. All gates green.

### Tests

- **pytest:** each new adapter's shape/label-mapping contract (synonyms collapse
  equivalent glosses); source-namespaced signer IDs keep the split disjoint; merge +
  coverage on tiny fixtures (no full dataset in CI).
- **Vitest:** `dynamicVocab` reflects the grown shipped set; `shippedLabels` filters
  the model's labels correctly; metadata skew-guard still asserts.

### Non-goals (P3M2)

- No open-web scraping (dropped). No ingesting a source that hasn't passed review.
- No static-letter changes. No UX redesign.
- Not "ship all ~50 regardless" — the gate and data floor decide membership.

> **Owner actions:** (a) curate + provide candidate datasets for review; (b) run any
> large fetch (e.g. MS-ASL via `yt-dlp`) — I write the script and adapter. If realized
> coverage across accepted sources leaves the count short of ~50 at the data floor,
> add more reviewed sources (or self-capture) rather than lowering the gate.

> **Landed (2026-05-24, incremental):** `ml/src/sign_ml/msasl.py` — `MsaslAdapter` +
> index parser (`load_msasl_index`, `youtube_id_from_url`; signer ids namespaced
> `msasl:<id>` so they never collide with WLASL's in a signer-disjoint split) — and
> `ml/src/sign_ml/msasl_download.py` — yt-dlp segment fetch, link-rot-tolerant,
> writes a realized-coverage report (`--extra msasl`, needs ffmpeg). +6 pytest (68),
> all ml gates green. The download default targets our current 24 glosses (adds
> signer diversity to existing signs); broaden via `--glosses` once we pick the ~50.
>
> **Download hardened + fetched (2026-05-28, branch `milestone/P3M2-download-hardening`,
> 2 local commits, unpushed/no PR):** the first bulk run was throttled by YouTube
> bot-detection, so `msasl_download.py` gained **browser-cookie auth** + a `--cookies`
> Netscape-file flag (Windows/Chromium App-Bound-Encryption workaround), jittered
> `--sleep`, a container-agnostic `FORMAT` (accept webm/m4v, transcode at merge), and
> **multi-client extraction** (`player_client = web/mweb/android/ios`). Live read
> 2026-05-28: **22/24 expanded glosses populated, 792/1195 clips (66.3%)**, ~20–31
> signers/gloss; only `want`/`yes` still at 0 when checked (download still running).
> Clips gitignored at `ml/data/msasl/videos/`. ⚠️ `coverage.json` only writes at run
> end, so it's stale during the run — recount via a read-only join of `MSASL_*.json`
> against present `<clip_id>.mp4`, not that file.
>
> **Part 2 DONE (2026-05-28):** fetched the remaining `want`/`yes` clips (cookies.txt
> auth) → final MS-ASL ~909 clips. Wired a combined `extract-combined` →
> `assemble-combined` path through `ingest.merge` with signer-disjoint splits across
> sources; extraction is **resumable + hang-proof** (per-clip cache; a recycled worker
> subprocess with a per-clip 90 s timeout that **quarantines** clips hanging MediaPipe
> `detect()` — 6 quarantined, 1148 extracted). Combined cache **1151 clips / 24 glosses
> / 128 signers** (vs 193/36). Honest signer-disjoint CV **top-1 0.719 / top-5 0.931**
> (P3M1 baseline 0.570/0.922 → **+15 pts**), exported model test 0.716/0.919. Re-gate
> (strict honest gate, owner-confirmed): shipped **20** — promoted `like`/`bad`/`happy`,
> demoted `good`/`before`/`tall` (now < 0.50); `thank you` still held. Re-bundled
> 24-class ONNX + reference clips; `SHIPPED_GLOSSES` updated; recognition.md §6.5; all
> gates green. **~50 signs awaits a further MS-ASL download pass for *new* glosses**
> (this pass reinforced the existing 24). P3M3 augmentation tuning on this larger set
> remains optional follow-up.

---

## P3M3 — Expanded landmark-space augmentation (the "modifiers")

**Goal:** squeeze more **real-camera robustness** out of whatever data we have by
expanding augmentation — the owner's "apply modifiers like blur" idea, **moved to the
correct layer.**

### Scope & rationale — why landmark space, not blur

We **do not train on pixels.** MediaPipe extracts landmarks and
`dynamicNormalization.ts` (frozen `pose-shoulder-hands-v1`, 161-d) removes scale and
position, so **pixel-space augmentation (blur / brightness / color jitter) is nearly
invisible to the model** — and heavy blur can *hurt* by degrading MediaPipe detection
(uncontrolled noise) while costing a full re-extraction per augmented video. The
controlled equivalent lives in **landmark space**, which we already do:
`augment_sequences` (`ml/src/sign_ml/dynamic_model.py`) applies per-window **spatial
noise (σ=0.01)**, **random scale (0.9–1.1)**, and **whole-frame dropout (0.1)**
(presence flags — the last two features — left intact). P3M3 **extends** that
function; no video re-processing.

### Deliverables — new augmentations (all on the normalized `(B, T, F)` window)

1. **Temporal warp / resample** — stretch or compress the sequence in time
   (signers vary in speed; the 30-frame window quantizes it). High value.
2. **Window/time-shift jitter** — vary the start offset within a clip so the model
   isn't anchored to a fixed alignment.
3. **Per-landmark dropout & jitter** (not just whole-frame) — zero or perturb
   individual joints to mimic partial occlusion and single-joint detection failures
   the runtime sees constantly.
4. **Small planar rotation** — rotate hand/pose coordinates a few degrees about the
   frame for viewpoint variance.
5. **Horizontal mirroring — with handedness care.** Flipping x **doubles data** but
   changes meaning for handedness-specific signs and must **swap the left/right hand
   feature blocks** (not just negate x) to stay consistent with the 161-d layout.
   Gate it behind a **per-gloss `handedness_agnostic` flag** so it never injects
   label noise; default off.
6. **Presence-flag invariant preserved** across all of the above (the last two
   features stay valid), and **augmentation stays train-time only** — the frozen
   normalization and golden-vector parity are untouched.

### Acceptance

- `augment_sequences` (or a successor) supports the new modifiers, each individually
  toggleable and seeded (deterministic with a fixed RNG seed).
- Mirroring correctly swaps hand blocks and is applied **only** to glosses flagged
  handedness-agnostic.
- Retrained model shows **no regression** on the P3M1 signer-disjoint gate (and,
  if/when the optional real-camera holdout exists, ideally an improvement there);
  results documented in [`recognition.md`](recognition.md) §6. Augmentation that only
  helps stratified CV is rejected.
- All gates green.

### Tests

- **pytest:** each augmentation is shape-preserving and deterministic under a seed;
  presence flags survive spatial transforms; temporal warp keeps window length;
  **mirroring swaps L/R blocks and negates x correctly** (assert against a crafted
  fixture); the handedness flag actually gates mirroring; frame/landmark dropout
  zeroes the intended elements only.

### Non-goals (P3M3)

- **No pixel/video augmentation (blur etc.)** — wrong layer, low/negative value.
- No change to the frozen normalization spec or golden vectors.
- No model-architecture overhaul (a modest capacity bump is allowed only if the
  data floor is met and the ONNX stays small — current **296 KB**; the PWA bundle
  budget from M7 is a hard constraint).

> **ADR-020** ([`decisions.md`](decisions.md)): *Data augmentation is applied in
> **landmark space** (extending `augment_sequences`), not pixel/video space;
> pixel-domain modifiers like blur are explicitly out of scope.* Refines
> ADR-002/ADR-013 (landmark-based recognition).

> **Landed (2026-05-24):** shipped three primitives in `dynamic_model.py` —
> `drop_landmarks` (per-joint dropout), `rotate_xy` (in-plane rotation), `time_warp`
> (end-anchored speed) — **opt-in, default off** (`augment_sequences` knobs +
> `crossval --aug`), so plain training is unchanged until tuned on P3M2 data. Prototype
> on the starter-20 signer-disjoint gate: **top-1 0.570 → 0.601** (top-5 ~flat;
> recognition.md §6.4). **Mirroring + time-shift were deferred** as skew-prone under the
> handedness-collapsing hand normalization (§5) and the front-padded last-timestep GRU
> design (so Q9's mirroring flags stay deferred too) — revisit only if the real-camera
> holdout justifies the risk. +7 pytest (75).

---

## Dependency / sequencing notes

- **P3M1 first, always** — it defines the honest (signer-disjoint) gate that P3M2 and
  P3M3 are judged against. Building it later means re-judging everything.
- **P3M2 before P3M3** — augmentation is most meaningful once the larger, more
  signer-diverse dataset is in; tuning modifiers on 10 clips/sign over-fits the
  tuning itself. (P3M3 *can* be prototyped on current data, but its accept/reject
  decision should use the P3M2 dataset + the P3M1 signer-disjoint gate.)
- Frontend impact is confined to re-bundling the ONNX + growing `SHIPPED_GLOSSES`
  when P3M2 lands; no UX work is in this phase.

## Future work (not in Phase 3 scope)

- **More owner-curated datasets** — if the accepted sources leave the vocabulary
  short of ~50 at the data floor, the owner curates additional candidates for review
  (the Phase-2 discovery indexes — the `sign-language-datasets` topic,
  `yayayru/sign-language-datasets` — are good hunting grounds), rather than lowering
  the gate or resurrecting open-web scraping. (This is the same review→adapter path as
  P3M2; listed here as the overflow source if P3M2's initial set falls short.)
- **Self-captured clips** — for both the deferred **real-camera holdout** (ADR-019)
  and training; the most direct fix for real-camera domain shift, since they match the
  app's actual input distribution. Owner/volunteer effort, unblocked once recording
  becomes possible.
- **Model-architecture exploration** (BiGRU / small attention) — only if data
  quality is no longer the bottleneck and the ONNX stays within the bundle budget.
- **Broader vocabulary, later** (Q6) — beyond Phase 3's ~50, the owner intends to
  expand toward most everyday signs over time, via the same review → adapter → gate
  path, accuracy-gated (ADR-007/ADR-019). A future-phase effort once the 50-sign base
  is solid.
- **Continuous-sign data for *sentence content* (not recognition)** — continuous ASL
  corpora (e.g. How2Sign) **cannot train our isolated-sign recognizer** (continuous
  SLR is out of scope, ADR-007), but they **can supply authentic ASL sentence
  sequences** to author the Learn "Sign sentences" drill (ADR-012) — filtered to the
  user's shipped/confident vocab and still **verified one sign at a time** as today.
  A separate **content track** from P3M2/P3M3 (owner: "we can use the continuous for
  sentence practice"). License-check each source; references stay rendered from
  landmarks (ADR-017), so no source clips ship.

## Open questions — resolved (2026-05-24)

| # | Question | Resolution |
| --- | --- | --- |
| Q6 | Vocabulary policy: fix a target 50 then fill, or let the **data floor pick** the ~50? | ✅ **Data floor picks.** ~50 is the Phase-3 target; broadening toward most everyday signs is intended **later** (accuracy-gated), not now. |
| Q7 | What is the **data floor** per gloss (min clips / distinct signers)? | ✅ **Eligible at ≥ 12 clips from ≥ 5 distinct signers; preferred ≥ 20 clips / ≥ 8 signers.** The **signer-disjoint per-gloss top-1 ≥ 0.50** gate (ADR-019/ADR-007) is the final arbiter — the floor only decides what's worth training/evaluating. |
| Q8 | Will the owner record a **small real-camera holdout**? | ✅ **Deferred** — can't record clips yet. The **signer-disjoint dataset holdout** is the gate (no recording); a real-camera holdout is optional, added later. Protocol kept under P3M1. |
| Q9 | Per-gloss **handedness-agnostic** flags for safe mirroring — author now or defer? | ✅ **Defer / author incrementally.** Mirroring ships in P3M3 **off by default**; a gloss's flag is authored only when mirroring is enabled for it, so it never injects label noise. |
