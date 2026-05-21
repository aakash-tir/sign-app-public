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
  classify(sequence: number[][]): Promise<DynamicPrediction>
}

/** Numerically stable softmax over raw logits. */
export function softmax(logits: readonly number[]): number[] {
  if (logits.length === 0) return []
  const max = Math.max(...logits)
  const exps = logits.map((v) => Math.exp(v - max))
  const sum = exps.reduce((acc, e) => acc + e, 0)
  return exps.map((e) => e / sum)
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
