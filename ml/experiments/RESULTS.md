# Classifier bake-off: results (issue #64)

**Bottom line:** one candidate beats the shipped baseline. The **1D temporal-conv (TCN)**
gets **0.741** honest top-1 against the baseline's **0.698** (+4.3 points). It wins on
all 15 paired (seed, fold) runs, and the 95% interval is [+2.8, +5.8]. It's also smaller
and trains faster. The hand-shape features are **no better** than the baseline (within
noise). Weight-only **int8** shrinks any model about 4× with no accuracy loss.
**No shipped model was changed.** Whether to ship the TCN is the owner's call, and would
be a separate issue.

Raw numbers: [`results.json`](results.json), built by `bakeoff/aggregate.py`.
The per-fold weights, ONNX files and held-out logits stay in `runs/` (git-ignored).

## Setup

- **Dynamic signs:** 114 classes, 4,680 clips from 180 signers, 30×161 landmark
  windows, from the shipped training cache `ml/models/combined/` (SHA-256 checked on
  load). There are **5 signer-disjoint folds** of 936 clips each, made by the shipped
  `signer_folds(signers, 5, seed=42)` and frozen in `folds/dynamic_folds.{npz,json}` and reused by every run. Each
  candidate trains with **3 seeds (42, 43, 44)** on the same folds, giving 15 runs per
  candidate.
- **Recipe:** the shipped one for every candidate, with nothing tuned on the test folds:
  `--aug`, label smoothing 0.15, 150 epochs max with early stopping on a validation split
  carved out of the *training* pool, and Adam at the shipped learning rate and batch size.
- **Letters:** 24 static letters, 10,811 images, 5 stratified folds
  (`folds/letter_folds.*`), the shipped `train_mlp` config, 3 seeds.
- **Decision rule, pre-registered in `aggregate.py` before any candidate result
  existed:** a candidate *beats* the baseline only if the mean paired top-1 gain is above
  +0.01 **and** its 95% t-interval excludes 0. Every figure is a mean over all folds and
  seeds. None is a best fold.
- **Harness fidelity:** seed 42 of the baseline gives pooled top-1 0.695, against the
  recorded shipped CV of 0.691. The harness reproduces the shipped number.

## Dynamic signs (signer-disjoint, 15 runs each)

| Candidate | Top-1 | Top-5 | Macro-F1 | Fold std (top-1) | Seed std (top-1) | Params | fp32 ONNX | Browser ms (p50 / p95) |
|---|---|---|---|---|---|---|---|---|
| Baseline: BiGRU + attention (shipped recipe) | 0.698 | 0.877 | 0.665 | 0.041 | 0.003 | 177 k | 698 KB | 0.5 / 0.7 |
| **A: TCN** | **0.741** | **0.902** | **0.711** | 0.026 | 0.005 | 141 k | 560 KB | 0.6 / 1.0 |
| B: Baseline + hand-shape features | 0.703 | 0.883 | 0.674 | 0.036 | 0.007 | 200 k | 788 KB | 0.8 / 1.3 |

**Paired against the baseline** (same seed and fold, n = 15):

| Candidate | Δ top-1 [95% CI] | Δ top-5 [95% CI] | Δ macro-F1 [95% CI] | Runs won | Verdict |
|---|---|---|---|---|---|
| A: TCN | **+0.043** [+0.028, +0.058] | +0.025 [+0.019, +0.032] | +0.045 [+0.028, +0.063] | 15 / 15 | **beats baseline** |
| B: hand-shape | +0.006 [−0.010, +0.021] | +0.006 [+0.001, +0.011] | +0.008 [−0.009, +0.026] | 8 / 15 | no better (within noise) |

## C: quantisation (every fold model, scored on its own held-out fold)

There's no retraining here: each variant uses the exact fp32 fold weights, so any change
comes from the quantisation alone. "Agree" is top-1 agreement with fp32.

| Model | Variant | Size | Top-1 | Macro-F1 | Agree | Browser ms (p50 / p95) |
|---|---|---|---|---|---|---|
| Baseline | fp32 | 698 KB | 0.698 | 0.665 | 1 | 0.5 / 0.7 |
| Baseline | fp16 weights | 352 KB | 0.698 | 0.665 | 0.9998 | 0.4 / 0.7 |
| Baseline | int8 weights | 184 KB | 0.698 | 0.666 | 0.993 | 0.7 / 1.1 |
| Baseline | int8 dynamic (ORT) | 658 KB | 0.698 | 0.666 | 0.997 | 0.7 / 1.1 |
| **TCN** | fp32 | 560 KB | 0.741 | 0.711 | 1 | 0.6 / 1.0 |
| **TCN** | fp16 weights | 286 KB | 0.741 | 0.711 | 0.9998 | 0.6 / 0.9 |
| **TCN** | **int8 weights** | **156 KB** | **0.741** | **0.711** | 0.993 | **0.6 / 0.9** |
| **TCN** | int8 dynamic (ORT) | 164 KB | 0.739 | 0.708 | 0.971 | 2.3 / 3.1 |
| Hand-shape | fp32 | 788 KB | 0.703 | 0.674 | 1 | 0.8 / 1.3 |
| Hand-shape | int8 weights | 206 KB | 0.703 | 0.673 | 0.992 | 1.1 / 1.7 |

**Best on-device option: the TCN with int8 weights.** It's 156 KB (the shipped model is
698 KB), it keeps the full fp32 accuracy, and it runs in under 1 ms. ORT's dynamic int8 is
the wrong choice for the TCN: it's about 4× slower in WASM and agrees with fp32 less often.
For the GRU models it barely shrinks the file, because the GRU weights aren't quantised.

## Letters (static fingerspelling MLP)

| Model | Top-1 | Top-5 | Macro-F1 | Fold std | Size | Browser ms (p50 / p95) |
|---|---|---|---|---|---|---|
| Shipped MLP config, (32,) ReLU | 0.992 | 0.999 | 0.991 | 0.001 | 88 KB JSON | 0.008 / 0.013 |

**Caveat:** the ASL Alphabet set has no signer ids. It's essentially one signer in one
setup, so these folds split *images*, not people. 0.99 is an upper bound on real-camera
accuracy, and it can't be compared with the dynamic signer-disjoint figures. No letter
candidates were trained, because there's no headroom to measure on this set.

## Top-10 confused pairs

The count is the number of clips per seed, averaged over 3 seeds, in either direction.
The number in brackets is the total clips of the two signs.

| # | Baseline | TCN (best) |
|---|---|---|
| 1 | nice ↔ school 26.7 (119) | nice ↔ school 20.3 (119) |
| 2 | good ↔ thank you 22.0 (91) | good ↔ thank you 18.7 (91) |
| 3 | doctor ↔ nurse 17.7 (90) | want ↔ what 14.7 (110) |
| 4 | pencil ↔ write 14.3 (68) | doctor ↔ nurse 14.3 (90) |
| 5 | want ↔ what 11.3 (110) | pencil ↔ write 13.7 (68) |
| 6 | like ↔ white 11.0 (114) | hurt ↔ sign 10.7 (87) |
| 7 | man ↔ woman 9.3 (96) | brother ↔ sister 9.7 (110) |
| 8 | brother ↔ sister 9.0 (110) | fine ↔ woman 9.7 (87) |
| 9 | fine ↔ woman 8.7 (87) | beautiful ↔ sleep 9.0 (72) |
| 10 | girl ↔ orange 8.3 (106) | happy ↔ please 9.0 (103) |

Letters (seed 42, all folds): M↔N 7, E↔I 5, U↔V 5, F↔O 4, then pairs of 3 or fewer.

The same near-minimal pairs lead for both models: *nice/school* and *good/thank you*
share a hand shape and differ in location or contact. The TCN reduces them but doesn't
remove them.

## Browser latency method

`bench/bench.mjs` runs headless Chromium 148 with onnxruntime-web 1.26 on single-threaded
WASM at batch 1, the app's own settings. It times the classifier only (MediaPipe isn't
included) over 500 predictions on real held-out windows. The letters row uses the app's
actual `mlpClassifier.ts`, bundled. The JS port of the hand-shape features matches Python
to 7.7e-7.

- The shipped model's 520 ms load time includes the one-off WASM start-up, so it isn't
  comparable with the other rows' load times.
- An earlier run of the same benchmark measured the shipped model at 1.3 ms p50. That run
  overlapped CPU training, so it was taken under load. The table uses the later run, made
  on an idle machine.

## What this means

1. **Shipping the TCN (int8 weights) is the one change the numbers support.** It's
   +4.3 top-1 points and +4.5 macro-F1, at a quarter of today's download size and with no
   latency cost. It needs its own issue: an export path in `sign_ml`, a runtime check that
   the ONNX graph runs in the app, an update to recognition.md under the ADR-007/019 gate,
   and on-camera checks.
2. **Drop the hand-shape features.** They add 13% more parameters for no measurable gain.
3. This bake-off didn't compute per-sign accuracy, so it doesn't say how many signs the
   TCN would move past the per-sign gate. That's the first thing the shipping issue
   should measure.

## Reproduce

```bash
# from a checkout that has ml/models/combined (set BAKEOFF_DATA_ROOT when running in a worktree)
uv run --project ml python ml/experiments/bakeoff/make_folds.py
bash ml/experiments/bakeoff/run_all.sh       # 9 dynamic runs + letters, about 5 h on CPU
uv run --project ml --extra train --with onnxruntime --with onnxconverter-common \
    python ml/experiments/bakeoff/quantize.py --candidate tcn   # likewise baseline, handshape
uv run --project ml --extra train python ml/experiments/bakeoff/make_bench_manifest.py
cd frontend && node ../ml/experiments/bench/bench.mjs ../ml/experiments/runs/bench/manifest.json
uv run --project ml --extra train python ml/experiments/bakeoff/aggregate.py
```

The runs used the CPU-only PyTorch build. The machine has a GPU, but no CUDA build is
installed.
