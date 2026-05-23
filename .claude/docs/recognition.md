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
