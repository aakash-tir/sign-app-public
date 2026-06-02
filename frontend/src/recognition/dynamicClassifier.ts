import {
  DYNAMIC_NORMALIZATION_ID,
  FRAME_FEATURE_DIM,
} from './dynamicNormalization'
import { WINDOW_SIZE } from './frameWindow'

/** Sidecar shipped beside the ONNX model (see ml `dynamic_export.build_metadata`). */
export interface DynamicModelMetadata {
  format: string
  modelFile: string
  normalization: string
  window: number
  featureDim: number
  output: string
  labels: string[]
  /** Softmax temperature for honest confidence (P4M7); absent → 1 (no scaling). */
  temperature?: number
  /** Per-sign acceptance bar (P4M7); absent gloss → the global default. */
  acceptThresholds?: Record<string, number>
}

export interface DynamicPrediction {
  label: string
  confidence: number
  probs: number[]
}

/**
 * Classifies a window of normalized frames into a dynamic sign. The ONNX-backed
 * implementation lives in `onnxDynamicClassifier.ts`; tests use a stub.
 */
export interface DynamicClassifier {
  readonly labels: string[]
  /** Per-sign acceptance thresholds (P4M7); empty/absent → use the global default. */
  readonly acceptThresholds?: Record<string, number>
  classify(sequence: number[][]): Promise<DynamicPrediction>
}

/**
 * Numerically stable softmax over raw logits, with an optional **temperature** ``T``
 * (P4M7): logits are divided by ``T`` before the softmax, so ``T > 1`` softens an
 * over-confident model into honest probabilities. ``T = 1`` is the plain softmax.
 */
export function softmax(logits: readonly number[], temperature = 1): number[] {
  if (logits.length === 0) return []
  const t = temperature > 0 ? temperature : 1
  const scaled = logits.map((v) => v / t)
  const max = Math.max(...scaled)
  const exps = scaled.map((v) => Math.exp(v - max))
  const sum = exps.reduce((acc, e) => acc + e, 0)
  return exps.map((e) => e / sum)
}

/**
 * Element-wise mean of several probability vectors — multi-window temporal voting
 * (P4M7): averaging the last few inference windows steadies a borderline sign versus
 * deciding on a single noisy window. All vectors must share length; empty → ``[]``.
 */
export function averageProbs(
  buffers: readonly (readonly number[])[],
): number[] {
  if (buffers.length === 0) return []
  const width = buffers[0]!.length
  const acc = new Array<number>(width).fill(0)
  for (const b of buffers) {
    for (let i = 0; i < width; i++) acc[i]! += b[i] ?? 0
  }
  return acc.map((v) => v / buffers.length)
}

/** The acceptance bar for `target`: its per-sign threshold, or `fallback` if none. */
export function acceptThresholdFor(
  thresholds: Record<string, number> | undefined,
  target: string,
  fallback: number,
): number {
  return thresholds?.[target] ?? fallback
}

/** Argmax → the most likely label and its probability. */
export function topPrediction(
  probs: readonly number[],
  labels: readonly string[],
): { index: number; label: string; confidence: number } {
  let best = 0
  for (let i = 1; i < probs.length; i++) {
    if (probs[i]! > probs[best]!) best = i
  }
  return {
    index: best,
    label: labels[best] ?? String(best),
    confidence: probs[best] ?? 0,
  }
}

/**
 * Per-sign acceptance (verification, not open-set classification): did the user
 * perform the *prompted* gloss with at least `threshold` probability? Easier and
 * safer than requiring it to be the global argmax (see recognition.md §6.4).
 */
export function accepts(
  probs: readonly number[],
  labels: readonly string[],
  target: string,
  threshold: number,
): boolean {
  const index = labels.indexOf(target)
  if (index < 0) return false
  return (probs[index] ?? 0) >= threshold
}

/**
 * Skew guard: a loaded model must match the frozen normalization contract this
 * build produces, or its features are meaningless. Mirrors the static MLP's
 * `normalization` assertion (ADR-011/ADR-015).
 */
export function assertMetadataCompatible(metadata: DynamicModelMetadata): void {
  if (metadata.normalization !== DYNAMIC_NORMALIZATION_ID) {
    throw new Error(
      `Model normalization '${metadata.normalization}' != '${DYNAMIC_NORMALIZATION_ID}'`,
    )
  }
  if (metadata.window !== WINDOW_SIZE) {
    throw new Error(`Model window ${metadata.window} != ${WINDOW_SIZE}`)
  }
  if (metadata.featureDim !== FRAME_FEATURE_DIM) {
    throw new Error(
      `Model featureDim ${metadata.featureDim} != ${FRAME_FEATURE_DIM}`,
    )
  }
  if (metadata.labels.length === 0) {
    throw new Error('Model metadata has no labels')
  }
}
