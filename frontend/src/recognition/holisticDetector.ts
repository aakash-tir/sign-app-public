import type { Landmark } from './types'
import type { HolisticDetector, HolisticObservation } from './dynamicTypes'

// NOTE: WASM + model load from CDN at runtime for now; bundling + service-worker
// caching for offline use is handled in M6.3/M7 (see .claude/docs/architecture.md §7).
const TASKS_VISION_VERSION = '0.10.35'
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task'

/** Just the result fields we read — keeps the mapper testable without MediaPipe. */
interface HolisticResultLike {
  poseLandmarks: Landmark[][]
  leftHandLandmarks: Landmark[][]
  rightHandLandmarks: Landmark[][]
}

function firstOrNull(groups: Landmark[][]): Landmark[] | null {
  const first = groups[0]
  return first && first.length > 0
    ? first.map((l) => ({ x: l.x, y: l.y, z: l.z }))
    : null
}

/** Map a HolisticLandmarker result to our framework-agnostic observation. */
export function toHolisticObservation(
  result: HolisticResultLike,
): HolisticObservation {
  return {
    pose: firstOrNull(result.poseLandmarks),
    leftHand: firstOrNull(result.leftHandLandmarks),
    rightHand: firstOrNull(result.rightHandLandmarks),
  }
}

// Cached app-wide singleton: initializing MediaPipe (WASM + .task model) is heavy,
// and only one view uses the detector at a time, so we build it once and reuse it
// across view switches (ADR-018 keeps the camera on, so this would otherwise
// re-initialize on every tab change). Timestamps stay monotonic via performance.now.
let cached: Promise<HolisticDetector> | null = null

/** Create (or reuse) a holistic (pose + both hands) detector backed by MediaPipe. */
export function createMediaPipeHolisticDetector(): Promise<HolisticDetector> {
  if (cached) return cached
  const pending = (async (): Promise<HolisticDetector> => {
    // Dynamic import: code-splits MediaPipe out of the main bundle.
    const { FilesetResolver, HolisticLandmarker } =
      await import('@mediapipe/tasks-vision')
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
    const landmarker = await HolisticLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
    })
    return {
      detect(video, timestampMs) {
        return toHolisticObservation(
          landmarker.detectForVideo(video, timestampMs),
        )
      },
      // No-op: the singleton lives for the app's lifetime and is reused; closing
      // it would break the next view that reuses it.
      close() {},
    }
  })()
  cached = pending
  // Allow a retry if initialization failed (e.g. transient network on the CDN).
  pending.catch(() => {
    if (cached === pending) cached = null
  })
  return pending
}
