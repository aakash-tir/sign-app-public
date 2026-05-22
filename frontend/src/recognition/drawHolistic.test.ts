import { describe, it, expect } from 'vitest'
import { drawHolistic } from './drawHolistic'
import { FINGER_COLORS } from './fingerColors'
import { HAND_LANDMARK_COUNT } from './types'
import type { Landmark } from './types'
import { POSE_LANDMARK_COUNT } from './dynamicTypes'
import type { HolisticObservation } from './dynamicTypes'
import { createRecordingCanvas } from '../test/mockCanvas'

const inFrame = (): Landmark => ({ x: 0.5, y: 0.5, z: 0 })
const FINGER_PALETTE = Object.values(FINGER_COLORS)

function makeObservation(): HolisticObservation {
  return {
    pose: Array.from({ length: POSE_LANDMARK_COUNT }, inFrame),
    leftHand: Array.from({ length: HAND_LANDMARK_COUNT }, inFrame),
    rightHand: null,
  }
}

describe('drawHolistic', () => {
  it('clears the canvas once', () => {
    const { ctx, calls } = createRecordingCanvas()
    drawHolistic(ctx, makeObservation(), 100, 100)
    expect(calls.clearRect).toBe(1)
  })

  it('draws the hand in one uniform color in classic mode (the default)', () => {
    const { ctx, calls } = createRecordingCanvas()
    drawHolistic(ctx, makeObservation(), 100, 100) // defaults to classic
    // No finger-palette colors are used in classic mode.
    expect(calls.strokes.some((c) => FINGER_PALETTE.includes(c))).toBe(false)
    expect(calls.fills.some((c) => FINGER_PALETTE.includes(c))).toBe(false)
  })

  it('colors the hands per-finger and the pose in a distinct color', () => {
    const { ctx, calls } = createRecordingCanvas()
    drawHolistic(ctx, makeObservation(), 100, 100, 'per-finger')
    const stroked = new Set(calls.strokes)
    for (const finger of [
      'thumb',
      'index',
      'middle',
      'ring',
      'pinky',
    ] as const) {
      expect(stroked).toContain(FINGER_COLORS[finger])
    }
    // The pose uses a color outside the finger palette.
    expect(calls.strokes.some((c) => !FINGER_PALETTE.includes(c))).toBe(true)
  })

  it('drops only the off-frame pose segments (stray-line cleanup)', () => {
    const full = createRecordingCanvas()
    drawHolistic(full.ctx, makeObservation(), 100, 100)

    const partial = createRecordingCanvas()
    const obs = makeObservation()
    obs.pose![23] = { x: 0.5, y: 1.5, z: 0 } // hip extrapolated below frame
    drawHolistic(partial.ctx, obs, 100, 100)

    // Landmark 23 participates in two pose bones ([11,23] and [23,24]).
    expect(full.calls.strokes.length - partial.calls.strokes.length).toBe(2)
    // ...and its own dot is no longer filled.
    expect(full.calls.fills.length - partial.calls.fills.length).toBe(1)
  })
})
