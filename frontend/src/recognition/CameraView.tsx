import { useCallback, useEffect, useRef, useState } from 'react'
import { useCamera } from './useCamera'
import { drawHands } from './drawLandmarks'
import { createMediaPipeHandDetector } from './mediapipeDetector'
import { recognizeSign } from './signClassifier'
import { LabelStabilizer } from './debounce'
import type { LandmarkDetector } from './types'
import './CameraView.css'

// Consecutive agreeing frames required before a predicted sign is shown.
const STABILIZER_FRAMES = 5

/**
 * Live camera view: MediaPipe hand-landmark overlay plus debounced static-sign
 * (fingerspelling) recognition. Camera activation is independent of the tracker
 * loading, so a tracker failure still leaves a working camera.
 */
export function CameraView() {
  const { videoRef, status, error, start, stop } = useCamera()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const detectorRef = useRef<LandmarkDetector | null>(null)
  const rafRef = useRef<number | null>(null)
  const [handCount, setHandCount] = useState(0)
  const [trackerError, setTrackerError] = useState<string | null>(null)
  const stabilizerRef = useRef(new LabelStabilizer(STABILIZER_FRAMES))
  const [prediction, setPrediction] = useState<{
    label: string
    confidence: number
  } | null>(null)

  // Lazily load the MediaPipe detector once the camera is on.
  useEffect(() => {
    if (status !== 'on' || detectorRef.current) return
    let cancelled = false
    createMediaPipeHandDetector()
      .then((detector) => {
        if (cancelled) detector.close()
        else detectorRef.current = detector
      })
      .catch((err: unknown) => {
        setTrackerError(
          err instanceof Error ? err.message : 'Failed to load hand tracker.',
        )
      })
    return () => {
      cancelled = true
    }
  }, [status])

  // Render loop: detect + draw landmarks while the camera is on.
  useEffect(() => {
    if (status !== 'on') return

    const loop = () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      const detector = detectorRef.current
      if (video && canvas && detector && video.readyState >= 2) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          try {
            const hands = detector.detect(video, performance.now())
            setHandCount(hands.length)
            drawHands(ctx, hands, canvas.width, canvas.height)

            const hand = hands[0]
            if (hand) {
              const result = recognizeSign(hand)
              const stable = stabilizerRef.current.push(
                result.accepted ? result.label : null,
              )
              setPrediction(
                stable
                  ? { label: stable, confidence: result.confidence }
                  : null,
              )
            } else {
              stabilizerRef.current.push(null)
            }
          } catch {
            // Transient per-frame detect errors are non-fatal; keep looping.
          }
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [status, videoRef])

  // Close the detector on unmount.
  useEffect(() => {
    return () => {
      detectorRef.current?.close()
      detectorRef.current = null
    }
  }, [])

  const handleStart = useCallback(() => void start(), [start])
  const handleStop = useCallback(() => {
    stop()
    stabilizerRef.current.reset()
    setPrediction(null)
  }, [stop])

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
          <button type="button" onClick={handleStart}>
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
            <button type="button" onClick={handleStop}>
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
