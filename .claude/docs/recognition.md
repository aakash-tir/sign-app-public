# ASL Recognition & ML Pipeline

> The hardest, highest-risk part of the project gets its own document. This is the
> result of the research done before implementation. Architecture context is in
> [`architecture.md`](architecture.md); the decision rationale is ADR-002 in
> [`decisions.md`](decisions.md).

## 1. The core problem & the chosen approach

We need to decide, from the camera, **whether the user performed the prompted ASL
sign**. Two fundamentally different families exist:

1. **End-to-end video models** (e.g. I3D, VideoMAE on raw RGB clips). High
   ceiling, heavy, hard to run on-device in a browser, data-hungry.
2. **Landmark-based models**: a hand/pose tracker extracts skeletal keypoints,
   then a small classifier runs on those keypoints. Much lighter, runs in the
   browser, privacy-preserving, and the landmark extractor is already solved.

**We choose landmark-based.** It is the only approach that satisfies all our
constraints simultaneously: on-device, offline, cross-platform (one web codebase),
low latency, and no video leaving the device.

```
camera frame ──► MediaPipe Tasks Vision ──► 21 hand landmarks (x,y,z) [+ pose]
                                            │
                                            ▼
                              normalize (wrist origin, scale, handedness)
                                            │
              ┌─────────────────────────────┴───────────────────────────┐
              ▼ STATIC (fingerspelling, hold)         ▼ DYNAMIC (word signs)
        small MLP on one frame                window of ~30 frames → GRU/LSTM
              │                                          │
              └──────────────► {label, confidence} ◄─────┘
```

## 2. Landmark extraction: MediaPipe Tasks Vision

- npm package **`@mediapipe/tasks-vision`** runs entirely **on-device** in the
  browser (WASM + WebGL/WebGPU). No server.
- **Hand Landmarker** returns **21 landmarks per hand**, each with `x, y, z`,
  plus **handedness** (left/right) and world coordinates.
- **Gesture Recognizer** = Hand Landmarker + a gesture classification head; it
  supports **custom-trained gesture models**, which is one viable path for static
  signs (train the gesture head on ASL letters).
- For **dynamic** word signs that involve arms/body/two hands, use **MediaPipe
  Holistic / Pose + Hands** (~543 landmarks/frame: hands + pose + face) so the
  movement and location of the sign are captured, not just handshape.

Critically, **the same MediaPipe landmark topology is available in Python**, so
we extract features identically at training time and runtime — no train/serve
skew (provided we share one normalization spec; see §5).

## 3. Classifier design

### 3.1 Static signs (MVP) — fingerspelling / held handshapes

- Input: one normalized frame → `21 × 3 = 63` features per hand.
- Model: a small **MLP** (e.g. 63 → 128 → 64 → N_classes) or the MediaPipe
  Gesture Recognizer custom head.
- Why first: ASL alphabet + held handshapes are **single-frame**, the easiest and
  most accurate target, and they exercise the *entire* pipeline (camera →
  landmarks → classifier → correct/incorrect UI) end-to-end. Great foundation.

### 3.2 Dynamic signs — word-level

- Input: a sliding **window of ~30 frames** of normalized landmarks (hands +
  upper-body pose).
- Model: stacked **LSTM/GRU** (or 1D-CNN / small Transformer) over the sequence.
  Research baselines use 2 dense + 2 LSTM layers (≈256 units) and report **<70ms**
  client-side latency once converted to TF.js — fast enough for live feedback.
- This is where accuracy gets hard at scale (see §6).

## 4. Datasets

| Dataset | Scope | Use |
| --- | --- | --- |
| **ASL Alphabet** (Kaggle and similar) | 26 letters, static | MVP fingerspelling classifier. |
| **WLASL** (Word-Level ASL) | **2,000 glosses, ~21,083 clips, 119 signers** | Dynamic word-level signs. Subsets WLASL100 / WLASL300 / WLASL1000 / WLASL2000. |
| Self-collected (optional) | curated common signs | Fill gaps / improve robustness for our chosen starter vocabulary; collected as landmark sequences (not raw video) to stay privacy-friendly. |

**M6 plan (decided 2026-05-20, ADR-014):** rather than the full WLASL100 up front,
start with a **small curated starter (~15–25 high-frequency signs)**, source it from
a **Kaggle WLASL mirror** (hosts real clips → avoids the official set's link rot)
and run **our own MediaPipe extraction** (preserves the golden-vector parity
guarantee — we don't trust third-party pre-encoded landmarks). Expand toward
WLASL100/300/2000 only as **measured accuracy** allows (Q5, M6.4). The download is
an **owner action** (Kaggle account already held); see the M6 sub-milestones in
[`milestones.md`](milestones.md).

**Status (static fingerspelling):** trained on the **ASL Alphabet** dataset
(24 static letters, ~500 images/letter → ~10.8k landmark samples) at **~99.5%**
accuracy on a held-out split. Caveat: that split shares the dataset's signer and
recording conditions, so real-world accuracy on a user's own camera/hand will be
lower (domain shift). Broadening signer/condition diversity (more data, or
augmentation) is a later improvement.

**Observed in live testing (2026-05-20) — accepted for now, fix later:**

- **Fist-shape confusion:** closed-fist letters similar to **S** (e.g. A, E, M,
  N, T, O) are sometimes all classified as **S**. They differ mainly in thumb
  position, which 2D webcam landmarks capture weakly. Candidate fixes: more
  diverse data / augmentation, weighting the z (depth) coordinate, or
  confusion-aware thresholds.
- **J and Z misclassified:** these are *dynamic* (motion) letters and are **not**
  in the static model's label set, so attempts map to some other static letter.
  Expected — handled by the dynamic sequence model in **M6**.

Owner decision (2026-05-20): most letters work, so accept these for now; revisit
when improving the static model and when building the dynamic recognizer (M6).

## 5. Normalization spec (shared TS ↔ Python)

To avoid train/serve skew, both the Python trainer and the TS runtime must apply
the **identical** transform. The static (hand-only) spec was frozen and golden-vector
tested both sides in M2; the dynamic extension (items 4+) is frozen with new
golden vectors in **M6.1**. Spec:

1. **Translate** so the wrist landmark (index 0) is the origin.
2. **Scale** by a hand-size reference (e.g. wrist→middle-finger-MCP distance) so
   the features are distance-invariant.
3. **Handedness canonicalization:** mirror left-hand landmarks to a canonical
   hand so the model sees one handedness (store original handedness separately if
   a sign depends on it).
4. For dynamic signs, also normalize **pose** to a shoulder-centered frame and
   represent motion consistently across the window.

A golden-vector fixture (same input → same normalized output in both languages)
is the regression test that keeps the two implementations in lockstep.

### 5.1 Dynamic frame normalization — **frozen (M6.1)**

`id = "pose-shoulder-hands-v1"`. One holistic frame (MediaPipe HolisticLandmarker:
33 BlazePose points + up to two 21-point hands) → one fixed **161-d** feature
vector. Implemented in `frontend/src/recognition/dynamicNormalization.ts` and
mirrored in `ml/src/sign_ml/dynamic_normalization.py`; the shared fixture is
`frontend/src/recognition/fixtures/dynamic-normalization.golden.json` (generated by
`uv run --project ml python -m sign_ml.golden_dynamic`).

**Pose block (33 = 11 pts × 3):** translate so the **shoulder midpoint**
((L+R)/2 of BlazePose 11, 12) is the origin; scale by the **shoulder width**
(‖L − R‖, zero-guarded); keep this fixed upper-body subset, in order —
`[0 nose, 2 L-eye, 5 R-eye, 7 L-ear, 8 R-ear, 11 L-shoulder, 12 R-shoulder,
13 L-elbow, 14 R-elbow, 15 L-wrist, 16 R-wrist]`. Head anchors locate
face-referenced signs; the arm chain + wrists give hand **location/motion**. Pose
is **not** mirrored — the side a sign occupies is meaningful.

**Hand-shape blocks (63 + 63):** each hand reuses the static
`normalizeHandLandmarks` (wrist origin, MCP-9 scale, Left→canonical mirror) — the
location-invariant **handshape**. An absent hand contributes a zero block.

**Presence flags (2):** `[leftPresent, rightPresent]` (1/0).

**Layout:** `[ pose 33 | left hand 63 | right hand 63 | leftPresent, rightPresent ]`.

**Window:** capture is throttled to ~30 FPS and buffered into a fixed
`WINDOW_SIZE = 30`-frame window (`frameWindow.ts`); short windows are **front
zero-padded**, so a sequence is always `30 × 161`. The trainer pads identically.

> Refinements deferred (revisit with real data in M6.2): explicit velocity/Δ
> features, left-/right-handed-signer canonicalization, and using pose `visibility`.

## 6. The central risk: word-level accuracy

Research reality check (2025 literature):

- On **WLASL100**, strong models reach roughly **~75% top-1**.
- On the full **WLASL2000**, top-1 is much lower (skeleton/GCN baselines around
  **~30–38%** even with phonology-aware tricks).
- Accuracy degrades with vocabulary size, signer variation, and recording
  conditions.

**Implication:** a large-vocabulary, high-accuracy dynamic recognizer is
*research-grade* and should **not** be on the MVP critical path.

### Mitigations (product + technical)

1. **Scope the MVP** to (a) **fingerspelling** (static, high accuracy) and (b) a
   **small curated set of common dynamic signs** where we can hit usable accuracy.
2. **Lean on the existing UX safety valves** (already in the spec):
   - **"I forgot"** → reveal the sign.
   - **"That's what I did"** → user overrides a false negative to "correct".
   These convert recognition imperfection from a blocker into a minor friction.
3. **Confidence threshold + temporal debounce:** require N consecutive agreeing,
   high-confidence frames before declaring "correct" to cut false positives.
4. **Per-sign acceptance, not full classification:** for verification we only need
   "does this match the *prompted* word?", which is easier than open-set N-way
   classification. We can calibrate a per-sign acceptance threshold.
5. **Expand vocabulary in phases** (M6 stretch), publishing measured accuracy per
   batch so scope stays honest.

### 6.1 Measured accuracy — curated 20-sign starter (M6.4)

GRU over the frozen 161-d features, 193 local WLASL clips, with landmark-sequence
augmentation. The native WLASL test split is ≈1 clip/gloss (too small to gate on),
so accuracy is measured by **5-fold stratified cross-validation** (every sample
predicted once in its held-out fold):

- **Aggregate: top-1 ≈ 62%, top-5 ≈ 95%** (5-fold, n=193).

> **Superseded as the gate (P3M1, ADR-019):** this *stratified-clip* split lets a
> signer sit in both train and test, overstating accuracy. The honest **signer-
> disjoint** baseline is in §6.3; the per-gloss table below is kept for history.

**Per-gloss top-1 (CV)** drives the ship gate (**bar = 0.50**):

| Shipped (≥ 0.50) | | Excluded (< 0.50) |
| --- | --- | --- |
| family 1.00 · sorry 0.86 · help 0.86 · finish 0.78 | yes 0.75 · more 0.75 · drink 0.73 · please 0.71 | **like 0.00** · bad 0.30 |
| want 0.67 · no 0.64 · sad 0.62 · go 0.60 | love 0.57 · eat 0.57 · good 0.50 · learn 0.50 | happy 0.38 · thank you 0.43 |

**Gate result:** **16 of 20 signs ship**; `like`, `bad`, `happy`, `thank you` are
**held back** (likely confusable handshapes/motion; revisit with more clips or
augmentation). The shipped set lives in `frontend/src/content/dynamicVocab.ts` and
the app only prompts shipped glosses. Reproduce with
`uv run --project ml python -m sign_ml.dynamic_pipeline crossval`.

### 6.2 Vocabulary expansion — +4 everyday signs (P2M5b)

Using the canonical ingest layer (P2M5a) and the WLASL clips already on disk, we
screened 12 high-coverage everyday glosses and **added the four that cleared the
0.50 gate with margin**: **walk 0.91 · tall 0.69 · cold 0.67 · before 0.62** (24-gloss
5-fold CV, top-1 ≈ 0.58 / top-5 ≈ 0.92, n=245). The other eight
(who/what/mother/man/dog/computer/bed/apple) scored < 0.45 and were dropped — local
coverage is only ~10–16 clips/gloss, which caps accuracy.

- **Shipped now: 20 signs** = the curated 16 + `before`, `cold`, `tall`, `walk`.
- The existing 16 are **retained** (not demoted on a single noisy CV run — n≈10/gloss
  makes per-gloss CV jumpy); recognition misses are absorbed by "That's what I did"
  (ADR-007). The model is trained on 24 glosses (the 4 still-held-back
  `like`/`bad`/`happy`/`thank you` remain unshipped).
- Reproduce: `python -m sign_ml.dynamic_pipeline extract --vocab expanded` →
  `… crossval` / `… train`. Meaningfully more clips per sign needs a new dataset
  (MS-ASL, owner download — P2M5b-data, ADR-016).

> These are starting numbers on a small, signer-limited set; real-camera accuracy
> will be lower (domain shift). The "That's what I did" valve absorbs misses.

### 6.3 Honest baseline — signer-disjoint evaluation (P3M1, ADR-019)

The CV in §6.1–6.2 splits **clips**, so a signer can sit in both train and test and
**overstate** accuracy. P3M1 makes the gate **signer-disjoint**: `signer_folds`
deals whole signers to folds (greedy-balanced by sample count), so no one's clips
straddle train/test — wired via `cross_validate(..., signer_ids=…)` and the
`signers.npy` the extract stage now caches.

Side-by-side on the **same 20-gloss starter set** (n=193, 36 signers, seed 42,
identical code):

| Evaluation | top-1 | top-5 |
| --- | --- | --- |
| Stratified-clip (old; overstates) | 0.622 | 0.953 |
| **Signer-disjoint (the gate, ADR-019)** | **0.570** | **0.922** |

Leakage was inflating top-1 by ~5 points. **0.570 / 0.922 is the honest Phase-3
starting line** for the starter set. It is still a *dataset* holdout, so it remains
an **optimistic ceiling** for real-camera use — the deferred real-camera holdout
(Q8) would close that gap.

**Per-gloss under the honest gate** (bar 0.50): family 0.91 · learn 0.88 · please
0.86 · no 0.82 · sorry 0.71 · go/drink/finish 0.67 · help 0.64 · more/sad 0.62 ·
eat 0.57 · yes 0.50 clear it; **good 0.40 · want 0.33 · love 0.29** slip below,
joining the already-excluded like 0.20 · bad 0.40 · thank you 0.29 · happy 0.12.

**We do not re-gate the shipped vocabulary on this run.** Per-gloss CV at
n≈7–15/gloss is noisy, and the shipped model is the 24-gloss set (§6.2), not this
starter cache. Re-gating happens in **P3M2** once MS-ASL adds clips and we retrain —
then signer-disjoint is the gate **by default**. Reproduce:
`uv run --project ml python -m sign_ml.dynamic_pipeline crossval`
(add `--stratified` for the old comparison).

### 6.4 Landmark-space augmentation — prototype (P3M3, ADR-020)

P3M3 added three **landmark-space** augmentations to `augment_sequences` (off by
default; `crossval --aug` enables the preset): **per-landmark dropout** (`drop_landmarks`
— per-joint detection misses), **in-plane rotation** (`rotate_xy` — viewpoint/roll), and
**end-anchored time-warp** (`time_warp` — speed; keeps the last, GRU-read frame fixed).
On the **same** starter-20 signer-disjoint gate (n=193, seed 42):

| Training aug | top-1 | top-5 |
| --- | --- | --- |
| baseline (jitter + frame-dropout) | 0.570 | 0.922 |
| **+ P3M3 preset** | **0.601** | 0.917 |

A **+3-point** top-1 gain on the honest gate — a directional signal on this tiny set;
**final acceptance + tuning is on the P3M2 (MS-ASL) data**, where more signers make the
estimate stable (ADR-020). **Mirroring and time-shift were deliberately excluded:** the
hand normalization already collapses handedness (§5 — Left mirrored to canonical Right),
so a correct left-right mirror needs paired pose-landmark swaps + per-hand
re-canonicalization (skew-prone), and front-padded windows + a last-timestep GRU make
naive time-shift corrupt the final read frame. Reproduce: `… crossval --aug`.

### 6.5 P3M2 retrain — MS-ASL ∪ WLASL combined (ADR-016/019)

P3M2 added **MS-ASL** (C-UDA — train-and-ship, ADR-016) to the WLASL we already had,
through the canonical ingest layer (P2M5a). The owner ran the `yt-dlp` fetch
(`msasl_download`, cookies.txt auth); realized coverage after link rot:

| Source | clips | signers |
| --- | --- | --- |
| WLASL (existing) | 245 | 43 |
| MS-ASL (P3M2 fetch) | ~909 | 85 |
| **Combined cache** | **1151** | **128** |

All 24 glosses clear the data floor (≥ 12 clips / ≥ 5 signers, Q7); most have 30–60
clips from 20–30 signers. Extraction is **resumable per-clip** (one `.npy` each, in a
worker subprocess the parent recycles + per-clip-timeouts); 6 MS-ASL clips that hung
MediaPipe `detect()` were auto-**quarantined** (`.skip`) and excluded — link-rot-
tolerant by design.

**Honest signer-disjoint CV (5-fold, seed 42):**

| Model | n | top-1 | top-5 |
| --- | --- | --- | --- |
| Starter-20, WLASL only (P3M1 baseline) | 193 | 0.570 | 0.922 |
| **24-gloss, MS-ASL ∪ WLASL (P3M2)** | 1151 | **0.719** | **0.931** |

**+15 points top-1** from more clips and far more signers — the data lever, as the
central framing predicted. The exported model's held-out signer-disjoint **test** split
(n=211) reads **top-1 0.716 / top-5 0.919**, consistent with CV.

**Per-gloss top-1 under the honest gate (bar 0.50):** love 0.91 · family 0.90 ·
want 0.88 · sad 0.88 · yes 0.84 · finish 0.84 · learn 0.83 · help 0.81 · more 0.79 ·
please 0.78 · drink 0.77 · no 0.77 · like 0.74 · cold 0.73 · go 0.73 · sorry 0.70 ·
eat 0.69 · walk 0.67 · happy 0.55 · bad 0.53 **clear it**; **tall 0.49 · thank you
0.44 · before 0.43 · good 0.36** fall below.

**Re-gate (strict honest gate, owner-confirmed):** the shipped set stays at **20** but
rises in quality — **promoted** `like`/`bad`/`happy` (now ≥ 0.50 with the larger,
more signer-diverse data) and **demoted** `good`/`before`/`tall` (below 0.50 honestly;
their earlier shipping rested on the leaky/noisy estimate P3M1 flagged). `thank you`
stays held back. **Every shipped gloss now clears 0.50 on the honest gate.** The
24-class GRU (ONNX 300 KB) is bundled at `frontend/public/models/dynamic/`; the app
prompts only `SHIPPED_GLOSSES` (`content/dynamicVocab.ts`). Reaching ~50 signs needs a
further MS-ASL download pass for new glosses (this pass reinforced the existing 24).
Reproduce: `… dynamic_pipeline extract-combined` → `assemble-combined` →
`crossval --cache models/combined` → `train --cache models/combined`.

### 6.6 P3M2c vocab50 — the ~50-sign push (81-gloss model)

Applied the P3M2 recipe to **57 new everyday glosses** (a read-only MS-ASL+WLASL
coverage pre-screen picked candidates above the data floor; `look` dropped — not a
class in either source). The owner ran the MS-ASL fetch; YouTube bot-detection
throttling forced **three 75-min-cooldown retry passes** (the focused final pass
recovered `play`/`tired`/`doctor`, confirming they were throttle victims, not link
rot). A two-part **ffmpeg-on-PATH** fix (`_resolve_ffmpeg`: canonical-name copy +
`PATH` prepend) was needed — yt-dlp's partial-download gate ignores
`--ffmpeg-location` (see [[msasl-download-setup]]).

| Source | clips | signers |
| --- | --- | --- |
| WLASL (local) | 709 | 49 |
| MS-ASL (vocab50 fetch) | 2880 | 114 |
| **Combined cache (81 glosses)** | **3583 samples** | **163** |

All 81 glosses clear the data floor. **Honest signer-disjoint CV (5-fold):**

| Model | n | top-1 | top-5 |
| --- | --- | --- | --- |
| 24-gloss MS-ASL ∪ WLASL (P3M2) | 1151 | 0.719 | 0.931 |
| 81-gloss, plain training | 3583 | 0.561 | 0.842 |
| **81-gloss + P3M3 augmentation (shipped)** | 3583 | **0.615** | **0.872** |

The overall top-1 is lower than P3M2's 0.719 **because this is an 81-way problem**, not
24-way — the per-gloss gate is what matters. **P3M3 landmark-space augmentation**
(rotation 12° / per-joint dropout 0.1 / time-warp 0.2), now tuned on real combined
data, lifts the aggregate **+5.4 pts** and is enabled for the shipped model (threaded
through `train --aug` so the export matches the gate). It recovers both P3M2 incumbents
(`drink` 0.45→0.51, `happy` 0.48→0.55), so **no sign is demoted**.

**Re-gate (≥ 0.50, owner-confirmed bar):** **63 of 81 glosses ship** — all 20 from P3M2
plus **43 new**, including `thank you` (0.63, held back since M6). The 18 below the bar
(`come` 0.08 … `mother` 0.49) stay known-but-unshipped and act as negatives. The
81-class GRU (**ONNX 315 KB**) is bundled at `frontend/public/models/dynamic/`; 63
WLASL-derived reference clips regenerated. Reproduce: `… extract-combined --vocab
vocab50` → `assemble-combined --vocab vocab50` → `crossval --cache models/combined
--folds 5 --aug` → `train --cache models/combined --aug`.

### 6.7 Diagnosis of the 18 low signs (P4M2)

Before chasing accuracy (Phase 4 accuracy track, [`phase4.md`](phase4.md)), P4M2
**diagnoses why** each of the 18 below-gate glosses is low — exactly as P3M1 made
accuracy honest before improving it. `cross_validate` now also emits a **confusion
matrix** + **per-gloss distinct-signer count** + a **hand-tracking proxy** (fraction of
active frames with ≥ 1 hand detected); `dynamic_pipeline diagnose --aug` classifies each
low gloss by likely cause. Run on the shipped 81-gloss cache (signer-disjoint, with
augmentation → the same CV top-1 **0.615**):

| cause | count | meaning → lever |
| --- | --- | --- |
| **confusable** | **3** | one other sign captures ≥ 30 % of its samples → motion/temporal model |
| **diffuse** | **15** | errors spread across many signs; not data-starved, not mistracked → discriminative power |
| data-starved | 0 | (none — every low sign has **12–39 signers**) |
| poorly-tracked | 0 | (none — hand presence **0.69–0.83**, all above the 0.60 floor) |

**The headline finding: data is *not* the bottleneck for these signs.** Every one has
ample signer diversity (12–39) and acceptable tracking, so a targeted data fetch (P4M6)
is **low-value here** — the model simply **can't separate them**. That points the track
at the **modeling** levers (motion/velocity features P4M4, temporal attention pooling
P4M5) with augmentation (P4M3) as the cheap first try.

**The 3 cleanly confusable signs** (a single dominant confuser — likely shared
handshape/location where *motion* is the real differentiator):

| gloss | top-1 | mistaken for | n / signers |
| --- | --- | --- | --- |
| `come` | 0.08 | **car** (62 %) | 13 / 12 |
| `sleep` | 0.12 | **eat** (44 %) | 25 / 22 |
| `nice` | 0.47 | **school** (37 %) | 60 / 34 |

**The 15 diffuse signs** still often have a *moderate* leading confuser (just below the
30 % bar) — `tall`→boy 26 %, `white`→like 25 %, `good`→thank you 25 %, `dog`→milk 19 %,
`small`→book 18 %, `who`→milk 16 %, … — i.e. each is weakly confused with **several**
neighbours at once. This is the signature of **under-separated trajectories** that a
richer feature (motion) and a whole-sequence reader (attention vs last-timestep) are
meant to fix. Full per-gloss confusion + counts in `models/combined/diagnosis.json`.
Reproduce: `… diagnose --cache models/combined --aug`.

### 6.8 Motion (velocity) features — tested, did **not** help (P4M4)

The P4M2 diagnosis (§6.7) pointed at **discriminative power**, so P4M4 added **velocity**
features — per-frame first-difference of the 159 spatial coords, appended to each window
(161 → 320 dims), the most-cited fix for visually-similar signs. Built as a parity-safe
**sequence-level transform** (`with_motion` / `withMotion`) with a shared golden fixture
(`dynamic-motion.golden.json`); per-frame normalization (`pose-shoulder-hands-v1`) is
unchanged (ADR-022).

**Honest signer-disjoint CV (5-fold, with P3M3 augmentation), motion applied _after_
augmentation:**

| Model | top-1 | top-5 | glosses ≥ 0.50 |
| --- | --- | --- | --- |
| **Positions only (shipped)** | **0.615** | 0.872 | **63 / 81** |
| + velocity features | 0.594 | 0.862 | 58 / 81 |

**Motion regressed the honest gate (−2.1 pts; 5 more glosses fall below 0.50).** It
slightly helped the 3 confusable signs (`come` 0.08→0.15, `sleep` 0.12→0.20) but hurt
many mid-tier signs (`hello` 0.51→0.36, `go` 0.73→0.59) — the signature of **overfitting
from doubling the input dim** on a 3583-sample set with a tiny 2-layer GRU. (A first run
scored 0.560 due to an ordering bug — augmentation ran on the motion-appended layout and
corrupted the presence flags; fixed by deriving motion *after* augmentation, which
recovered to 0.594 but still below baseline.)

**Decision (owner): do not ship motion.** The shipped model stays the **positions-only
0.615** 81-gloss GRU; the runtime is unchanged. The motion toolkit is **kept as an opt-in
tool** (`with_motion`/`withMotion` + golden parity + `train/crossval/diagnose --motion`,
default off) so **P4M5 can re-test motion together with a better temporal model**
(attention pooling) — motion may pay off once the model can exploit it and isn't just
widening an overfit-prone input. Reproduce: `… crossval --cache models/combined --folds 5
--aug --motion`.

### 6.9 Temporal model: BiGRU + attention pooling — the win (P4M5)

The P4M2 diagnosis said the low signs are **under-separated**, and the original model
compressed the whole sign into the GRU's **last timestep**. P4M5 lets the model read the
**whole trajectory**: `build_sequence_model` gained `pooling={last,mean,attention}` (a
learned, **padding-masked** weighted sum over the real frames) + an optional
**bidirectional** GRU. Honest signer-disjoint CV (5-fold, with P3M3 augmentation),
positions-only:

| Model | top-1 | top-5 |
| --- | --- | --- |
| Last-timestep (previous shipped) | 0.615 | 0.872 |
| Attention pooling | 0.656 | 0.878 |
| Attention + motion (P4M4) | 0.635 | 0.868 |
| **Bidirectional + attention (shipped)** | **0.687** | **0.895** |

**+7.2 points top-1** over the last-timestep baseline — the biggest single gain since the
P3M2 data jump — from architecture alone, **no new data**. Motion features still drag
(0.635 < 0.656), reconfirming §6.8: not shipped. The win is the **bidirectional GRU +
masked attention pooling**, positions-only. The model I/O contract is unchanged (same
30×161 input, 81 logits) so the **runtime is untouched**; the export round-trips through
onnxruntime cleanly (verified) and the ONNX is **690 KB** (was 315 KB — bidirectional
doubles the GRU output; well within the on-device budget).

**Re-gate (≥ 0.50, owner-confirmed): 71 of 81 glosses ship** (up from 63). **+9 promoted**
(`money`, `woman`, `girl`, `man`, `car`, `good`, `run`, `nice`, `who`) and **`hungry`
demoted** (0.33 honestly on the stronger model — documented, not silent). The 10 still
below: `dog` 0.33, `hungry` 0.33, `stop` 0.33, `sleep` 0.36, `mother` 0.45, `before` 0.46,
`come` 0.46, `tall` 0.46, `small` 0.46, `white` 0.48. New 81-class BiGRU+attention ONNX
bundled; 9 new WLASL-derived reference clips added, `hungry.json` removed. Reproduce:
`… crossval --cache models/combined --folds 5 --aug --pooling attention --bidirectional`
→ `train … --aug --pooling attention --bidirectional`.

### 6.10 Runtime confidence: per-sign thresholds + calibration + voting (P4M7)

P4M7 improves the **felt** recognition experience without retraining (the honest
accuracy gate doesn't measure these — they're UX/robustness, validated by tests +
reasoning):

- **Per-sign acceptance thresholds.** The prompt's "Good — that's X!" used a global
  `accepts` bar of 0.5. Now each sign has its own bar = the **25th percentile of its
  (calibrated) true-class probability** on the honest held-out folds, clamped to
  `[0.15, 0.5]`. Capped at 0.5 so acceptance is **never stricter** than before — weak
  signs just get a more forgiving bar (the "That's what I did" valve handles the rest).
  Fit by `fit_per_sign_thresholds`; **69/81 signs get a sub-0.5 bar** (the weakest floored
  at 0.15).
- **Confidence calibration (temperature).** A single softmax **temperature T = 1.60**
  (fit by NLL on the held-out folds) softens the over-confident BiGRU so the displayed
  `%` is honest. Applied in `softmax(logits, T)` at inference.
- **Multi-window temporal voting.** `useDynamicSignRecognition` averages the **last 3**
  inference windows' probability vectors (`averageProbs`) before deciding the prediction
  + acceptance, so a borderline sign isn't decided on one noisy window.

All three are **carried in the model `metadata.json`** (`temperature`, `acceptThresholds`)
or are pure runtime logic; **no model/normalization change** (same ONNX, `featureDim` 161),
and everything is backward-compatible (absent metadata → T = 1, global 0.5 bar). Fit with
`… calibrate --cache models/combined --aug --pooling attention`.

### 6.11 Mirroring + class-weighted loss — tested, did **not** help (P4M3)

P4M3 targeted the 10 remaining below-gate signs with two cheap, build-time levers on top
of the shipped BiGRU+attention model (§6.9):

- **Horizontal mirroring** — a **parity-correct, train-only** augmentation
  (`mirror_frames`). The P3M3 deferral assumed mirroring was skew-prone under the
  handedness-collapsing hand normalization; it isn't. Because the hand normalization is
  handedness-**canonical** (it x-flips Left hands to the Right shape), a mirror of a
  normalized frame is **exact**: swap the L/R pose pairs + negate `x`, **swap the two hand
  blocks with no internal change**, swap presence flags. A unit test proves
  `mirror_frames(normalize(frame)) == normalize(flipped capture)`.
- **Class-weighted loss** — inverse-frequency weighted cross-entropy to lift the hard/low-n
  classes (`class_weights`).

**Honest signer-disjoint CV (BiGRU+attention, aug):**

| Config | top-1 | signs ≥ 0.50 |
| --- | --- | --- |
| **Baseline (shipped, §6.9)** | **0.687** | **71** |
| + mirror | 0.669 | — |
| + class-weight | 0.674 | 71 (churned) |
| + mirror + class-weight | 0.661 | — |

**All three regress.** Class-weight is the most interesting: it keeps the same **71**-sign
count but only **reshuffles the tail** — it promotes the genuinely-hard signs (`come`
0.46→0.54, `before` 0.46→0.66, `dog`/`sleep`/`tall`) while **demoting six
currently-shipped signs** (`good` 0.41→0.39, `white`, `money`, `woman`, `man`, `girl`) at
a lower overall accuracy. Mirroring likely adds label-inconsistent examples for signs whose
*side* carries meaning. **Decision (owner): do not ship** — the shipped model stays the
0.687 / 71-sign BiGRU+attention. Both levers are **kept as opt-in, tested tooling**
(`crossval/train --mirror`, `--class-weight`, default off) for future use (e.g. on a larger
dataset). Reproduce: `… crossval … --pooling attention --bidirectional --mirror
--class-weight`.

### 6.12 Label smoothing — the win (P4M10, ADR-027)

Where the P4M3/P4M4 cheap levers regressed, **label smoothing** lifts the shipped
BiGRU+attention model (§6.9). The P4M2 diagnosis found the low tail is **under-separated,
not data-starved**; label smoothing (softening the one-hot target so the loss stops
pushing logits to extremes) is a textbook regulariser for exactly that — and it adds **no
capacity**, avoiding the P4M4 overfitting trap (doubling the input dim on 3583 samples hurt).

**Honest signer-disjoint CV (BiGRU+attention, aug), sweep over the smoothing factor:**

| label smoothing | top-1 | top-5 | signs ≥ 0.50 |
| --- | --- | --- | --- |
| **0.00 (shipped, §6.9)** | **0.687** | 0.895 | 71 |
| 0.05 | 0.730 | 0.896 | 76 |
| 0.10 | 0.729 | 0.900 | 76 |
| **0.15 (shipped)** | **0.732** | **0.901** | 77 (strict) |

The **+4.5-pt** aggregate gain is robust across the whole sweep; only the borderline-0.50
membership shuffles (small-n noise: `come` n=13, `stop` n=15, `dog` n=21). **0.15** is the
pick — best aggregate **and** top-5. At 0.15 the only signs genuinely below the bar that
were *never* shipped are `dog` (0.38) and `stop` (0.47); the two incumbents that dip
(`need` 0.46, `thank you` 0.49) are **retained** under the established
no-demote-on-noise policy (P2M5b). **Re-gate: 79 ship** (71 prior + 8 promoted: `hungry`
0.33→≥0.50, `sleep`, `mother`, `before`, `come`, `tall`, `small`, `white`), **no
demotions**. `hungry`, demoted by P4M5, recovers here.

**On-device:** unchanged — label smoothing is a **loss-only**, build-time change; the ONNX
graph, 161-d feature contract, normalization id, and `onnxruntime-web` runtime are all
identical (same 30×161 → 81 logits). The model is re-calibrated (P4M7 temperature +
per-sign thresholds) under the same loss. Reproduce: `… crossval … --pooling attention
--bidirectional --aug --label-smoothing 0.15`; ship: `… train …` then `… calibrate …` with
the same flags.

### 6.13 On-disk vocabulary expansion toward 100 — tested, did **not** help (P4M15)

Goal: grow to **100 published signs** (all ≥ 0.50 honest). First, the **free** lever —
WLASL glosses already on disk (11,980 videos), no download. A read-only screen found only
**19** new glosses meeting the data floor (≥ 12 local clips; **none ≥ 20**) — the current
81 are the high-coverage ones (boosted by MS-ASL). Added them as `vocab100`, extracted
(245 clips, 0 quarantined), re-gated on the shipped config.

**Honest signer-disjoint CV (100 glosses):** aggregate **0.704** (vs 0.732 at 81). Only
**`bed` (0.54, n=13)** of the 19 cleared 0.50; the rest fell well below (`cool` 0.00,
`last` 0.08, `candy`/`short` 0.15 … `cousin` 0.43). The original 79 held (**0.731** over
them — no regression; the boundary incumbents just shuffle, `money`/`woman` ~0.47 now).
**Decision: not shipped** — a 100-class model (18 dead classes) for one borderline sign
isn't worth it. The on-disk data is too thin, as predicted. `vocab100`/`ONDISK_GLOSSES`
kept as tooling.

**→ The path to 100 is data.** Prepared `DOWNLOAD_GLOSSES` (36 high-coverage everyday
MS-ASL glosses, each ≥ 43 clips) + `vocab136` + a `download` fetch vocab; the owner runs
the throttled MS-ASL fetch (the proven +15-pt lever, §6.5), then extract/train/gate to
100. Guide: [`../../docs/reaching-100-signs.md`](../../docs/reaching-100-signs.md).

### 6.14 MS-ASL download → 100+ published signs (P4M16)

The data lever from §6.13 delivered. The owner ran the MS-ASL fetch for the 36
`DOWNLOAD_GLOSSES`; after throttle-cooldown retry passes, **29 came in with usable
coverage** (the fetch needs `--sleep` between requests — YouTube rate-limits a no-delay
session after ~370 clips; the modern fetch also needs yt-dlp ≥ 2026.6 + `yt-dlp-ejs` + a
Deno JS runtime for the nsig "n challenge", P4M16 download fix). Trained a **117-gloss**
model (`vocab_dl` = vocab50 ∪ the 36 download glosses, **excluding** the P4M15 on-disk
flops) — 4805 samples, same BiGRU + attention + label-smoothing-0.15 config.

**Honest signer-disjoint CV:** aggregate **0.696** over the 117 (vs 0.732 over 81 — more
classes are harder). **100 of 117 glosses clear 0.50**; **27 of the 36 new download
glosses cleared** (`live` 0.89, `shoes` 0.87, `home`/`apple` 0.85, `sick` 0.82 … `purple`
0.50). The original 79 **hold at 0.718** aggregate (−1.4 pts); 6 dip just under the bar
(`school` 0.42 … `man` 0.49) and are **kept** under no-demote-on-noise. **Re-gate: 79 + 27
= 106 published signs**, no demotions. 9 download glosses stayed below (`lost` 0.47 …
`night` 0.00, several thin from the rate-limit cutoff). Reference clips for all 27 come
from local WLASL. **No runtime/spec change** (same 30×161 frame, `featureDim` 161); the
model output grows 81 → 117 logits, re-calibrated (P4M7). Detail + report:
[`../../docs/sign-language-accuracy.xlsx`](../../docs/sign-language-accuracy.xlsx).

## 7. Python training pipeline (build-time only)

Lives in `ml/` (see [`architecture.md`](architecture.md) §3). Stages:

1. **extract/** — run MediaPipe over dataset videos/images → cached landmark
   arrays (+ the shared normalization).
2. **train/** — train static MLP and/or dynamic GRU/LSTM; track metrics.
3. **export/** — export the trained model. *Static MVP:* plain JSON weights
   (`format: "mlp-1"`) → `frontend/src/recognition/models/` (ADR-011). *Dynamic
   (M6):* PyTorch → **ONNX** (`torch.onnx`), with a `metadata.json` skew guard
   (ADR-015).
4. **eval/** — report top-1/top-5 per vocabulary subset; gate vocabulary
   expansion on measured accuracy.

Quality gates on this code: **`ruff format` + `ruff check`**, **`mypy .`**,
**`pytest`** (per the plan's literal requirement, now scoped to the Python side).

## 8. Runtime inference (frontend)

- *Static MVP:* a small hand-written MLP forward pass over the bundled JSON model
  (no ML runtime; ADR-011). *Dynamic (M6):* load the ONNX model with
  **onnxruntime-web** and cache via the service worker (ADR-015).
- Feed normalized landmarks (single frame or window) → `{label, confidence}`.
- Domain layer applies threshold + debounce, then emits correct/incorrect, which
  drives bucket transitions (Practice) or "Good job"/sentence unlock (Learn).

## 9. Research sources

MediaPipe (on-device, web):
- [Gesture recognition guide for Web — Google AI Edge](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer/web_js)
- [Hand landmarks detection guide for Web — Google AI Edge](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js)
- [`@mediapipe/tasks-vision` (npm)](https://www.npmjs.com/package/@mediapipe/tasks-vision)

ASL datasets & recognition research:
- [WLASL homepage (Dongxu Li)](https://dxli94.github.io/WLASL/)
- [WLASL overview — Emergent Mind](https://www.emergentmind.com/topics/word-level-american-sign-language-wlasl-video-dataset)
- [Real-Time ASL Recognition Using 3D CNNs and LSTM (arXiv 2512.22177)](https://arxiv.org/pdf/2512.22177)
- [Improving Sign Recognition with Phonology (arXiv 2302.05759)](https://arxiv.org/pdf/2302.05759)
- [SLRNet: Real-Time LSTM-Based Sign Language Recognition (arXiv 2506.11154)](https://arxiv.org/html/2506.11154v1)

Browser/TF.js landmark-sequence approach:
- [Real-time sign detection with MediaPipe + TF LSTM (GitHub: mHash1m)](https://github.com/mHash1m/sign-language-detection)

PWA / camera / offline:
- [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa)
- [Camera access in a PWA (getUserMedia)](https://simicart.com/blog/pwa-camera-access/)
- [Building an Offline-First React PWA (2026 guide)](https://dalenguyen.me/blog/2026-01-18-building-offline-first-react-app-complete-pwa-guide)
