import type { Handedness, Landmark } from './types'
import { HAND_LANDMARK_COUNT, MIDDLE_FINGER_MCP, WRIST } from './types'

/** The single handedness the model is trained to see; Left hands are mirrored. */
export const CANONICAL_HANDEDNESS: Handedness = 'Right'

function subtract(a: Landmark, b: Landmark): Landmark {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

/**
 * Normalize a hand's 21 landmarks into a translation-, scale-, and
 * handedness-invariant representation, per `.claude/docs/recognition.md` §5:
 *
 *   1. translate so the wrist (index 0) is the origin,
 *   2. scale by the wrist→middle-finger-MCP (index 9) distance, making it
 *      size-invariant (that reference distance becomes 1),
 *   3. mirror Left hands across x so the model only ever sees one handedness.
 *
 * This MUST stay numerically equivalent to the Python implementation added in
 * M2 — the shared fixture `fixtures/normalization.golden.json` guards parity.
 */
export function normalizeHandLandmarks(
  landmarks: readonly Landmark[],
  handedness: Handedness,
): Landmark[] {
  if (landmarks.length !== HAND_LANDMARK_COUNT) {
    throw new Error(
      `Expected ${HAND_LANDMARK_COUNT} landmarks, got ${landmarks.length}`,
    )
  }
  const wrist = landmarks[WRIST]
  const ref = landmarks[MIDDLE_FINGER_MCP]
  if (!wrist || !ref) {
    throw new Error('Missing wrist or reference landmark')
  }

  const refVec = subtract(ref, wrist)
  const refDist = Math.hypot(refVec.x, refVec.y, refVec.z)
  // Degenerate (zero-size) hand: scale to 0 rather than dividing by zero.
  const scale = refDist === 0 ? 0 : 1 / refDist
  const mirror = handedness === CANONICAL_HANDEDNESS ? 1 : -1

  return landmarks.map((lm) => {
    const t = subtract(lm, wrist)
    return { x: t.x * scale * mirror, y: t.y * scale, z: t.z * scale }
  })
}

/** Flatten landmarks to a `[x0, y0, z0, x1, y1, z1, ...]` feature vector. */
export function flattenLandmarks(landmarks: readonly Landmark[]): number[] {
  const out: number[] = []
  for (const lm of landmarks) {
    out.push(lm.x, lm.y, lm.z)
  }
  return out
}
