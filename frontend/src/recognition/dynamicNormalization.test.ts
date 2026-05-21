import { describe, it, expect } from 'vitest'
import {
  DYNAMIC_NORMALIZATION_ID,
  FRAME_FEATURE_DIM,
  HAND_BLOCK_LEN,
  POSE_BLOCK_LEN,
  normalizeFrame,
  normalizePose,
} from './dynamicNormalization'
import { POSE_LANDMARK_COUNT, UPPER_BODY_POSE_INDICES } from './dynamicTypes'
import type { HolisticObservation } from './dynamicTypes'
import { HAND_LANDMARK_COUNT, MIDDLE_FINGER_MCP, WRIST } from './types'
import type { Landmark } from './types'
import goldenFixture from './fixtures/dynamic-normalization.golden.json'

// Positions of the two shoulders within UPPER_BODY_POSE_INDICES (11 and 12).
const L_SHOULDER_POS = UPPER_BODY_POSE_INDICES.indexOf(11)
const R_SHOULDER_POS = UPPER_BODY_POSE_INDICES.indexOf(12)

function samplePose(): Landmark[] {
  const pose = Array.from({ length: POSE_LANDMARK_COUNT }, (_, i) => ({
    x: 0.5 + 0.005 * i,
    y: 0.4 + 0.006 * i,
    z: 0.002 * i,
  }))
  pose[11] = { x: 0.6, y: 0.5, z: 0 } // left shoulder
  pose[12] = { x: 0.4, y: 0.5, z: 0 } // right shoulder
  return pose
}

function sampleHand(): Landmark[] {
  const hand = Array.from({ length: HAND_LANDMARK_COUNT }, (_, i) => ({
    x: 0.5 + 0.02 * i,
    y: 0.5 + 0.03 * i,
    z: 0.01 * i,
  }))
  hand[WRIST] = { x: 0.5, y: 0.5, z: 0 }
  hand[MIDDLE_FINGER_MCP] = { x: 0.8, y: 0.9, z: 0 }
  return hand
}

describe('normalizePose', () => {
  it('returns one point per kept upper-body index', () => {
    expect(normalizePose(samplePose())).toHaveLength(
      UPPER_BODY_POSE_INDICES.length,
    )
  })

  it('maps the shoulder midpoint to the origin', () => {
    const out = normalizePose(samplePose())
    const l = out[L_SHOULDER_POS]!
    const r = out[R_SHOULDER_POS]!
    expect((l.x + r.x) / 2).toBeCloseTo(0, 10)
    expect((l.y + r.y) / 2).toBeCloseTo(0, 10)
    expect((l.z + r.z) / 2).toBeCloseTo(0, 10)
  })

  it('scales so the shoulder width becomes 1', () => {
    const out = normalizePose(samplePose())
    const l = out[L_SHOULDER_POS]!
    const r = out[R_SHOULDER_POS]!
    expect(Math.hypot(l.x - r.x, l.y - r.y, l.z - r.z)).toBeCloseTo(1, 10)
  })

  it('is translation-invariant', () => {
    const base = samplePose()
    const shifted = base.map((p) => ({ x: p.x + 3, y: p.y - 2, z: p.z + 1 }))
    const a = normalizePose(base)
    const b = normalizePose(shifted)
    a.forEach((p, i) => {
      expect(b[i]!.x).toBeCloseTo(p.x, 10)
      expect(b[i]!.y).toBeCloseTo(p.y, 10)
      expect(b[i]!.z).toBeCloseTo(p.z, 10)
    })
  })

  it('is scale-invariant', () => {
    const base = samplePose()
    const scaled = base.map((p) => ({ x: p.x * 5, y: p.y * 5, z: p.z * 5 }))
    const a = normalizePose(base)
    const b = normalizePose(scaled)
    a.forEach((p, i) => {
      expect(b[i]!.x).toBeCloseTo(p.x, 10)
      expect(b[i]!.y).toBeCloseTo(p.y, 10)
      expect(b[i]!.z).toBeCloseTo(p.z, 10)
    })
  })

  it('does not crash on coincident shoulders (zero width)', () => {
    const pose = samplePose()
    pose[11] = { x: 0.5, y: 0.5, z: 0 }
    pose[12] = { x: 0.5, y: 0.5, z: 0 }
    const out = normalizePose(pose)
    expect(out[L_SHOULDER_POS]).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('throws on the wrong number of pose landmarks', () => {
    expect(() => normalizePose([{ x: 0, y: 0, z: 0 }])).toThrow()
  })
})

describe('normalizeFrame', () => {
  const full: HolisticObservation = {
    pose: samplePose(),
    leftHand: sampleHand(),
    rightHand: sampleHand(),
  }

  it('produces a fixed-length feature vector', () => {
    expect(normalizeFrame(full)).toHaveLength(FRAME_FEATURE_DIM)
  })

  it('sets presence flags for the hands seen', () => {
    const out = normalizeFrame(full)
    expect(out[FRAME_FEATURE_DIM - 2]).toBe(1) // left present
    expect(out[FRAME_FEATURE_DIM - 1]).toBe(1) // right present

    const rightOnly = normalizeFrame({ ...full, leftHand: null })
    expect(rightOnly[FRAME_FEATURE_DIM - 2]).toBe(0)
    expect(rightOnly[FRAME_FEATURE_DIM - 1]).toBe(1)
  })

  it('zero-fills an absent pose block', () => {
    const out = normalizeFrame({ ...full, pose: null })
    expect(out.slice(0, POSE_BLOCK_LEN)).toEqual(
      new Array(POSE_BLOCK_LEN).fill(0),
    )
  })

  it('zero-fills an absent hand block', () => {
    const out = normalizeFrame({ ...full, leftHand: null })
    const leftBlock = out.slice(POSE_BLOCK_LEN, POSE_BLOCK_LEN + HAND_BLOCK_LEN)
    expect(leftBlock).toEqual(new Array(HAND_BLOCK_LEN).fill(0))
  })

  it('is all zeros (except already-zero flags) for an empty frame', () => {
    const out = normalizeFrame({ pose: null, leftHand: null, rightHand: null })
    expect(out).toEqual(new Array(FRAME_FEATURE_DIM).fill(0))
  })

  it('exposes a stable normalization id', () => {
    expect(DYNAMIC_NORMALIZATION_ID).toBe('pose-shoulder-hands-v1')
  })

  it('matches the shared golden fixture (TS↔Python parity)', () => {
    const fixture = goldenFixture as unknown as {
      frameFeatureDim: number
      cases: {
        name: string
        pose: Landmark[] | null
        leftHand: Landmark[] | null
        rightHand: Landmark[] | null
        expected: number[]
      }[]
    }
    expect(fixture.frameFeatureDim).toBe(FRAME_FEATURE_DIM)
    for (const testCase of fixture.cases) {
      const out = normalizeFrame({
        pose: testCase.pose,
        leftHand: testCase.leftHand,
        rightHand: testCase.rightHand,
      })
      expect(out, `case ${testCase.name}`).toHaveLength(
        testCase.expected.length,
      )
      out.forEach((v, i) => {
        expect(v, `case ${testCase.name} [${i}]`).toBeCloseTo(
          testCase.expected[i]!,
          10,
        )
      })
    }
  })
})
