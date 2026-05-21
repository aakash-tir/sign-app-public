/** A single 3D hand landmark in normalized image coordinates (x, y in [0,1]). */
export interface Landmark {
  x: number
  y: number
  z: number
}

/** Handedness label as reported by the detector (image point of view). */
export type Handedness = 'Left' | 'Right'

/** One detected hand: its 21 landmarks plus handedness and confidence. */
export interface HandObservation {
  landmarks: Landmark[]
  handedness: Handedness
  score: number
}

/** MediaPipe hand topology constants. */
export const HAND_LANDMARK_COUNT = 21
export const WRIST = 0
export const MIDDLE_FINGER_MCP = 9

/** Bone connections between landmark indices, used to draw the skeleton. */
export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  // Thumb
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  // Index
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  // Middle
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  // Ring
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  // Pinky
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  // Palm
  [0, 17],
]

/**
 * Source of hand landmarks for a video frame. MediaPipe is one implementation;
 * tests can supply a stub. Kept tiny so the rest of the app never depends on
 * MediaPipe types directly.
 */
export interface LandmarkDetector {
  detect(video: HTMLVideoElement, timestampMs: number): HandObservation[]
  close(): void
}
