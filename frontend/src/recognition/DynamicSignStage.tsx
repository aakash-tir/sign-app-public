import type { ReactNode } from 'react'
import { CameraPlaceholder } from './CameraPlaceholder'
import { SignReferencePlayer } from './SignReferencePlayer'
import type { UseDynamicSignRecognition } from './useDynamicSignRecognition'
import './CameraView.css'

interface DynamicSignStageProps {
  /** Live recognition state from `useDynamicSignRecognition`. */
  recognition: UseDynamicSignRecognition
  /** Accessible label for the section (each consumer phrases its own). */
  ariaLabel: string
  /**
   * Control rendered in the camera-on toolbar to choose/show the target sign
   * (e.g. the Signs view's dropdown). Omit when the target is fixed externally
   * (e.g. the Search view locks it to the searched gloss).
   */
  targetControl?: ReactNode
  /**
   * Render the looping reference clip under the acceptance prompt when a target is
   * set. Default `true`; set `false` when the consumer renders its own reference.
   */
  showReference?: boolean
}

/**
 * The shared camera + Holistic overlay + windowed-ONNX recognition surface for a
 * dynamic sign: video/overlay stage, camera controls, live prediction, and per-sign
 * acceptance. Extracted from `DynamicSignView` (M6.3) so both the Signs browser and
 * the Search view (P4M1) reuse one recognition UI.
 */
export function DynamicSignStage({
  recognition,
  ariaLabel,
  targetControl,
  showReference = true,
}: DynamicSignStageProps) {
  const {
    videoRef,
    canvasRef,
    status,
    error,
    trackerError,
    ready,
    prediction,
    target,
    accepted,
    start,
    stop,
  } = recognition

  return (
    <section className="camera-view" aria-label={ariaLabel}>
      <div className="camera-stage">
        <video
          ref={videoRef}
          className="camera-video"
          playsInline
          muted
          data-testid="dynamic-video"
        />
        <canvas ref={canvasRef} className="camera-overlay" />
        {status === 'idle' && <CameraPlaceholder />}
      </div>

      <div className="camera-controls">
        {status === 'idle' && (
          <button type="button" onClick={start}>
            Enable camera
          </button>
        )}
        {status === 'starting' && <p role="status">Starting camera…</p>}
        {status === 'on' && !ready && (
          <p role="status" data-testid="model-loading">
            Preparing recognition…
          </p>
        )}
        {status === 'on' && (
          <>
            <p role="status" data-testid="camera-status">
              Camera on
            </p>

            {targetControl}

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
                {showReference && <SignReferencePlayer gloss={target} />}
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
