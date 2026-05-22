import { describe, it, expect } from 'vitest'
import { HAND_CONNECTIONS, HAND_LANDMARK_COUNT } from './types'
import {
  FINGER_COLORS,
  fingerOfConnection,
  fingerOfLandmark,
  isInFrame,
  type FingerGroup,
} from './fingerColors'

const FINGERS: readonly FingerGroup[] = [
  'thumb',
  'index',
  'middle',
  'ring',
  'pinky',
]

describe('fingerOfLandmark', () => {
  it('maps the wrist (0) to palm', () => {
    expect(fingerOfLandmark(0)).toBe('palm')
  })

  it('maps each finger to its 4 landmarks (base knuckle → tip)', () => {
    const expected: Record<FingerGroup, number[]> = {
      thumb: [1, 2, 3, 4],
      index: [5, 6, 7, 8],
      middle: [9, 10, 11, 12],
      ring: [13, 14, 15, 16],
      pinky: [17, 18, 19, 20],
      palm: [0],
    }
    for (const finger of FINGERS) {
      for (const index of expected[finger]) {
        expect(fingerOfLandmark(index)).toBe(finger)
      }
    }
  })

  it('classifies every landmark index 0..20 into exactly one known group', () => {
    for (let i = 0; i < HAND_LANDMARK_COUNT; i++) {
      expect(Object.keys(FINGER_COLORS)).toContain(fingerOfLandmark(i))
    }
  })

  it('treats out-of-range indices as palm', () => {
    expect(fingerOfLandmark(-1)).toBe('palm')
    expect(fingerOfLandmark(21)).toBe('palm')
    expect(fingerOfLandmark(999)).toBe('palm')
  })
})

describe('fingerOfConnection', () => {
  it('colors a finger only when both endpoints belong to it', () => {
    expect(fingerOfConnection([1, 2])).toBe('thumb')
    expect(fingerOfConnection([2, 3])).toBe('thumb')
    expect(fingerOfConnection([3, 4])).toBe('thumb')
    expect(fingerOfConnection([5, 6])).toBe('index')
    expect(fingerOfConnection([9, 10])).toBe('middle')
    expect(fingerOfConnection([13, 14])).toBe('ring')
    expect(fingerOfConnection([17, 18])).toBe('pinky')
  })

  it('treats wrist spokes and knuckle bridges as palm', () => {
    expect(fingerOfConnection([0, 1])).toBe('palm') // wrist → thumb base
    expect(fingerOfConnection([0, 5])).toBe('palm') // wrist → index base
    expect(fingerOfConnection([5, 9])).toBe('palm') // knuckle bridge
    expect(fingerOfConnection([9, 13])).toBe('palm')
    expect(fingerOfConnection([13, 17])).toBe('palm')
    expect(fingerOfConnection([0, 17])).toBe('palm')
  })

  it('classifies every HAND_CONNECTIONS entry into a known group', () => {
    for (const connection of HAND_CONNECTIONS) {
      expect(Object.keys(FINGER_COLORS)).toContain(
        fingerOfConnection(connection),
      )
    }
  })
})

describe('FINGER_COLORS', () => {
  it('defines a color for all six groups', () => {
    for (const group of [...FINGERS, 'palm'] as FingerGroup[]) {
      expect(FINGER_COLORS[group]).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('gives the five fingers distinct colors', () => {
    const colors = FINGERS.map((f) => FINGER_COLORS[f])
    expect(new Set(colors).size).toBe(FINGERS.length)
  })
})

describe('isInFrame', () => {
  it('accepts points within [0,1] including the borders', () => {
    expect(isInFrame({ x: 0.5, y: 0.5, z: 0 })).toBe(true)
    expect(isInFrame({ x: 0, y: 0, z: 0 })).toBe(true)
    expect(isInFrame({ x: 1, y: 1, z: 0 })).toBe(true)
  })

  it('rejects points outside the frame (the stray-line guard)', () => {
    expect(isInFrame({ x: -0.1, y: 0.5, z: 0 })).toBe(false)
    expect(isInFrame({ x: 0.5, y: 1.2, z: 0 })).toBe(false)
    expect(isInFrame({ x: 1.5, y: 1.5, z: 0 })).toBe(false)
  })
})
