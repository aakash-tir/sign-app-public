import { classify, type MlpModel, type Prediction } from './mlpClassifier'
import {
  NORMALIZATION_ID,
  flattenLandmarks,
  normalizeHandLandmarks,
} from './normalization'
import type { HandObservation } from './types'
import fingerspellingJson from './models/fingerspelling.json'

/** The bundled fingerspelling model, loaded for offline use. */
export const fingerspellingModel = fingerspellingJson as unknown as MlpModel

/** Default confidence below which a prediction is not accepted. */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.6

export interface SignRecognitionResult extends Prediction {
  /** Whether the prediction cleared the confidence threshold. */
  accepted: boolean
}

/**
 * Recognize a static sign from one detected hand: normalize (must match the
 * model's training normalization) -> flatten -> classify -> threshold.
 */
export function recognizeSign(
  hand: HandObservation,
  model: MlpModel = fingerspellingModel,
  threshold: number = DEFAULT_CONFIDENCE_THRESHOLD,
): SignRecognitionResult {
  if (model.normalization !== NORMALIZATION_ID) {
    throw new Error(
      `Model normalization "${model.normalization}" does not match runtime ` +
        `"${NORMALIZATION_ID}" — train/serve skew`,
    )
  }
  const features = flattenLandmarks(
    normalizeHandLandmarks(hand.landmarks, hand.handedness),
  )
  const prediction = classify(model, features)
  return { ...prediction, accepted: prediction.confidence >= threshold }
}
