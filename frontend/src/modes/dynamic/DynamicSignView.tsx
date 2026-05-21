import { useDynamicSignRecognition } from '../../recognition/useDynamicSignRecognition'
import { signDictionaryUrl } from '../../content/signReference'
import { shippedLabels } from '../../content/dynamicVocab'
import '../../recognition/CameraView.css'

/**
 * Dynamic word-level sign recognition demo (M6.3): live Holistic overlay + a
 * windowed ONNX classifier. Pick a target gloss and perform it; per-sign
 * acceptance lights up when the model is confident enough. Curriculum/mode
 * integration (Practice/Learn) and the accuracy gate are M6.4.
 */
export function DynamicSignView() {
  const {
    videoRef,
    canvasRef,
    status,
    error,
    trackerError,
    labels,
    prediction,
    target,
    setTarget,
    accepted,
    start,
    stop,
  } = useDynamicSignRecognition()

  // Only prompt glosses that passed the M6.4 accuracy gate (recognition.md §6.1).
  const targetLabels = shippedLabels(labels)

  return (
    <section className="camera-view" aria-label="Dynamic sign recognition">
      <div className="camera-stage">
        <video
          ref={videoRef}
          className="camera-video"
          playsInline
          muted
          data-testid="dynamic-video"
        />
        <canvas ref={canvasRef} className="camera-overlay" />
      </div>

      <div className="camera-controls">
        {status === 'idle' && (
          <button type="button" onClick={start}>
            Enable camera
          </button>
        )}
        {status === 'starting' && <p role="status">Starting camera…</p>}
        {status === 'on' && (
          <>
            <p role="status" data-testid="camera-status">
              Camera on
            </p>

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

            <div className="prediction" data-testid="prediction">
              {prediction ? (
                <>
                  <span className="prediction-letter">{prediction.label}</span>
                  <span className="prediction-confidence">
                    {Math.round(prediction.confidence * 100)}%
                  </span>
                </>
              ) : (
                <span className="prediction-empty">Perform a sign…</span>
              )}
            </div>

            {target && (
              <>
                <p
                  data-testid="dynamic-accepted"
                  role="status"
                  className={accepted ? 'accepted' : 'not-accepted'}
                >
                  {accepted
                    ? `Good — that's "${target}"!`
                    : `Show me "${target}"…`}
                </p>
                <a
                  className="sign-reference-link"
                  href={signDictionaryUrl(target)}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="sign-reference"
                >
                  How to sign “{target}” ↗
                </a>
              </>
            )}

            <button type="button" onClick={stop}>
              Stop camera
            </button>
          </>
        )}
        {status === 'error' && (
          <p role="alert" data-testid="camera-error">
            {error ?? 'Camera error.'}
          </p>
        )}
        {trackerError && <p className="tracker-error">{trackerError}</p>}
      </div>
    </section>
  )
}
