import { describe, it, expect } from 'vitest'
import {
  accepts,
  assertMetadataCompatible,
  softmax,
  topPrediction,
} from './dynamicClassifier'
import type { DynamicModelMetadata } from './dynamicClassifier'
import {
  DYNAMIC_NORMALIZATION_ID,
  FRAME_FEATURE_DIM,
} from './dynamicNormalization'
import { WINDOW_SIZE } from './frameWindow'

function validMetadata(
  overrides: Partial<DynamicModelMetadata> = {},
): DynamicModelMetadata {
  return {
    format: 'onnx',
    modelFile: 'model.onnx',
    normalization: DYNAMIC_NORMALIZATION_ID,
    window: WINDOW_SIZE,
    featureDim: FRAME_FEATURE_DIM,
    output: 'logits',
    labels: ['yes', 'no'],
    ...overrides,
  }
}

describe('softmax', () => {
  it('sums to 1 and is order-preserving', () => {
    const p = softmax([1, 2, 3])
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
    expect(p[2]!).toBeGreaterThan(p[1]!)
    expect(p[1]!).toBeGreaterThan(p[0]!)
  })

  it('is shift-invariant (numerically stable)', () => {
    const a = softmax([0, 1, 2])
    const b = softmax([1000, 1001, 1002])
    a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 10))
  })

  it('handles an empty input', () => {
    expect(softmax([])).toEqual([])
  })
})

describe('topPrediction', () => {
  it('returns the argmax label and confidence', () => {
    const top = topPrediction([0.1, 0.7, 0.2], ['a', 'b', 'c'])
    expect(top).toEqual({ index: 1, label: 'b', confidence: 0.7 })
  })
})

describe('accepts', () => {
  const labels = ['yes', 'no', 'go']
  const probs = [0.5, 0.3, 0.2]

  it('accepts the target when it clears the threshold', () => {
    expect(accepts(probs, labels, 'yes', 0.4)).toBe(true)
  })

  it('rejects the target below the threshold even if not argmax', () => {
    expect(accepts(probs, labels, 'no', 0.4)).toBe(false)
  })

  it('accepts a non-argmax target that still clears the threshold', () => {
    expect(accepts(probs, labels, 'no', 0.25)).toBe(true)
  })

  it('rejects an unknown target', () => {
    expect(accepts(probs, labels, 'missing', 0)).toBe(false)
  })
})

describe('assertMetadataCompatible', () => {
  it('accepts a matching model', () => {
    expect(() => assertMetadataCompatible(validMetadata())).not.toThrow()
  })

  it('rejects a normalization-id mismatch', () => {
    expect(() =>
      assertMetadataCompatible(validMetadata({ normalization: 'other' })),
    ).toThrow(/normalization/)
  })

  it('rejects a window mismatch', () => {
    expect(() =>
      assertMetadataCompatible(validMetadata({ window: 15 })),
    ).toThrow(/window/)
  })

  it('rejects a featureDim mismatch', () => {
    expect(() =>
      assertMetadataCompatible(validMetadata({ featureDim: 100 })),
    ).toThrow(/featureDim/)
  })

  it('rejects empty labels', () => {
    expect(() =>
      assertMetadataCompatible(validMetadata({ labels: [] })),
    ).toThrow(/labels/)
  })
})
