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

Start with **WLASL100** (100 most common glosses) for the dynamic vocabulary —
best accuracy/effort trade-off — and expand to WLASL300/2000 only as accuracy
allows.

**Status (static fingerspelling):** trained on the **ASL Alphabet** dataset
(24 static letters, ~500 images/letter → ~10.8k landmark samples) at **~99.5%**
accuracy on a held-out split. Caveat: that split shares the dataset's signer and
recording conditions, so real-world accuracy on a user's own camera/hand will be
lower (domain shift). Broadening signer/condition diversity (more data, or
augmentation) is a later improvement.

## 5. Normalization spec (shared TS ↔ Python)

To avoid train/serve skew, both the Python trainer and the TS runtime must apply
the **identical** transform. Spec (to be frozen and unit-tested both sides in M2):

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

## 7. Python training pipeline (build-time only)

Lives in `ml/` (see [`architecture.md`](architecture.md) §3). Stages:

1. **extract/** — run MediaPipe over dataset videos/images → cached landmark
   arrays (+ the shared normalization).
2. **train/** — train static MLP and/or dynamic GRU/LSTM; track metrics.
3. **export/** — export the trained model. *Static MVP:* plain JSON weights
   (`format: "mlp-1"`) → `frontend/src/recognition/models/` (ADR-011). *Dynamic
   (M6):* TF.js / onnxruntime-web.
4. **eval/** — report top-1/top-5 per vocabulary subset; gate vocabulary
   expansion on measured accuracy.

Quality gates on this code: **`ruff format` + `ruff check`**, **`mypy .`**,
**`pytest`** (per the plan's literal requirement, now scoped to the Python side).

## 8. Runtime inference (frontend)

- *Static MVP:* a small hand-written MLP forward pass over the bundled JSON model
  (no ML runtime; ADR-011). *Dynamic (M6):* load with TF.js / onnxruntime-web and
  cache via the service worker.
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
