import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import type { Handedness, HandObservation, LandmarkDetector } from './types'

// NOTE: WASM + model are loaded from CDN at runtime for now. Bundling and
// service-worker caching them for full offline use is handled in a later
// milestone (see .claude/docs/architecture.md §7).
const TASKS_VISION_VERSION = '0.10.35'
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

function toHandedness(label: string): Handedness {
  return label === 'Left' ? 'Left' : 'Right'
}

function toObservations(result: HandLandmarkerResult): HandObservation[] {
  const out: HandObservation[] = []
  for (let i = 0; i < result.landmarks.length; i++) {
    const landmarks = result.landmarks[i]
    const category = result.handedness[i]?.[0]
    if (!landmarks || !category) continue
    out.push({
      landmarks: landmarks.map((l) => ({ x: l.x, y: l.y, z: l.z })),
      handedness: toHandedness(category.categoryName),
      score: category.score,
    })
  }
  return out
}

/** Create a hand-landmark detector backed by MediaPipe Tasks Vision. */
export async function createMediaPipeHandDetector(): Promise<LandmarkDetector> {
  // Dynamic import: code-splits MediaPipe out of the main bundle (lazy-loaded
  // only when the camera turns on).
  const { FilesetResolver, HandLandmarker } =
    await import('@mediapipe/tasks-vision')
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
  const landmarker = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numHands: 2,
  })

  return {
    detect(video, timestampMs) {
      return toObservations(landmarker.detectForVideo(video, timestampMs))
    },
    close() {
      landmarker.close()
    },
  }
}
