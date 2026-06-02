import {
  assertMetadataCompatible,
  softmax,
  topPrediction,
} from './dynamicClassifier'
import type {
  DynamicClassifier,
  DynamicModelMetadata,
} from './dynamicClassifier'
import { FRAME_FEATURE_DIM } from './dynamicNormalization'
import { WINDOW_SIZE } from './frameWindow'

type Ort = typeof import('onnxruntime-web')

const DEFAULT_BASE = '/models/dynamic'
// onnxruntime-web's WASM is fetched from this CDN and runtime-cached by the
// service worker for offline use (see vite.config workbox runtimeCaching).
const ORT_VERSION = '1.26.0'
const INPUT_NAME = 'sequence'
const OUTPUT_NAME = 'logits'

let runtimeConfigured = false
function configureRuntime(ort: Ort): void {
  if (runtimeConfigured) return
  ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`
  ort.env.wasm.numThreads = 1 // no SharedArrayBuffer / cross-origin isolation needed
  runtimeConfigured = true
}

// Cached app-wide singleton for the default model: building the ONNX session
// (metadata + WASM + InferenceSession) is heavy, and ADR-018 keeps the camera on,
// so views would otherwise reload it on every tab switch. The session is stateless
// (classify only), so reuse is safe.
let cached: Promise<DynamicClassifier> | null = null

/** Load (or reuse) the exported ONNX dynamic-sign model as a DynamicClassifier. */
export function createOnnxDynamicClassifier(
  base: string = DEFAULT_BASE,
): Promise<DynamicClassifier> {
  if (base === DEFAULT_BASE && cached) return cached
  const pending = loadOnnxDynamicClassifier(base)
  if (base === DEFAULT_BASE) {
    cached = pending
    pending.catch(() => {
      if (cached === pending) cached = null
    })
  }
  return pending
}

async function loadOnnxDynamicClassifier(
  base: string,
): Promise<DynamicClassifier> {
  // Dynamic import: code-splits onnxruntime-web out of the main bundle.
  const ort = await import('onnxruntime-web')
  configureRuntime(ort)
  const metadata = (await (
    await fetch(`${base}/metadata.json`)
  ).json()) as DynamicModelMetadata
  assertMetadataCompatible(metadata)
  const session = await ort.InferenceSession.create(
    `${base}/${metadata.modelFile}`,
  )
  const labels = metadata.labels
  const temperature = metadata.temperature ?? 1 // P4M7 confidence calibration

  return {
    labels,
    acceptThresholds: metadata.acceptThresholds,
    async classify(sequence) {
      const input = new ort.Tensor(
        'float32',
        Float32Array.from(sequence.flat()),
        [1, WINDOW_SIZE, FRAME_FEATURE_DIM],
      )
      const outputs = await session.run({ [INPUT_NAME]: input })
      const logits = Array.from(outputs[OUTPUT_NAME]!.data as Float32Array)
      const probs = softmax(logits, temperature)
      const top = topPrediction(probs, labels)
      return { label: top.label, confidence: top.confidence, probs }
    },
  }
}
