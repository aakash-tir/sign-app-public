import { useCallback, useEffect, useRef, useState } from 'react'
import { useCamera, type CameraStatus } from './useCamera'
import { createMediaPipeHolisticDetector } from './holisticDetector'
import { createOnnxDynamicClassifier } from './onnxDynamicClassifier'
import { drawHolistic } from './drawHolistic'
import { recognizeSign } from './signClassifier'
import { normalizeFrame } from './dynamicNormalization'
import { FrameWindow, shouldSampleFrame } from './frameWindow'
import { LabelStabilizer } from './debounce'
import type { HolisticDetector, HolisticObservation } from './dynamicTypes'
import type { DynamicClassifier } from './dynamicClassifier'
import type { HandObservation } from './types'

/** Which recognizer the current prompt needs. */
export type SignKind = 'letter' | 'sign'

const STABILIZER_FRAMES = 3
const INFER_INTERVAL_MS = 250
const SIGN_THRESHOLD = 0.5

export interface SignMatch {
  label: string
  confidence: number
}

export interface UseUnifiedSignRecognition {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  status: CameraStatus
  error: string | null
  trackerError: string | null
  /** Debounced recognition for the active mode (null until one stabilizes). */
  recognized: SignMatch | null
  start: () => void
  stop: () => void
  /** Switch between letter (static) and sign (dynamic) recognition. */
  setMode: (kind: SignKind) => void
  /** Clear the debounce/window between prompts. */
  reset: () => void
}

/** Pick the hand to read for static letters (prefer the canonical right hand). */
function handFromHolistic(obs: HolisticObservation): HandObservation | null {
  if (obs.rightHand)
    return { landmarks: obs.rightHand, handedness: 'Right', score: 1 }
  if (obs.leftHand)
    return { landmarks: obs.leftHand, handedness: 'Left', score: 1 }
  return null
}

/**
 * One camera + one MediaPipe Holistic detector feeding **both** recognizers:
 * the static fingerspelling MLP (on the detected hand) for letters, and the
 * dynamic ONNX classifier (on a 30-frame window) for word-level signs. The
 * active `mode` selects which result is surfaced, so Practice/Learn can prompt
 * letters and signs in one loop without swapping cameras. Releases the camera +
 * detector on unmount.
 */
export function useUnifiedSignRecognition(): UseUnifiedSignRecognition {
  const { videoRef, status, error, start, stop } = useCamera()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const detectorRef = useRef<HolisticDetector | null>(null)
  const classifierRef = useRef<DynamicClassifier | null>(null)
  const windowRef = useRef(new FrameWindow())
  const stabilizerRef = useRef(new LabelStabilizer(STABILIZER_FRAMES))
  const rafRef = useRef<number | null>(null)
  const lastSampleRef = useRef<number | null>(null)
  const lastInferRef = useRef(0)
  const inFlightRef = useRef(false)
  const modeRef = useRef<SignKind>('letter')

  const [trackerError, setTrackerError] = useState<string | null>(null)
  const [recognized, setRecognized] = useState<SignMatch | null>(null)

  const setMode = useCallback((kind: SignKind) => {
    modeRef.current = kind
  }, [])

  const reset = useCallback(() => {
    windowRef.current.reset()
    stabilizerRef.current.reset()
    lastSampleRef.current = null
    setRecognized(null)
  }, [])

  // Lazily load the holistic detector + dynamic model once the camera is on.
  useEffect(() => {
    if (status !== 'on') return
    let cancelled = false
    if (!detectorRef.current) {
      createMediaPipeHolisticDetector()
        .then((d) => (cancelled ? d.close() : (detectorRef.current = d)))
        .catch((err: unknown) =>
          setTrackerError(
            err instanceof Error ? err.message : 'Failed to load tracker.',
          ),
        )
    }
    if (!classifierRef.current) {
      createOnnxDynamicClassifier()
        .then((c) => {
          if (!cancelled) classifierRef.current = c
        })
        .catch((err: unknown) =>
          setTrackerError(
            err instanceof Error ? err.message : 'Failed to load sign model.',
          ),
        )
    }
    return () => {
      cancelled = true
    }
  }, [status])

  // Capture loop: detect + draw + recognize via the active mode.
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
            const now = performance.now()
            const obs = detector.detect(video, now)
            drawHolistic(ctx, obs, canvas.width, canvas.height)

            if (modeRef.current === 'letter') {
              const hand = handFromHolistic(obs)
              const result = hand ? recognizeSign(hand) : null
              const stable = stabilizerRef.current.push(
                result?.accepted ? result.label : null,
              )
              setRecognized(
                stable
                  ? { label: stable, confidence: result?.confidence ?? 0 }
                  : null,
              )
            } else {
              if (shouldSampleFrame(lastSampleRef.current, now)) {
                lastSampleRef.current = now
                windowRef.current.push(normalizeFrame(obs))
              }
              const classifier = classifierRef.current
              if (
                classifier &&
                windowRef.current.isReady &&
                !inFlightRef.current &&
                now - lastInferRef.current >= INFER_INTERVAL_MS
              ) {
                lastInferRef.current = now
                inFlightRef.current = true
                classifier
                  .classify(windowRef.current.toSequence())
                  .then((pred) => {
                    const stable = stabilizerRef.current.push(
                      pred.confidence >= SIGN_THRESHOLD ? pred.label : null,
                    )
                    setRecognized(
                      stable
                        ? { label: stable, confidence: pred.confidence }
                        : null,
                    )
                  })
                  .catch(() => {})
                  .finally(() => {
                    inFlightRef.current = false
                  })
              }
            }
          } catch {
            /* transient per-frame errors are non-fatal */
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
    reset()
  }, [stop, reset])

  return {
    videoRef,
    canvasRef,
    status,
    error,
    trackerError,
    recognized,
    start: handleStart,
    stop: handleStop,
    setMode,
    reset,
  }
}
