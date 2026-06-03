# Phase 4 — Discovery & Accuracy

> **Phases 1–3 are complete and deployed.** Phase 4 *began* with the app live at 24
> fingerspelling letters + **63 dynamic signs** (honest top-1 0.615); it **now ships 71
> signs at 0.687** (see the §6.9 win below and [`../progress.md`](../progress.md)). Phase 4
> has **two tracks:**
>
> - **Discovery (P4M1, shipped):** let the learner *find* the sign they want — the
>   vocabulary is now big enough (63 signs) that one dropdown isn't enough.
> - **Accuracy (P4M2–P4M8):** lift the **18 dynamic signs that fall below the honest
>   0.50 ship gate** (`come` 0.08 … `mother` 0.49) over the bar so they ship — and
>   raise aggregate honest top-1 — **without bloating the on-device model**. This track
>   takes on the full menu of levers researched on 2026-06-01 (diagnosis, motion
>   features, mirroring, class-imbalance, temporal model, targeted data, runtime
>   confidence, self-supervised pretraining).
>
> Kept **separate from** [`milestones.md`](milestones.md) (phase 1),
> [`phase2.md`](phase2.md), and [`phase3.md`](phase3.md).

## P4M1 — Sign search tab

**Goal.** A new top-level **Search** tab where the learner types the sign they want
to learn. If that sign is in the app's vocabulary, show **how to sign it** (the
reference animation) and a **camera that recognizes that specific sign** so they can
practice it. If it isn't, tell them plainly that it isn't in the system yet.

This is the owner's feature request, verbatim intent: *"search up the sign they want
to learn. If it exists as a sign in the database, pull up the sign and the camera for
that sign. If not, show a message saying the sign is not in the system yet. A new
tab."*

### Scope decisions (owner-confirmed)

| Decision | Choice | Why it matters |
| --- | --- | --- |
| **What counts as "in the database"** | **Dynamic signs only** — the **63** `SHIPPED_GLOSSES` | Each shipped gloss already has (a) a bundled reference clip in `frontend/public/reference/<gloss>.json`, (b) live recognition via the ONNX model, and (c) per-sign acceptance — all wired in `DynamicSignView`. So search reuses everything; **no model or data work**. Fingerspelling letters (static MLP, text hints, no animation) are **out of scope** and resolve to "not in the system yet". |
| **Match logic** | **Exact + synonyms + case-insensitive** | Normalize case/whitespace, then map common synonyms (`thanks`→`thank you`, `hi`→`hello`) onto canonical glosses. Mirrors the ML ingest layer's `canonical_label` + synonym idea (`ml/src/sign_ml/ingest.py:52`), so the frontend speaks the same vocabulary. "Not in the system" only fires when the term is genuinely absent. |

> **ADR-021** (to record on implementation): Sign search resolves against the
> **shipped dynamic vocabulary only**, matched by normalize-then-synonym lookup.
> Rationale: zero model/data cost, reuses the P2M4 reference + M6.3 recognizer;
> letters and fuzzy ranking are explicitly deferred (see *Future / deferred*).

### Architecture — reuse, don't rebuild

The feature is a **new entry point** over existing parts. Nothing in the recognition
or ML layers changes.

```
SearchView (/search, new tab)
  ├─ search box  ──▶ matchSign(query)          [pure domain, src/domain/]
  │                     ├─ found  → gloss
  │                     └─ not found → message
  ├─ found:
  │     ├─ SignReferencePlayer(gloss)          [existing — P2M4, no camera needed]
  │     └─ DynamicSignStage  ───────────────┐  [extracted from DynamicSignView]
  │           uses useDynamicSignRecognition │  [existing — M6.3]
  │           setTarget(gloss) on match      │  recognizes the searched sign
  └─ not found:
        "“<query>” isn’t in the system yet."
```

**Key reuse:**
- `useDynamicSignRecognition` (camera + Holistic + ONNX window classifier + per-sign
  `accepted`) — already exposes `setTarget(gloss)`. Search just locks the target to
  the matched gloss instead of offering a dropdown.
- `SignReferencePlayer` — renders the looping landmark animation, **independent of the
  camera**, so the "how to sign it" reference shows immediately (even offline / before
  the user enables the camera).
- The reference clips and recognizer are already precached for offline use.

### Work items

**1. Pure matcher (domain, framework-free, seeded-deterministic per `react.md`).**
- `frontend/src/domain/signSearch.ts`
  - `type SignMatch = { status: 'found'; gloss: string } | { status: 'not-found'; query: string }`
  - `matchSign(query: string, glosses?: readonly string[]): SignMatch`
    1. normalize: `trim().toLowerCase()`, collapse internal whitespace.
    2. apply synonym map → canonical term.
    3. membership test against `glosses` (default `SHIPPED_GLOSSES`).
  - No React, no I/O — fully unit-testable.

**2. Frontend synonym map.**
- `frontend/src/content/signSynonyms.ts`: `SIGN_SYNONYMS: Record<string, string>`,
  every value a member of `SHIPPED_GLOSSES`. Seed with obvious everyday synonyms
  (`thanks→thank you`, `hi→hello`, `mum/mom→mother`*, `dad→father`, `bye→…`*) —
  *only ship entries whose target is actually shipped*; drop the rest. Mirrors
  `ingest.py` synonyms so both sides agree.

**3. SearchView + route + tab.**
- `frontend/src/modes/search/SearchView.tsx` (+ `SearchView.css` if needed):
  controlled search input (`handleSearch` on submit/`onChange`); on `found`, render
  `SignReferencePlayer` + the recognition stage with `target` locked to the gloss;
  on `not-found`, render the "isn’t in the system yet" message (`role="status"`).
  Encourage-camera affordance: reference shows first, "Enable camera to practice"
  reveals the live stage.
- `frontend/src/App.tsx`: add `<NavLink to="/search">Search</NavLink>` (after Signs)
  and `<Route path="/search" element={<SearchView />} />`.

**4. Extract a shared recognition stage (small refactor, avoids duplication).**
- `frontend/src/recognition/DynamicSignStage.tsx`: the camera `<video>`/overlay
  `<canvas>` + status/controls + prediction + acceptance block, parameterized by the
  `useDynamicSignRecognition` result and a "fixed target" flag. `DynamicSignView`
  (dropdown) and `SearchView` (locked target) both render it. Keeps the two views
  thin and DRY. *(If this balloons, fall back to SearchView using the hook directly —
  the markup is small.)*

**5. Docs & product spec.**
- Register **FR-19** (sign search) in `project-context.md`; add the **Search** mode
  to the modes list.
- Record **ADR-021** in `decisions.md`.
- Update `CLAUDE.md` doc map + status and `progress.md` on merge.

### Tests (part of the deliverable)

- **Vitest — `domain/signSearch.test.ts`:** found (exact), found (case/whitespace
  variants), found (synonym), not-found (absent term), synonym targets are all
  shipped, empty/whitespace query → not-found. Seeded/deterministic, no RNG needed.
- **Vitest — `modes/search/SearchView.test.tsx`:** mock `useDynamicSignRecognition`;
  (a) typing a known gloss renders the reference (`data-testid="sign-reference"`) and
  calls `setTarget` with that gloss; (b) typing gibberish renders the "not in the
  system yet" message and does **not** set a target.
- **Playwright — `frontend/e2e/search.spec.ts`:** stub the model (as `dynamic.spec.ts`
  does), navigate to the **Search** tab; search a known sign → reference visible;
  search a nonsense term → not-in-system message. Mirrors the existing per-tab e2e
  pattern.

### Acceptance criteria

1. A **Search** tab is reachable from the main nav and routes to `/search`.
2. Searching a shipped sign (e.g. `father`, or a synonym like `thanks`) shows its
   reference animation and, on enabling the camera, recognizes that specific sign
   (acceptance lights up when performed).
3. Searching a term not in the vocabulary (e.g. `xyzzy`, or an unshipped word like
   `walking`) shows a clear "**“<query>” isn’t in the system yet**" message and no
   camera/reference.
4. Matching is case-insensitive, whitespace-tolerant, and synonym-aware.
5. All gates green: `prettier --check` · `eslint` · `tsc --noEmit` · `vitest` ·
   `playwright`. (No `ml/` changes ⇒ ml lane unaffected, but it must stay green.)

### Out of scope / deferred (future milestones)

- **Fingerspelling letters & spell-an-unknown-word fallback** — letters use the static
  recognizer and have no animation; a "fingerspell it letter-by-letter" fallback for
  unknown words could reuse the LearnMode spell flow. Deferred (owner chose
  dynamic-only for P4M1).
- **Fuzzy / typo-tolerant ranking + autocomplete suggestions** — owner chose exact +
  synonyms; a ranked suggestion list ("did you mean…") is a natural follow-up.
- **Adding new signs from search misses** — capturing "not in the system" queries to
  prioritize future vocabulary growth (analytics) is a possible later idea; the app is
  local-first and offline, so this would need a deliberate design.

# Accuracy track — lifting the low-confidence signs (P4M2–P4M8)

> **Source.** This track operationalizes the research done on 2026-06-01 ("how to
> improve the signs with low accuracy"). The findings + literature are summarized in
> [`recognition.md`](recognition.md) §6.7 (added in P4M2). The owner asked to take on
> **everything** that was suggested; this section sequences it cheapest-/highest-
> leverage-first.

## The problem, stated precisely

The shipped model is an **81-gloss, 2-layer GRU** (`hidden=64`, reads the **last
timestep**), trained on **3583 samples / 163 signers** with P3M3 augmentation. Honest
signer-disjoint CV: **top-1 0.615 / top-5 0.872**; **63 of 81 glosses clear the 0.50
gate**, **18 fall below** (`come` 0.08 … `mother` 0.49) and stay known-but-unshipped
(recognition.md §6.6). "Improving low-accuracy signs" = **getting more of those 18 (and
the borderline shippers) over the honest 0.50 bar**, and lifting aggregate top-1.

Three structural causes in `ml/.../dynamic_model.py` point at the cheapest fixes:

1. **Position-only features** — the 161-d frame is landmark positions + 2 presence
   flags, **no velocity/motion**. Motion dynamics are the most-cited discriminator for
   visually-similar signs.
2. **Last-timestep read** (`out[:, -1, :]`) — the whole trajectory is compressed into
   the final hidden state; mid-sign motion is lost.
3. **No class-imbalance handling** — plain `CrossEntropyLoss`; low-signer glosses get
   swamped, and MediaPipe hand/finger errors hit them hardest.

## Cross-cutting rules (apply to every milestone in this track)

- **The honest signer-disjoint CV (ADR-019) is the sole arbiter.** A change ships only
  if it helps the **signer-disjoint** gate; gains that show up only on stratified-clip
  CV are rejected (P3M1's lesson).
- **On-device size/perf budget.** Current ONNX is **315 KB**, runs in `onnxruntime-web`,
  offline. **Ceiling for this track: ≤ ~1.5 MB ONNX and no material inference-latency
  regression** (measured on the existing ~30 FPS detect / 250 ms inference throttle).
  Any milestone that would breach this must justify it or be cut.
- **Normalization parity is sacred.** Any change to the **frame features** bumps the
  frozen spec version and **regenerates the golden vectors on BOTH the Python and TS
  sides** (train/serve skew = a bug). Milestones with no feature change touch neither.
- **Never silently demote.** Each modeling milestone re-runs the honest CV and re-gates;
  a currently-shipped sign is only demoted with a documented honest reason (as P3M2 did).
- **Tests are the deliverable.** Each milestone adds pytest (ml) / vitest+playwright
  (frontend) proving its change; `ruff`/`mypy`/`pytest` and `prettier`/`eslint`/`tsc`/
  `vitest`/`playwright` stay green.
- **Success metrics (track-wide):** (1) **# glosses ≥ 0.50** honest top-1 — baseline
  **63/81**; (2) **aggregate honest top-1** — baseline **0.615**; (3) no on-device
  size/latency regression. Report both before/after on every modeling milestone.

## Sequencing & dependencies

```
P4M2 (diagnose) ─┬─▶ P4M3 (aug + loss)  ─┐
                 ├─▶ P4M4 (motion feats) ─┼─▶ P4M5 (temporal model) ─▶ P4M8 (SSL pretrain, big swing)
                 └─▶ P4M6 (targeted data, owner-gated) ─┘
P4M7 (runtime confidence) — independent of retrains; can land early / in parallel
```

P4M2 gates the modeling work (you fix what you diagnosed). P4M3/P4M4/P4M6 are
independent retrain levers; P4M5 builds on the best of them; P4M7 needs no retrain;
P4M8 is the last, heaviest swing.

---

## P4M2 — Diagnose: confusion matrix + per-gloss diversity (measure first)

**Goal.** Before changing the model, find out **why** each low sign is low — exactly as
P3M1 made accuracy honest before chasing it. No model change.

**What.** Extend `eval/`/`cross_validate` to also emit, from the existing held-out
predictions: (a) a **confusion matrix** (which sign each low gloss is mistaken for);
(b) **per-gloss signer & clip counts** (already have `n`; add distinct signers); (c) a
**low-sign dossier** classifying each of the 18 into **confusable** (mass on 1–2 other
glosses → motion/temporal fix), **data-starved** (few signers/clips → P4M6 data), or
**poorly-tracked** (high presence-flag dropout / degenerate landmarks → clip cleaning).

**Maps to code.** `ml/src/sign_ml/dynamic_model.py` (`cross_validate` already pools
held-out predictions — add a confusion accumulator); a new `eval` reporting helper;
write the dossier into `recognition.md` §6.7.

**Tests.** pytest: confusion-matrix shape/normalization on a tiny fixture; per-signer
count correctness. **Acceptance:** a §6.7 table tagging all 18 low signs by cause; this
drives which lever each subsequent milestone applies. **Cost:** low. **No on-device or
spec change.**

**Outcome (2026-06-01, shipped).** Diagnosis ran on the 81-gloss cache (signer-disjoint,
augmented → CV top-1 0.615; recognition.md §6.7). **Headline: data is *not* the
bottleneck** — every low sign has **12–39 signers** and acceptable tracking (hand
presence 0.69–0.83). Cause tally: **3 confusable** (`come`→car 62 %, `sleep`→eat 44 %,
`nice`→school 37 %), **15 diffuse** (errors spread; under-separated trajectories), **0
data-starved, 0 poorly-tracked**. **This re-prioritizes the track:** the **modeling
levers (P4M4 motion features, P4M5 temporal model)** are highest-value and **P4M6
targeted data is low-value for these specific signs** — keep P4M6 only for any *future*
new vocabulary, not this tail.

## P4M3 — Augmentation & loss levers (cheap, no spec change)

**Goal.** Squeeze the low tail with build-time-only changes that don't touch the frame
spec — so zero parity/runtime risk.

**What.** (1) **Mirroring done correctly** — not a naive x-flip (which skews this
handedness-collapsing normalization) but a **paired swap**: swap the left/right-hand
feature blocks **and** mirror the pose landmarks, then re-normalize. Roughly doubles
viewpoint/handedness diversity; standard in skeleton SLR (SAM-SLR). Revisits the P3M3
deferral (ADR-020) → **ADR-023**. (2) **Class-imbalance handling** — class-weighted or
**focal** `CrossEntropyLoss` + optional oversampling of rare glosses, targeting the
low-`n` tail. (3) **Re-tune** the existing aug (rotation/dropout/time-warp magnitudes)
on the honest gate now that the diagnosis says which signs need it.

**Maps to code.** `augment_sequences` (+ a `mirror_paired` primitive with a left↔right
index map for hands and a pose-landmark mirror map), `train_and_eval`/`cross_validate`
loss construction (weights), `dynamic_pipeline` flags.

**Tests.** pytest: mirror-of-mirror ≈ identity; the L/R block swap maps to the correct
landmark indices; class-weight vector matches class frequencies. **Acceptance:** honest
CV re-run; **re-gate** (report Δ glosses ≥ 0.50 and Δ top-1); no demotions without
cause. **On-device:** unchanged (build-time only). **Cost:** low–medium.

## P4M4 — Motion / velocity features (spec change — parity-critical)

**Goal.** Give the model the motion signal it currently lacks — the top research fix for
confusable signs. **Isolated** because it changes the frozen frame spec.

**What.** Append per-frame **velocity** (Δposition vs the previous frame), optionally
**acceleration** (Δ²), to each landmark → a new spec version (e.g.
`pose-shoulder-hands-v2`). Velocity of zero/missing landmarks stays zero; presence flags
unchanged. **Regenerate the golden vectors on BOTH the Python and TS sides** and update
the TS runtime frame builder (`dynamicNormalization.ts` + `frameWindow.ts`) so train and
serve compute identical features. → **ADR-022** (frame spec v2). This is the milestone
with real train/serve-skew risk, hence its own branch + golden-parity test as the gate.

**Maps to code.** `ml/.../dynamic_normalization.py` + the golden fixture generator
(`golden_dynamic.py`); `frontend/src/recognition/dynamicNormalization.ts` +
`frameWindow.ts`; bump the metadata `feat` count so the skew guard
(`assertMetadataCompatible`) catches a mismatched model.

**Tests.** pytest **and** vitest assert **identical** normalized output for the shared
golden vectors (the parity contract); window/motion unit tests (first-frame velocity = 0,
missing-landmark velocity = 0). **Acceptance:** honest CV re-run + re-gate; the
TS↔Python golden vectors match to tolerance. **On-device:** frame is larger but model
stays tiny; verify ONNX ≤ budget. **Cost:** medium (parity work).

**Outcome (2026-06-01, shipped — negative result).** Built the parity-safe motion
toolkit (`with_motion`/`withMotion` + shared golden), but on the honest gate **motion
regressed accuracy: 0.615 → 0.594** (63 → 58 glosses ≥ 0.50) — overfitting from doubling
the input dim on a 3583-sample set + tiny GRU (recognition.md §6.8). **Owner decision: do
not ship motion.** The shipped model stays positions-only (0.615); the runtime is
unchanged. The toolkit is **kept opt-in** (`--motion`, default off) so **P4M5 can re-test
motion + attention together**. A real ordering bug was found and fixed along the way
(augmentation must run before motion is derived). ADR-022 updated to "explored, not
shipped."

## P4M5 — Temporal model upgrade (attention pooling; optional two-stream)

**Goal.** Stop discarding mid-sign motion. Build on the best feature set from P4M3/P4M4.

**What.** Replace the last-timestep read with **temporal attention pooling** (or
mean/max-pool, or a **bidirectional GRU**) over all timesteps, so the classifier sees the
whole trajectory. If diagnosis shows motion-confusable clusters persist, add a **small
two-stream** fusion (positions + motion), a scaled-down SAM-SLR. **Keep it tiny** — the
on-device budget is the hard constraint; prefer attention pooling (cheap) before
two-stream (heavier). → **ADR-024**.

**Maps to code.** `build_sequence_model` (pooling/attention head; `bidirectional=True`);
ONNX export (`dynamic_export.py`) must round-trip the new ops through `onnxruntime-web`;
runtime classifier unchanged if the I/O contract holds.

**Tests.** pytest: forward-shape + that the export/runtime agree on a fixture; an **ONNX
size assertion** against the budget. **Acceptance:** honest CV re-run + re-gate; ONNX ≤
~1.5 MB; no inference-latency regression. **Cost:** medium.

## P4M6 — Targeted per-gloss data fetch (the proven lever; owner-gated)

**Goal.** For signs the diagnosis tags **data-starved**, raise signer diversity — the
lever that already delivered **+15 pts** in P3M2. Most reliable, but it's owner effort
(the throttled `yt-dlp` fetch).

**What.** A **focused** MS-ASL/WLASL fetch for just the still-low glosses (reuse
`msasl_download` + the ingest layer + resumable extraction). Re-extract, re-train,
re-gate. For glosses that stay starved even after, evaluate a **few-shot prototypical**
head as a data-efficient fallback (research: data-efficient ASL).

**Maps to code.** `ml/.../msasl_download.py`, `ingest.py`, `dynamic_pipeline
extract-combined`/`assemble-combined`; no frontend change beyond re-bundling the model +
`SHIPPED_GLOSSES`. **STOP-and-ask** applies — the fetch needs the owner's MS-ASL
cookies/run (memory `msasl-download-setup`). **Tests:** ingest/extract shape contracts
(existing). **Acceptance:** honest CV re-run + re-gate; document realized per-gloss
coverage. **Cost:** owner download time; modeling is cheap.

## P4M7 — Runtime confidence levers (no retrain; can land early)

**Goal.** Ship borderline signs and improve the *felt* experience **without retraining** —
independent of the whole retrain chain, so it can run early/in parallel.

**What.** (1) **Per-sign acceptance thresholds** replacing the global `ACCEPT_THRESHOLD
= 0.5` (`useDynamicSignRecognition`) and the global ship gate — calibrate each sign's bar
to its precision/recall, stored as per-gloss metadata next to the model. (2)
**Confidence calibration** (temperature scaling) so the displayed `%` is honest. (3)
**Multi-window temporal voting** at inference — average/vote over several recent windows
instead of one — which typically steadies borderline signs. → **ADR-025**.

**Maps to code.** Model metadata (per-sign thresholds + temperature); `dynamicClassifier.ts`
(`accepts` per-sign, softmax temperature); `useDynamicSignRecognition.ts` (window voting
buffer); ml `eval/` to fit the thresholds + temperature on the honest folds.

**Tests.** vitest: per-sign `accepts` honors per-gloss thresholds; voting buffer logic;
temperature scaling monotonic. pytest: threshold/temperature fitting on a fixture.
**Acceptance:** ≥ the current shipped set still passes; borderline signs that meet their
**precision** target may ship behind a higher bar; felt accuracy improves. **On-device:**
trivial. **Cost:** low–medium, **and it can deliver value before any retrain lands.**

## P4M8 — Self-supervised pretraining (biggest ceiling-raise; last/heaviest)

**Goal.** Attack the root cause — small-data overfitting — with masked pose pretraining,
the dedicated remedy in the literature (SignBERT / SignBERT+ / BEST). Build-time only, so
**on-device cost is unchanged** (we ship only the fine-tuned classifier).

**What.** Pretrain a pose encoder by **masking & reconstructing** landmark
joints/frames/clips on **all available clips** — including the 18 unshipped glosses and
any extra *unlabeled* MS-ASL we can pull — then **fine-tune** the P4M5 classifier head on
the labeled 81. → **ADR-026**. Treated as a **research milestone**: it ships only if it
beats the honest baseline by a worthwhile margin; otherwise it's documented as explored.

**Maps to code.** New `ml/.../pretrain/` stage (masked-reconstruction objective over the
cached landmark arrays); fine-tune reuses `train_and_eval`. No new runtime ops if the
encoder is exported into the same small classifier.

**Tests.** pytest: masking/reconstruction shape contracts on a fixture; fine-tune
smoke test. **Acceptance:** honest CV vs the pre-pretraining baseline; re-gate. **Cost:**
high (build-time compute + new stage). **On-device:** unchanged.

## Phase 4 checklist

| Milestone | Track | Status | Branch |
| --- | --- | --- | --- |
| P4M1 — Sign search tab | discovery | ☑ merged [#26](https://github.com/aakash-tir/sign-app/pull/26) + deployed | `milestone/P4M1-sign-search` |
| P4M2 — Diagnose low signs (confusion + diversity) | accuracy | ☑ merged [#27](https://github.com/aakash-tir/sign-app/pull/27) — 3 confusable / 15 diffuse / 0 data-starved (§6.7) | `milestone/P4M2-diagnose` |
| P4M3 — Augmentation + loss levers (mirroring, class weight) | accuracy | ☑ merged [#31](https://github.com/aakash-tir/sign-app/pull/31) — **negative** (mirror 0.669 / cw 0.674 < 0.687); mirroring proven feasible, kept opt-in (§6.11) | `milestone/P4M3-aug-loss` |
| P4M4 — Motion / velocity features (spec v2) | accuracy | ☑ merged [#28](https://github.com/aakash-tir/sign-app/pull/28) — **negative** (0.615→0.594), toolkit kept opt-in, not shipped (§6.8) | `milestone/P4M4-motion-features` |
| P4M5 — Temporal model upgrade (attention pooling) | accuracy | ☑ merged [#29](https://github.com/aakash-tir/sign-app/pull/29) + deployed — **BiGRU+attention 0.615→0.687, 71 ship** (§6.9) | `milestone/P4M5-temporal-model` |
| P4M6 — Targeted per-gloss data fetch (owner-gated) | accuracy | ☐ not started (low-value — data not the bottleneck per P4M2) | `milestone/P4M6-targeted-data` |
| P4M7 — Runtime confidence (per-sign thresholds, voting) | accuracy | ☑ merged [#30](https://github.com/aakash-tir/sign-app/pull/30) + deployed — per-sign bars (69 sub-0.5) + temp 1.6 + 3-window voting (§6.10) | `milestone/P4M7-runtime-confidence` |
| P4M8 — Self-supervised pretraining (big swing) | accuracy | ☐ not started — **track paused** (owner, 2026-06-02); the remaining big-swing lever | `milestone/P4M8-ssl-pretrain` |

Legend: ☐ planned · ◐ in progress / scoping · ☑ merged.

## ADRs to record in this track (as each milestone lands)

- **ADR-022** — Motion/velocity features → frame spec **v2** (regenerate golden vectors
  both sides). *(P4M4)*
- **ADR-023** — Mirroring augmentation via paired L/R-block + pose swap (revisits the
  ADR-020 deferral). *(P4M3)*
- **ADR-024** — Temporal model upgrade (attention pooling / BiGRU; optional two-stream),
  bounded by the on-device size budget. *(P4M5)*
- **ADR-025** — Per-sign acceptance thresholds + confidence calibration + multi-window
  voting (supersedes the global 0.50 accept threshold). *(P4M7)*
- **ADR-026** — Self-supervised masked-pose pretraining, then fine-tune. *(P4M8)*
