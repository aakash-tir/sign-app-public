import type { Landmark } from './types'
import type { HolisticObservation } from './dynamicTypes'

interface RawFrame {
  pose: number[][] | null
  leftHand: number[][] | null
  rightHand: number[][] | null
}

interface ReferenceClip {
  gloss: string
  frames: RawFrame[]
}

function toLandmarks(points: number[][] | null): Landmark[] | null {
  if (!points) return null
  return points.map((p) => ({ x: p[0] ?? 0, y: p[1] ?? 0, z: 0 }))
}

function toObservation(frame: RawFrame): HolisticObservation {
  return {
    pose: toLandmarks(frame.pose),
    leftHand: toLandmarks(frame.leftHand),
    rightHand: toLandmarks(frame.rightHand),
  }
}

/**
 * Load a gloss's bundled reference clip (`/reference/<gloss>.json`) and map it to
 * drawable holistic observations. The clips are generated from landmarks by
 * `ml/.../reference_export.py` (P2M4, ADR-017) and precached for offline use.
 */
export async function loadSignReference(
  gloss: string,
): Promise<HolisticObservation[]> {
  const res = await fetch(`/reference/${encodeURIComponent(gloss)}.json`)
  if (!res.ok) throw new Error(`No reference for ${gloss}`)
  const clip = (await res.json()) as ReferenceClip
  return clip.frames.map(toObservation)
}
