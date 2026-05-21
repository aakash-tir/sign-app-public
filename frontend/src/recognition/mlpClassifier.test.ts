import { describe, it, expect } from 'vitest'
import { classify, runModel, type MlpModel } from './mlpClassifier'

// Identity 2->2 softmax model.
const identityModel: MlpModel = {
  format: 'mlp-1',
  normalization: 'wrist-mcp9-mirror-v1',
  inputDim: 2,
  labels: ['A', 'B'],
  layers: [
    {
      W: [
        [1, 0],
        [0, 1],
      ],
      b: [0, 0],
      activation: 'softmax',
    },
  ],
}

describe('runModel', () => {
  it('produces probabilities that sum to 1', () => {
    const probs = runModel(identityModel, [2, 1])
    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
  })

  it('applies relu in hidden layers then softmax', () => {
    const model: MlpModel = {
      format: 'mlp-1',
      normalization: 'wrist-mcp9-mirror-v1',
      inputDim: 1,
      labels: ['A', 'B'],
      layers: [
        { W: [[1], [1]], b: [0, -5], activation: 'relu' }, // z=[x, x-5] -> relu
        {
          W: [
            [1, 0],
            [0, 1],
          ],
          b: [0, 0],
          activation: 'softmax',
        },
      ],
    }
    // x=3 -> relu([3, -2]) = [3, 0] -> softmax([3, 0])
    const probs = runModel(model, [3])
    const expectedA = Math.exp(3) / (Math.exp(3) + 1)
    expect(probs[0]).toBeCloseTo(expectedA, 10)
  })
})

describe('classify', () => {
  it('returns the argmax label and its confidence', () => {
    const result = classify(identityModel, [2, 1])
    expect(result.label).toBe('A')
    // softmax([2,1]) top probability
    expect(result.confidence).toBeCloseTo(Math.exp(1) / (Math.exp(1) + 1), 10)
  })
})
