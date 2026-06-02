import { describe, it, expect } from 'vitest'
import {
  acceptThresholdFor,
  accepts,
  assertMetadataCompatible,
  averageProbs,
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

describe('softmax temperature (P4M7)', () => {
  it('T>1 softens (less peaky) and preserves order + sum', () => {
    const sharp = softmax([1, 2, 3])
    const soft = softmax([1, 2, 3], 2)
    expect(soft.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
    // same ranking, but the top prob is lower (less confident) when softened
    expect(soft[2]!).toBeGreaterThan(soft[1]!)
    expect(soft[2]!).toBeLessThan(sharp[2]!)
  })

  it('non-positive temperature falls back to plain softmax', () => {
    expect(softmax([1, 2, 3], 0)).toEqual(softmax([1, 2, 3]))
  })
})

describe('averageProbs (multi-window voting, P4M7)', () => {
  it('element-wise means the vectors', () => {
    expect(
      averageProbs([
        [0.2, 0.8],
        [0.4, 0.6],
      ]),
    ).toEqual([expect.closeTo(0.3, 10), expect.closeTo(0.7, 10)])
  })
  it('returns [] for no buffers and the vector itself for one', () => {
    expect(averageProbs([])).toEqual([])
    expect(averageProbs([[0.1, 0.9]])).toEqual([0.1, 0.9])
  })
})

describe('acceptThresholdFor (per-sign acceptance, P4M7)', () => {
  it('uses the per-sign threshold when present, else the fallback', () => {
    expect(acceptThresholdFor({ come: 0.2 }, 'come', 0.5)).toBe(0.2)
    expect(acceptThresholdFor({ come: 0.2 }, 'father', 0.5)).toBe(0.5)
    expect(acceptThresholdFor(undefined, 'father', 0.5)).toBe(0.5)
  })
})

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
