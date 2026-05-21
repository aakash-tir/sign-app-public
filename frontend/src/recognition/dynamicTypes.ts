import type { Landmark } from './types'

/**
 * MediaPipe BlazePose topology has 33 pose landmarks. We use a fixed upper-body
 * subset for dynamic-sign features (head anchors for face-referenced signs + the
 * arm kinematic chain). See `.claude/docs/recognition.md` §5.
 */
export const POSE_LANDMARK_COUNT = 33
export const LEFT_SHOULDER = 11
export const RIGHT_SHOULDER = 12

/**
 * Upper-body pose landmarks kept in the feature vector, in this exact order
 * (must match the Python mirror): nose, eyes, ears, shoulders, elbows, wrists.
 * Head points let face-referenced signs (forehead/chin/cheek) be located relative
 * to the body; the arm chain captures where/how the hands move.
 */
export const UPPER_BODY_POSE_INDICES: readonly number[] = [
  0, // nose
  2, // left eye
  5, // right eye
  7, // left ear
  8, // right ear
  11, // left shoulder
  12, // right shoulder
  13, // left elbow
  14, // right elbow
  15, // left wrist
  16, // right wrist
]

/** Pose connections (within UPPER_BODY_POSE_INDICES space) for future overlay use. */
export const POSE_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [5, 6], // shoulder line
  [5, 7], // L shoulder→elbow
  [7, 9], // L elbow→wrist
  [6, 8], // R shoulder→elbow
  [8, 10], // R elbow→wrist
]

/**
 * One frame of holistic landmarks. Any of the three may be absent in a given
 * frame (no pose lock, hand out of view); absence is represented as `null` and
 * handled by the normalizer (zero-filled block + a presence flag).
 */
export interface HolisticObservation {
  pose: Landmark[] | null
  leftHand: Landmark[] | null
  rightHand: Landmark[] | null
}

/**
 * Source of holistic (pose + both hands) landmarks for a video frame, analogous
 * to {@link LandmarkDetector} for static hands. MediaPipe is one implementation;
 * tests supply a stub. Keeps MediaPipe types out of the rest of the app.
 */
export interface HolisticDetector {
  detect(video: HTMLVideoElement, timestampMs: number): HolisticObservation
  close(): void
}
