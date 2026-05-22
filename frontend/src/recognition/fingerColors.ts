import type { Landmark } from './types'

/**
 * Per-finger overlay coloring for the hand skeleton (FR-14, P2M1).
 *
 * Pure mapping only — no canvas/DOM here so it stays trivially unit-testable.
 * The draw functions (`drawLandmarks.ts`, `drawHolistic.ts`) consume this to
 * paint each finger in its own color, which makes similar handshapes easier for
 * the learner to read. It is a **visualization aid only**: the classifier works
 * from normalized coordinates and never sees the overlay, so colors do not affect
 * recognition.
 */
export type FingerGroup =
  | 'thumb'
  | 'index'
  | 'middle'
  | 'ring'
  | 'pinky'
  | 'palm'

// MediaPipe 21-point hand topology → finger group, by landmark index.
// Index 0 is the wrist; each finger owns its 4 points (base knuckle → tip).
const FINGER_BY_LANDMARK: readonly FingerGroup[] = [
  'palm', // 0  wrist
  'thumb', // 1
  'thumb', // 2
  'thumb', // 3
  'thumb', // 4  thumb tip
  'index', // 5
  'index', // 6
  'index', // 7
  'index', // 8  index tip
  'middle', // 9
  'middle', // 10
  'middle', // 11
  'middle', // 12 middle tip
  'ring', // 13
  'ring', // 14
  'ring', // 15
  'ring', // 16 ring tip
  'pinky', // 17
  'pinky', // 18
  'pinky', // 19
  'pinky', // 20 pinky tip
]

/**
 * Colorblind-safe palette (Okabe–Ito). Each finger gets one color used for both
 * its dots and its bones; the palm/wrist and the inter-knuckle bridges use a
 * neutral gray so the fingers stand out against it.
 */
export const FINGER_COLORS: Record<FingerGroup, string> = {
  thumb: '#d55e00', // vermillion
  index: '#56b4e9', // sky blue
  middle: '#009e73', // bluish green
  ring: '#f0e442', // yellow
  pinky: '#cc79a7', // reddish purple
  palm: '#9ca3af', // neutral gray (wrist + palm fan)
}

/** Finger group a hand landmark belongs to (out-of-range → `palm`). */
export function fingerOfLandmark(index: number): FingerGroup {
  return FINGER_BY_LANDMARK[index] ?? 'palm'
}

/**
 * Finger group a bone belongs to. A bone is a finger's own digit segment only
 * when **both** endpoints belong to that finger; everything else (wrist spokes,
 * the knuckle-to-knuckle bridges) is part of the `palm` fan.
 */
export function fingerOfConnection(
  connection: readonly [number, number],
): FingerGroup {
  const a = fingerOfLandmark(connection[0])
  const b = fingerOfLandmark(connection[1])
  return a !== 'palm' && a === b ? a : 'palm'
}

/**
 * Whether a normalized landmark sits inside the visible frame ([0,1] in x and y).
 * BlazePose extrapolates occluded/off-screen joints beyond these bounds; skipping
 * out-of-frame endpoints removes the long stray skeleton lines that otherwise
 * shoot to the canvas corners.
 */
export function isInFrame(point: Landmark): boolean {
  return point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1
}
