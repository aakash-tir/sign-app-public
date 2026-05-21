import type { Landmark } from './types'
import { HAND_LANDMARK_COUNT } from './types'
import { flattenLandmarks, normalizeHandLandmarks } from './normalization'
import {
  LEFT_SHOULDER,
  POSE_LANDMARK_COUNT,
  RIGHT_SHOULDER,
  UPPER_BODY_POSE_INDICES,
} from './dynamicTypes'
import type { HolisticObservation } from './dynamicTypes'

/**
 * Identifier of this dynamic normalization scheme; an exported sequence model
 * carries the same id so the runtime can assert no train/serve skew (mirrors
 * `NORMALIZATION_ID` for the static path).
 */
export const DYNAMIC_NORMALIZATION_ID = 'pose-shoulder-hands-v1'

/** Feature-block lengths that make up one frame's flattened feature vector. */
export const POSE_BLOCK_LEN = UPPER_BODY_POSE_INDICES.length * 3 // 33
export const HAND_BLOCK_LEN = HAND_LANDMARK_COUNT * 3 // 63
/** pose (33) + left hand (63) + right hand (63) + [leftPresent, rightPresent]. */
export const FRAME_FEATURE_DIM = POSE_BLOCK_LEN + 2 * HAND_BLOCK_LEN + 2 // 161

/**
 * Normalize the upper-body pose into a translation- and scale-invariant frame,
 * per `.claude/docs/recognition.md` §5:
 *
 *   1. translate so the **shoulder midpoint** ((L+R)/2 of indices 11, 12) is the
 *      origin,
 *   2. scale by the **shoulder width** (‖L − R‖) so body size drops out,
 *   3. keep only {@link UPPER_BODY_POSE_INDICES}, in that order.
 *
 * Unlike hands, pose is **not** mirrored — the side a sign occupies carries
 * meaning. Must stay numerically equivalent to the Python mirror; the shared
 * fixture `fixtures/dynamic-normalization.golden.json` guards parity.
 */
export function normalizePose(pose: readonly Landmark[]): Landmark[] {
  if (pose.length !== POSE_LANDMARK_COUNT) {
    throw new Error(
      `Expected ${POSE_LANDMARK_COUNT} pose landmarks, got ${pose.length}`,
    )
  }
  const left = pose[LEFT_SHOULDER]
  const right = pose[RIGHT_SHOULDER]
  if (!left || !right) {
    throw new Error('Missing shoulder landmark')
  }

  const mid = {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
    z: (left.z + right.z) / 2,
  }
  const width = Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z)
  // Degenerate (coincident shoulders): scale to 0 rather than dividing by zero.
  const scale = width === 0 ? 0 : 1 / width

  return UPPER_BODY_POSE_INDICES.map((idx) => {
    const p = pose[idx]
    if (!p) {
      throw new Error(`Missing pose landmark ${idx}`)
    }
    return {
      x: (p.x - mid.x) * scale,
      y: (p.y - mid.y) * scale,
      z: (p.z - mid.z) * scale,
    }
  })
}

function zeros(n: number): number[] {
  return new Array<number>(n).fill(0)
}

/**
 * Flatten one holistic frame into the fixed-length {@link FRAME_FEATURE_DIM}
 * feature vector:
 *
 *   [ pose block (33) | left-hand shape (63) | right-hand shape (63) |
 *     leftPresent, rightPresent ]
 *
 * Hand shape reuses the static {@link normalizeHandLandmarks} (location-invariant
 * handshape); pose supplies coarse hand **location** via the wrist/elbow points.
 * Absent pose/hands contribute a zero block, and presence flags tell the model
 * which hands were seen.
 */
export function normalizeFrame(obs: HolisticObservation): number[] {
  const poseBlock = obs.pose
    ? flattenLandmarks(normalizePose(obs.pose))
    : zeros(POSE_BLOCK_LEN)
  const leftBlock = obs.leftHand
    ? flattenLandmarks(normalizeHandLandmarks(obs.leftHand, 'Left'))
    : zeros(HAND_BLOCK_LEN)
  const rightBlock = obs.rightHand
    ? flattenLandmarks(normalizeHandLandmarks(obs.rightHand, 'Right'))
    : zeros(HAND_BLOCK_LEN)
  const presence = [obs.leftHand ? 1 : 0, obs.rightHand ? 1 : 0]

  return [...poseBlock, ...leftBlock, ...rightBlock, ...presence]
}
