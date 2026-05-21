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

/** Create a holistic (pose + both hands) detector backed by MediaPipe Tasks Vision. */
export async function createMediaPipeHolisticDetector(): Promise<HolisticDetector> {
  // Dynamic import: code-splits MediaPipe out of the main bundle (lazy-loaded
  // only when the camera turns on).
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
    close() {
      landmarker.close()
    },
  }
}
