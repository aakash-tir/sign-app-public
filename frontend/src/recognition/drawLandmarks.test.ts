import { describe, it, expect } from 'vitest'
import { drawHands } from './drawLandmarks'
import { FINGER_COLORS } from './fingerColors'
import { HAND_CONNECTIONS, HAND_LANDMARK_COUNT } from './types'
import type { HandObservation, Landmark } from './types'
import { createRecordingCanvas } from '../test/mockCanvas'

const inFrame = (): Landmark => ({ x: 0.5, y: 0.5, z: 0 })

function makeHand(): HandObservation {
  return {
    landmarks: Array.from({ length: HAND_LANDMARK_COUNT }, inFrame),
    handedness: 'Right',
    score: 1,
  }
}

describe('drawHands', () => {
  it('clears the canvas once before drawing', () => {
    const { ctx, calls } = createRecordingCanvas()
    drawHands(ctx, [makeHand()], 100, 100)
    expect(calls.clearRect).toBe(1)
  })

  it('draws every in-frame landmark and bone', () => {
    const { ctx, calls } = createRecordingCanvas()
    drawHands(ctx, [makeHand()], 100, 100, 'per-finger')
    expect(calls.arcs).toHaveLength(HAND_LANDMARK_COUNT)
    expect(calls.fills).toHaveLength(HAND_LANDMARK_COUNT)
    expect(calls.strokes).toHaveLength(HAND_CONNECTIONS.length)
  })

  it('uses a single uniform color in classic mode (the default)', () => {
    const { ctx, calls } = createRecordingCanvas()
    drawHands(ctx, [makeHand()], 100, 100) // defaults to classic
    expect(new Set(calls.fills).size).toBe(1)
    expect(new Set(calls.strokes).size).toBe(1)
    // ...and it is not a finger color.
    const palette = Object.values(FINGER_COLORS)
    expect(palette).not.toContain(calls.fills[0])
    expect(palette).not.toContain(calls.strokes[0])
  })

  it('colors each finger distinctly in per-finger mode (wrist = palm)', () => {
    const { ctx, calls } = createRecordingCanvas()
    drawHands(ctx, [makeHand()], 100, 100, 'per-finger')
    // Dots are filled in landmark order.
    expect(calls.fills[0]).toBe(FINGER_COLORS.palm) // wrist
    expect(calls.fills[4]).toBe(FINGER_COLORS.thumb) // thumb tip
    expect(calls.fills[8]).toBe(FINGER_COLORS.index)
    expect(calls.fills[12]).toBe(FINGER_COLORS.middle)
    expect(calls.fills[16]).toBe(FINGER_COLORS.ring)
    expect(calls.fills[20]).toBe(FINGER_COLORS.pinky)
    // All five finger colors appear among the bones too.
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
  })

  it('skips landmarks and bones that fall outside the frame', () => {
    const hand = makeHand()
    hand.landmarks[8] = { x: 1.5, y: 0.5, z: 0 } // index tip off-frame
    const { ctx, calls } = createRecordingCanvas()
    drawHands(ctx, [hand], 100, 100, 'per-finger')
    expect(calls.fills).toHaveLength(HAND_LANDMARK_COUNT - 1)
    // The only bone touching landmark 8 is [7,8].
    expect(calls.strokes).toHaveLength(HAND_CONNECTIONS.length - 1)
  })
})
