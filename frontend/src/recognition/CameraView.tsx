import { useSignRecognition } from './useSignRecognition'
import './CameraView.css'

/**
 * Free-form camera demo: live hand-landmark overlay + debounced fingerspelling
 * prediction. Thin presentational wrapper over {@link useSignRecognition}.
 */
export function CameraView() {
  const {
    videoRef,
    canvasRef,
    status,
    error,
    trackerError,
    handCount,
    prediction,
    start,
    stop,
  } = useSignRecognition()

  return (
    <section className="camera-view" aria-label="Camera and hand tracking">
      <div className="camera-stage">
        <video
          ref={videoRef}
          className="camera-video"
          playsInline
          muted
          data-testid="camera-video"
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
              Camera on — {handCount} hand{handCount === 1 ? '' : 's'} detected
            </p>
            <div className="prediction" data-testid="prediction">
              {prediction ? (
                <>
                  <span className="prediction-letter">{prediction.label}</span>
                  <span className="prediction-confidence">
                    {Math.round(prediction.confidence * 100)}%
                  </span>
                </>
              ) : (
                <span className="prediction-empty">Show a sign…</span>
              )}
            </div>
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
