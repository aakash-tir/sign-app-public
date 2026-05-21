/**
 * Tiny forward pass for the exported MLP (format "mlp-1"). No TF.js/ONNX runtime
 * — the static fingerspelling model is small enough to evaluate directly here
 * (see ADR-011). Each layer weight `W` has shape `[out][in]`.
 */

export type Activation = 'relu' | 'softmax'

export interface MlpLayer {
  W: number[][]
  b: number[]
  activation: Activation
}

export interface MlpModel {
  format: string
  normalization: string
  inputDim: number
  labels: string[]
  layers: MlpLayer[]
}

export interface Prediction {
  label: string
  confidence: number
}

function relu(values: number[]): number[] {
  return values.map((v) => (v > 0 ? v : 0))
}

function softmax(values: number[]): number[] {
  const max = Math.max(...values)
  const exps = values.map((v) => Math.exp(v - max))
  const sum = exps.reduce((acc, v) => acc + v, 0)
  return exps.map((v) => v / sum)
}

function dense(input: number[], weight: number[][], bias: number[]): number[] {
  return weight.map((row, j) => {
    let sum = bias[j] ?? 0
    for (let i = 0; i < row.length; i++) {
      sum += (row[i] ?? 0) * (input[i] ?? 0)
    }
    return sum
  })
}

/** Run the model, returning the output-layer probabilities. */
export function runModel(model: MlpModel, features: number[]): number[] {
  let activations = features
  for (const layer of model.layers) {
    const z = dense(activations, layer.W, layer.b)
    activations = layer.activation === 'relu' ? relu(z) : softmax(z)
  }
  return activations
}

/** Run the model and return the top label with its confidence. */
export function classify(model: MlpModel, features: number[]): Prediction {
  const probs = runModel(model, features)
  let best = 0
  for (let i = 1; i < probs.length; i++) {
    if ((probs[i] ?? 0) > (probs[best] ?? 0)) best = i
  }
  return { label: model.labels[best] ?? '?', confidence: probs[best] ?? 0 }
}
