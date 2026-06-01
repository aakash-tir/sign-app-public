import { useDynamicSignRecognition } from '../../recognition/useDynamicSignRecognition'
import { DynamicSignStage } from '../../recognition/DynamicSignStage'
import { shippedLabels } from '../../content/dynamicVocab'

/**
 * Dynamic word-level sign recognition demo (M6.3): live Holistic overlay + a
 * windowed ONNX classifier. Pick a target gloss from the dropdown and perform it;
 * per-sign acceptance lights up when the model is confident enough. The camera +
 * recognition surface is the shared `DynamicSignStage` (also used by the P4M1
 * Search view).
 */
export function DynamicSignView() {
  const recognition = useDynamicSignRecognition()
  const { labels, target, setTarget } = recognition

  // Only prompt glosses that passed the honest accuracy gate (recognition.md §6.6).
  const targetLabels = shippedLabels(labels)

  return (
    <DynamicSignStage
      recognition={recognition}
      ariaLabel="Dynamic sign recognition"
      targetControl={
        <label className="dynamic-target-label">
          Sign to perform:{' '}
          <select
            data-testid="dynamic-target"
            value={target ?? ''}
            onChange={(e) => setTarget(e.target.value || null)}
            disabled={targetLabels.length === 0}
          >
            <option value="">(free recognition)</option>
            {targetLabels.map((gloss) => (
              <option key={gloss} value={gloss}>
                {gloss}
              </option>
            ))}
          </select>
        </label>
      }
    />
  )
}
