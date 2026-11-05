# Machine Learning — what we actually do, and why

> The deep-dive on the recognition pipeline: the approach, the models, the
> datasets, the training process, the numbers we measured, and the honest
> caveats. The strict spec lives in
> [`../.claude/docs/recognition.md`](../.claude/docs/recognition.md); this is
> the readable version.

## 1. The problem in one sentence

Given a webcam frame (or short sequence of frames), decide whether the user
performed the **prompted ASL sign**. That's a classification problem — but
with two complications that shape every decision below: it has to run
**on-device** (no servers, no uploads, fully offline), and word-level ASL
recognition is genuinely **research-grade hard**.

## 2. Two families of approach — and which we picked

You can recognize signs from video in two fundamentally different ways:

| | **End-to-end video models** (I3D, VideoMAE, ViViT, etc.) | **Landmark-based models** (what we use) |
| --- | --- | --- |
| Input | Raw RGB pixels over time | Skeletal keypoints (hand & body) over time |
| Strength | Highest accuracy ceiling in the literature | Tiny, fast, on-device, privacy-preserving |
| Weakness | Heavy; hard to run in a browser; data-hungry | The landmark tracker can lose detection in bad lighting |
| Where the work goes | Training a big video network | A pretrained landmark tracker + a small classifier on top |

**We use landmark-based.** It's the only approach that simultaneously satisfies
all our constraints: on-device, offline, cross-platform from one codebase, low
latency, no video leaving the device. The trade is a lower accuracy ceiling
at large vocabularies — which we deal with by **scoping the vocabulary
honestly** and adding UX safety valves (see §7).

```
camera frame  ─►  MediaPipe Tasks Vision  ─►  hand landmarks + body pose
                                              │
                                              ▼
                            normalize (origin, scale, handedness)
                                              │
   ┌──────────────────────────────────────────┴──────────────────────────────┐
   ▼  STATIC (held handshapes, alphabet)              ▼  DYNAMIC (word signs)
   1 frame → 63 features → tiny MLP             30 frames × 161 features → TCN
                                              │
                                              ▼
                                {label, confidence}
```

## 3. MediaPipe: the landmark tracker

[MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions) is a
Google library that runs computer-vision models in the browser via WASM and
WebGL. It's how we get from "a `<video>` element" to "skeletal keypoints in
3D" without writing any of our own vision code.

Two tasks we use:

- **Hand Landmarker** — for the static letters path. Returns **21 landmarks
  per hand** (x, y, z), plus handedness (left/right). Tiny model, very fast.
- **Holistic Landmarker** — for the dynamic word-level path. Returns the
  upper-body **pose** (33 keypoints) plus **both hands** (21 each). We don't
  use the face landmarks. This is what lets the model see *where in the
  signing space* a sign happens, not just the handshape.

Two critical properties of this choice:

1. **Same library exists in Python** — same models, same landmark indices.
   We use Python MediaPipe during training so that training features look
   identical to runtime features. (See "no train/serve skew" in §5.)
2. **Privacy is automatic** — landmarks are abstract numbers. We never store
   or transmit pixel data, by construction.

## 4. The classifiers

### 4.1 Static signs — fingerspelling (letters)

The ASL alphabet is mostly single-frame: you make a handshape and hold it. So
the classifier sees one frame at a time.

- **Input:** 21 hand landmarks × (x, y, z) = **63 numbers**, normalized.
- **Model:** a small **MLP** (multi-layer perceptron) — dense → ReLU → dense →
  softmax over 24 letter classes. Trained in scikit-learn.
- **Runtime:** we **don't use** a TensorFlow.js or ONNX runtime for this. The
  model is so small that we export it as **plain JSON weights** and run a
  hand-written forward pass in the browser. That's about ~30 lines of
  TypeScript. (See ADR-011 for the reasoning — pulling in a full ML runtime
  for a 100KB model was overkill.)
- **Why not 26 letters?** **J** and **Z** are *dynamic* letters (motion-based)
  and don't fit a single-frame model. The dynamic recognizer is where motion
  letters could eventually live; today they're simply not in the static label
  set.

### 4.2 Dynamic signs — words

Word-level signs (HELLO, PLEASE, FAMILY, …) involve **motion**, **two hands**
sometimes, and **location relative to the body**. A single frame is not
enough.

- **Input:** a sliding window of **30 frames × 161 features** (~1 second).
- **The 161 features per frame:** see §5 — it's pose (33) + left hand shape
  (63) + right hand shape (63) + 2 presence flags.
- **Model:** a small **temporal convolutional network (TCN)**. Four stacked 1D
  convolutions slide over the 30 frames, each one looking twice as far apart as
  the last (dilation 1, 2, 4, 8), so the top layer sees the whole window. A
  learned attention step then weighs the most telling frames, and a small head
  produces logits over the 114 trained classes (103 are published). Trained in
  PyTorch. It replaced a bidirectional GRU with the same attention step in #66,
  after the #64 bake-off (`ml/experiments/RESULTS.md`) found it about 4 points
  more accurate on unseen signers.
- **Runtime:** the trained model is exported to **ONNX** and run in the
  browser via **`onnxruntime-web`**. ONNX is the portable model format that
  lets us train in PyTorch and run in JavaScript. The weights are stored as
  int8 (compute stays fp32), so the bundled file is about 160 KB — small
  enough to bundle and cache offline.
- **Why a TCN and not a Transformer?** For a 30-step window and a few
  thousand training clips, a small convolutional model is the right size: fast,
  easy to train, and it measured better than the GRU it replaced. A Transformer
  would be data-hungry overkill at this scale.

## 5. Normalization — the keystone

The single most load-bearing thing in this pipeline isn't the model — it's
**normalization**, the transform that turns raw landmark coordinates into the
feature vector the model sees.

Why it matters: the model learns from feature values. If the **same hand
gesture produces different feature values** depending on how far you are from
the camera, where you're standing, or which hand you used, the model will
overfit to those incidentals and fail in the wild.

So we strip the incidentals out. For the **static** (hand-only) path:

1. **Translate** so the wrist landmark is at the origin. Hand position in
   frame no longer matters.
2. **Scale** by hand size (wrist → middle-finger MCP joint distance). Hand
   distance from camera no longer matters.
3. **Mirror left hands to canonical right.** The model only ever sees one
   handedness. (Handedness is stored separately if a sign actually depends on
   it.)

For the **dynamic** path (frozen as `pose-shoulder-hands-v1` — see ADR-013,
recognition.md §5.1):

- **Pose block (33 numbers):** translate to the shoulder-midpoint origin,
  scale by shoulder width. Pose is **not mirrored** — the side of the body a
  sign occupies is meaningful.
- **Hand-shape blocks (63 + 63):** each hand uses the static normalization
  above (wrist origin, MCP-9 scale, mirror left→canonical). This isolates
  *handshape* from *location*.
- **Presence flags (2):** [`leftPresent`, `rightPresent`] — 1 or 0.
- A frame with a hand missing contributes a zero block for that hand and a 0
  presence flag.

**The train/serve skew rule.** The Python training code and the TypeScript
runtime code both implement this normalization. They MUST produce identical
output for identical input — otherwise the model is trained on one feature
distribution and run on another, and the accuracy collapses for reasons that
look like model bugs. We enforce this with a **golden-vector fixture**: a
generated set of (raw input → expected normalized output) pairs, checked into
both languages' test suites. Any divergence is a failing test.

The dynamic ONNX file is also tagged with a `metadata.json` containing the
**normalization id** (`pose-shoulder-hands-v1`). At runtime, the frontend
asserts the loaded model's normalization id matches what the code knows how to
produce — so we can't accidentally ship a model trained on a different
normalization.

## 6. Datasets

### Static (letters): the Kaggle ASL Alphabet dataset

About 500 images per letter for the 24 static letters — ~10,800 total
landmark samples after running them through MediaPipe. The held-out accuracy
on this dataset is ~99.5%. Caveat: held-out splits share the dataset's
signer(s) and lighting, so the **real-world accuracy on a user's own camera
will be lower** (domain shift). The product spec absorbs this via the "I
forgot" / "That's what I did" UX.

### Dynamic (words): WLASL (+ MS-ASL coming)

[WLASL](https://dxli94.github.io/WLASL/) — Word-Level American Sign Language
— is the standard public dataset: 2,000 glosses across ~21,000 clips and 119
signers. We sourced clips via a Kaggle mirror (the official dataset is a list
of YouTube URLs that suffers heavy link rot) and ran our own MediaPipe
extraction over them.

Today we ship **20 signs** out of a starter vocabulary of 24, selected by
measured accuracy (see §6 below). We're explicitly **not** trying to ship
WLASL2000; modern skeleton-based research baselines only manage **~30–38%
top-1** on WLASL2000, so a "recognize any word" product is research-grade
and out of scope.

**Coming in P3M2:** Microsoft's [MS-ASL](https://www.microsoft.com/en-us/research/project/ms-asl/)
dataset (~1000 signs, ~25K clips) under the C-UDA license, which permits
training and shipping the trained model freely (we never redistribute the
source videos). The ingest adapter (`ml/src/sign_ml/msasl.py`) is already
written; the download is an owner action (ADR-016).

## 7. Accuracy, honestly

### The numbers

Per-gloss top-1 accuracy on the 20 shipped signs, measured with **5-fold
cross-validation** on 193 local WLASL clips:

| | Stratified-clip CV (overstates) | Signer-disjoint CV (the honest gate) |
| --- | --- | --- |
| Top-1 | ~62% | **57.0%** |
| Top-5 | ~95% | **92.2%** |

The two columns differ by ~5 points, and the reason is *leakage*. In a
stratified-clip split, two clips of *the same signer* can land one in train
and one in test — so the model recognizes that signer, not the sign. A
**signer-disjoint** split puts whole signers on one side or the other. That's
the gate Phase 3 adopted (ADR-019) and is the number we should believe.

Even 57% / 92.2% is still an **optimistic ceiling** for real-world use
because it's measured on dataset clips (studio lighting, fluent signers), not
on a user's own camera. Closing that gap requires a real-camera holdout,
which is deferred for now (Q8, ADR-019).

### Why "the user said it but the model didn't see it" is okay

The product spec has two safety valves that turn a recognition miss from a
hard failure into a one-tap recovery:

1. **"I forgot"** reveals the sign. (The user actively says "I don't know
   this".)
2. After "I forgot", the user can press **"That's what I did"** to override
   the result to correct. (Used when the user *did* sign correctly but the
   camera missed it.)

This is the design's answer to the accuracy ceiling. The model doesn't need
to be perfect; it needs to be good enough that the override path is rare.

### Per-sign acceptance, not open-set classification

A nice property of the verification problem: we don't actually need to answer
"which of 20 signs is this?" — we only need to answer "is this the sign we
just asked for?" That's a much easier question. The runtime applies a
**per-sign confidence threshold** plus **temporal debounce** (require N
consecutive agreeing frames) to cut false positives without slowing the
correct case down.

### Vocabulary expansion is accuracy-gated

We have a hard rule: a sign joins the shipped vocabulary only if its honest
per-gloss top-1 is ≥ 0.50 on the gate split. That's why the 20-sign starter
holds back `like`, `bad`, `happy`, and `thank you` — they didn't clear the
bar (recognition.md §6.1 has the per-gloss table).

The plan is to expand toward ~50 signs in Phase 3 — gated by the same bar,
with MS-ASL providing more clips per sign so the floor moves up.

## 8. Augmentation — making the small dataset count

A small dataset overfits. The standard trick is augmentation: at train time,
slightly perturb each sample so the model sees more variety. **All our
augmentation is in landmark space** (not pixel space), because once
MediaPipe has already extracted landmarks, blurring or darkening the original
video does almost nothing to the features (ADR-020).

What we augment:

- **Noise jitter** (σ=0.01) — small random perturbations to landmark
  coordinates.
- **Random scale** (0.9–1.1) — simulates different camera distances.
- **Whole-frame dropout** (10%) — simulates dropped frames / detection
  misses.
- **Per-landmark dropout** (P3M3) — simulates per-joint detection misses.
- **In-plane rotation** (P3M3) — simulates camera roll / different head
  tilts.
- **End-anchored time warp** (P3M3) — simulates faster/slower signing while
  keeping the final frame fixed.

Effect on the honest gate: top-1 went from **0.570 → 0.601** (+3 points) on
the starter set. It's a small set, so this is a *directional* signal; final
acceptance of each augmentation primitive is tuned on the larger MS-ASL data
when that lands.

Two augmentations we deliberately **don't** do:

- **Horizontal mirror.** Our hand normalization already collapses handedness
  (left mirrored to canonical right), so a naive mirror would create
  inconsistent train/serve features. Correct mirroring requires swapping
  pose-landmark pairs *and* re-canonicalizing each hand — error-prone
  enough that we defer it until there's a clear accuracy win that justifies
  the complexity.
- **Time-shift.** Sequences are front-padded so the newest frame is always
  last; naively shifting in time would break that alignment.

## 9. The training pipeline (Python side)

Everything lives in `ml/src/sign_ml/`. The two CLIs:

### Static (letters)

```
uv run python -m sign_ml.pipeline extract   # ASL Alphabet → landmark arrays
uv run python -m sign_ml.pipeline train     # sklearn MLP
uv run python -m sign_ml.pipeline export    # → JSON weights for the frontend
uv run python -m sign_ml.pipeline eval      # held-out accuracy
```

Stages (`extract.py`, `model.py`, `export.py`, `eval.py`) are independent and
composable. The exported JSON lands in `frontend/src/recognition/models/` and
the frontend's MLP loader picks it up.

### Dynamic (words)

```
uv run python -m sign_ml.dynamic_pipeline extract   # videos → landmark arrays
uv run python -m sign_ml.dynamic_pipeline crossval --arch tcn --aug --label-smoothing 0.15
                                     # signer-disjoint k-fold (the honest gate)
uv run python -m sign_ml.dynamic_pipeline train --arch tcn --int8 --aug --label-smoothing 0.15
                                     # final model + int8 ONNX export
uv run python -m sign_ml.dynamic_pipeline calibrate --arch tcn --aug --label-smoothing 0.15
                                     # confidence temperature + per-sign bars
```

Stages:

- **`dynamic_extract.py`** — runs MediaPipe Holistic over each clip, produces
  arrays of normalized 161-d frames + signer IDs.
- **`ingest.py`** — turns raw dataset rows into `CanonicalSample`s with
  canonical labels and signer-disjoint splits. Multiple dataset adapters
  (`wlasl.py`, `msasl.py`) feed into this.
- **`dynamic_model.py`** — the TCN (and the older GRU, `--arch gru`) +
  training loop + cross-validation +
  augmentation (`augment_sequences`).
- **`dynamic_export.py`** — `torch.onnx` → ONNX file + a `metadata.json`
  (labels, normalization id, window/feature shape). The frontend refuses to
  load a model whose metadata doesn't match.
- **`reference_export.py`** — picks one representative clip per shipped sign
  and writes its landmark sequence to
  `frontend/public/reference/<gloss>.json`. The in-app sign-reference player
  plays these back (no video files, no copyright issues — see ADR-017).

### Quality gates

The Python side has its own CI lane with the same kind of gates as the
frontend:

- `ruff format --check` (formatter)
- `ruff check` (linter)
- `mypy .` (types)
- `pytest` (tests, including the golden-vector parity tests)

These all run on every PR; an ML change can't land without them green.

## 10. Honest caveats — read this part

1. **Dataset accuracy ≠ user accuracy.** Every accuracy number on this page
   was measured on dataset clips, not on real users on real webcams. The
   real-world number will be lower. The UX is designed around this; the
   numbers above are the *training-side* truth, not the *product* truth.
2. **The static model has known confusions.** S-like fist letters (A, E, M,
   N, T, O) often classify as S, because they differ mostly in thumb
   position, which a 2D webcam captures poorly. Documented; not blocking.
3. **The dynamic vocabulary is small on purpose.** 20 signs is a *deliberate*
   floor. The accuracy gate (≥0.50 per-gloss top-1) prevents shipping signs
   the model doesn't actually know. This is the explicit alternative to
   shipping a 1000-sign model that's mostly wrong.
4. **We treat the accuracy gate as the contract.** Adding a sign requires
   passing the gate. Removing a sign from the shipped list is allowed if
   regression appears. The vocabulary is whatever passes the test, not
   whatever the dataset contains.

## 11. Where to read deeper

- Decision records — `.claude/docs/decisions.md` — ADR-002 (landmark vs. video),
  ADR-011 (static JSON-weights), ADR-013 (Holistic), ADR-014 (WLASL strategy),
  ADR-015 (ONNX), ADR-016 (MS-ASL licensing), ADR-019 (signer-disjoint gate),
  ADR-020 (landmark-space augmentation).
- Spec-level recognition doc — `.claude/docs/recognition.md` — every per-gloss
  number, the full normalization spec, and links to the underlying research.
- Source — `ml/src/sign_ml/` (Python) and `frontend/src/recognition/`
  (TypeScript) — the actual code, with the test files next to each module
  doing the work.
