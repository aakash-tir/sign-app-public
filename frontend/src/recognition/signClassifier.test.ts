import { describe, it, expect } from 'vitest'
import { fingerspellingModel, recognizeSign } from './signClassifier'
import type { HandObservation } from './types'

function sampleHand(): HandObservation {
  const landmarks = Array.from({ length: 21 }, (_, i) => ({
    x: 0.5 + 0.02 * i,
    y: 0.5 + 0.03 * i,
    z: 0.01 * i,
  }))
  landmarks[0] = { x: 0.5, y: 0.5, z: 0 }
  landmarks[9] = { x: 0.8, y: 0.9, z: 0 }
  return { landmarks, handedness: 'Right', score: 0.99 }
}

describe('recognizeSign', () => {
  it('returns a valid label from the bundled model', () => {
    const result = recognizeSign(sampleHand())
    expect(fingerspellingModel.labels).toContain(result.label)
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it('honors the confidence threshold', () => {
    expect(recognizeSign(sampleHand(), fingerspellingModel, 1.1).accepted).toBe(
      false,
    )
    expect(recognizeSign(sampleHand(), fingerspellingModel, 0).accepted).toBe(
      true,
    )
  })

  it('throws on normalization mismatch (train/serve skew guard)', () => {
    const skewed = { ...fingerspellingModel, normalization: 'mismatch' }
    expect(() => recognizeSign(sampleHand(), skewed)).toThrow()
  })
})
