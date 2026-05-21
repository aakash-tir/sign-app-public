import { describe, it, expect } from 'vitest'
import { flattenLandmarks, normalizeHandLandmarks } from './normalization'
import { HAND_LANDMARK_COUNT, MIDDLE_FINGER_MCP, WRIST } from './types'
import type { Handedness, Landmark } from './types'
import goldenFixture from './fixtures/normalization.golden.json'

function makeHand(fn: (i: number) => Landmark): Landmark[] {
  return Array.from({ length: HAND_LANDMARK_COUNT }, (_, i) => fn(i))
}

/** A non-degenerate sample hand (wrist→MCP distance != 0). */
function sampleHand(): Landmark[] {
  const hand = makeHand((i) => ({
    x: 0.5 + 0.02 * i,
    y: 0.5 + 0.03 * i,
    z: 0.01 * i,
  }))
  hand[WRIST] = { x: 0.5, y: 0.5, z: 0 }
  hand[MIDDLE_FINGER_MCP] = { x: 0.8, y: 0.9, z: 0 }
  return hand
}

describe('normalizeHandLandmarks', () => {
  it('maps the wrist to the origin', () => {
    const out = normalizeHandLandmarks(sampleHand(), 'Right')
    expect(out[WRIST]).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('scales so the wrist→middle-MCP distance becomes 1', () => {
    const out = normalizeHandLandmarks(sampleHand(), 'Right')
    const ref = out[MIDDLE_FINGER_MCP]
    expect(Math.hypot(ref!.x, ref!.y, ref!.z)).toBeCloseTo(1, 10)
  })

  it('is translation-invariant', () => {
    const base = sampleHand()
    const shifted = base.map((l) => ({ x: l.x + 3, y: l.y - 2, z: l.z + 1 }))
    const a = normalizeHandLandmarks(base, 'Right')
    const b = normalizeHandLandmarks(shifted, 'Right')
    a.forEach((p, i) => {
      expect(b[i]!.x).toBeCloseTo(p.x, 10)
      expect(b[i]!.y).toBeCloseTo(p.y, 10)
      expect(b[i]!.z).toBeCloseTo(p.z, 10)
    })
  })

  it('is scale-invariant', () => {
    const base = sampleHand()
    const scaled = base.map((l) => ({ x: l.x * 4, y: l.y * 4, z: l.z * 4 }))
    const a = normalizeHandLandmarks(base, 'Right')
    const b = normalizeHandLandmarks(scaled, 'Right')
    a.forEach((p, i) => {
      expect(b[i]!.x).toBeCloseTo(p.x, 10)
      expect(b[i]!.y).toBeCloseTo(p.y, 10)
      expect(b[i]!.z).toBeCloseTo(p.z, 10)
    })
  })

  it('mirrors Left hands across x relative to Right', () => {
    const hand = sampleHand()
    const right = normalizeHandLandmarks(hand, 'Right')
    const left = normalizeHandLandmarks(hand, 'Left')
    right.forEach((p, i) => {
      expect(left[i]!.x).toBeCloseTo(-p.x, 10)
      expect(left[i]!.y).toBeCloseTo(p.y, 10)
      expect(left[i]!.z).toBeCloseTo(p.z, 10)
    })
  })

  it('throws on the wrong number of landmarks', () => {
    expect(() =>
      normalizeHandLandmarks([{ x: 0, y: 0, z: 0 }], 'Right'),
    ).toThrow()
  })

  it('does not crash on a degenerate (zero-size) hand', () => {
    const flat = makeHand(() => ({ x: 1, y: 1, z: 1 }))
    const out = normalizeHandLandmarks(flat, 'Right')
    expect(out[WRIST]).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('matches the shared golden fixture (TS↔Python parity)', () => {
    const fixture = goldenFixture as unknown as {
      cases: {
        handedness: Handedness
        input: Landmark[]
        expected: Landmark[]
      }[]
    }
    for (const testCase of fixture.cases) {
      const out = normalizeHandLandmarks(testCase.input, testCase.handedness)
      out.forEach((p, i) => {
        expect(p.x).toBeCloseTo(testCase.expected[i]!.x, 10)
        expect(p.y).toBeCloseTo(testCase.expected[i]!.y, 10)
        expect(p.z).toBeCloseTo(testCase.expected[i]!.z, 10)
      })
    }
  })
})

describe('flattenLandmarks', () => {
  it('flattens to x,y,z order', () => {
    const out = flattenLandmarks([
      { x: 1, y: 2, z: 3 },
      { x: 4, y: 5, z: 6 },
    ])
    expect(out).toEqual([1, 2, 3, 4, 5, 6])
  })
})
