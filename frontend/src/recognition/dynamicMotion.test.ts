import { describe, it, expect } from 'vitest'
import {
  FRAME_FEATURE_DIM,
  MODEL_FEATURE_DIM,
  withMotion,
} from './dynamicNormalization'
import motionFixture from './fixtures/dynamic-motion.golden.json'

describe('withMotion', () => {
  it('appends velocity of the spatial dims only (presence carried through)', () => {
    const window = [
      [0.1, 0.2, 0.3, 1, 0], // F=5 -> 3 spatial + 2 presence
      [0.15, 0.1, 0.3, 1, 1],
    ]
    const out = withMotion(window)
    expect(out[0]).toHaveLength(8) // 5 + (5 - 2)
    expect(out[0]).toEqual([0.1, 0.2, 0.3, 1, 0, 0, 0, 0]) // first frame velocity 0
    expect(out[1]!.slice(0, 5)).toEqual([0.15, 0.1, 0.3, 1, 1]) // original kept
    expect(out[1]!.slice(5)).toEqual([
      expect.closeTo(0.05, 10),
      expect.closeTo(-0.1, 10),
      0,
    ])
  })

  it('zeros velocity across inactive (padding/undetected) frames', () => {
    const pad = [0, 0, 0, 0, 0]
    const out = withMotion([pad, [0.1, 0.2, 0.3, 1, 1], [0.4, 0.1, 0.3, 1, 1]])
    expect(out[1]!.slice(5)).toEqual([0, 0, 0]) // follows padding -> no spike
    expect(out[2]!.slice(5)).toEqual([
      expect.closeTo(0.3, 10),
      expect.closeTo(-0.1, 10),
      0,
    ])
  })

  it('maps a full 161-d frame window to 320-d', () => {
    const frame = new Array<number>(FRAME_FEATURE_DIM).fill(0.1)
    const out = withMotion([frame, frame])
    expect(out[0]).toHaveLength(MODEL_FEATURE_DIM)
    expect(MODEL_FEATURE_DIM).toBe(2 * FRAME_FEATURE_DIM - 2)
  })

  it('matches the shared Python golden fixture (parity contract)', () => {
    for (const c of motionFixture.cases) {
      const got = withMotion(c.window)
      expect(got.length).toBe(c.expected.length)
      got.forEach((row, i) => {
        row.forEach((v, j) => {
          expect(v).toBeCloseTo(c.expected[i]![j]!, 10)
        })
      })
    }
  })
})
