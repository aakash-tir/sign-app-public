import { useCallback, useEffect, useRef, useState } from 'react'
import { useCamera, type CameraStatus } from './useCamera'
import { drawHands } from './drawLandmarks'
import { getOverlayColorMode } from './overlayColorMode'
import { createMediaPipeHandDetector } from './mediapipeDetector'
import { recognizeSign } from './signClassifier'
import { LabelStabilizer } from './debounce'
import type { LandmarkDetector } from './types'

// Consecutive agreeing frames required before a predicted sign is reported.
const STABILIZER_FRAMES = 5

export interface SignPrediction {
  label: string
  confidence: number
}

export interface UseSignRecognition {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  status: CameraStatus
  error: string | null
  trackerError: string | null
  handCount: number
  /** Debounced, threshold-cleared prediction (null until one stabilizes). */
  prediction: SignPrediction | null
  start: () => void
  stop: () => void
  resetPrediction: () => void
}

/**
 * Camera + MediaPipe hand tracking + debounced static-sign recognition, shared
 * by the camera demo and Practice mode. Camera activation is independent of the
 * tracker loading, so a tracker failure still leaves a working camera.
 */
export function useSignRecognition(): UseSignRecognition {
  const { videoRef, status, error, start, stop } = useCamera()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const detectorRef = useRef<LandmarkDetector | null>(null)
  const rafRef = useRef<number | null>(null)
  const stabilizerRef = useRef(new LabelStabilizer(STABILIZER_FRAMES))
  const [handCount, setHandCount] = useState(0)
  const [trackerError, setTrackerError] = useState<string | null>(null)
  const [prediction, setPrediction] = useState<SignPrediction | null>(null)

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

  // Render loop: detect + draw + recognize while the camera is on.
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
            drawHands(
              ctx,
              hands,
              canvas.width,
              canvas.height,
              getOverlayColorMode(),
            )

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

  const resetPrediction = useCallback(() => {
    stabilizerRef.current.reset()
    setPrediction(null)
  }, [])

  const handleStart = useCallback(() => void start(), [start])
  const handleStop = useCallback(() => {
    stop()
    stabilizerRef.current.reset()
    setPrediction(null)
  }, [stop])

  return {
    videoRef,
    canvasRef,
    status,
    error,
    trackerError,
    handCount,
    prediction,
    start: handleStart,
    stop: handleStop,
    resetPrediction,
  }
}
