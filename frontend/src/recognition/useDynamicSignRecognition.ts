import { useCallback, useEffect, useRef, useState } from 'react'
import { useCamera, type CameraStatus } from './useCamera'
import { createMediaPipeHolisticDetector } from './holisticDetector'
import { createOnnxDynamicClassifier } from './onnxDynamicClassifier'
import { drawHolistic } from './drawHolistic'
import { normalizeFrame } from './dynamicNormalization'
import { FrameWindow, shouldSampleFrame } from './frameWindow'
import { LabelStabilizer } from './debounce'
import { accepts } from './dynamicClassifier'
import type { HolisticDetector } from './dynamicTypes'
import type { DynamicClassifier, DynamicPrediction } from './dynamicClassifier'

const STABILIZER_FRAMES = 2 // agreeing classifications before a label is "stable"
const INFER_INTERVAL_MS = 250 // throttle async inference (ONNX runs are not free)
const ACCEPT_THRESHOLD = 0.5 // per-sign acceptance probability for the prompt

export interface UseDynamicSignRecognition {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  status: CameraStatus
  error: string | null
  trackerError: string | null
  /** Glosses the loaded model can recognize (empty until it loads). */
  labels: string[]
  /** Latest debounced prediction (null until one stabilizes). */
  prediction: DynamicPrediction | null
  /** The gloss the user is asked to perform (drives per-sign acceptance). */
  target: string | null
  setTarget: (gloss: string | null) => void
  /** True when the latest window clears the acceptance threshold for `target`. */
  accepted: boolean
  start: () => void
  stop: () => void
}

/**
 * Camera + MediaPipe Holistic + windowed ONNX sequence recognition for dynamic
 * signs. Camera activation is independent of the (heavier) tracker/model load, so
 * a load failure still leaves a working camera. Always releases the camera and
 * detector on unmount.
 */
export function useDynamicSignRecognition(): UseDynamicSignRecognition {
  const { videoRef, status, error, start, stop } = useCamera()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const detectorRef = useRef<HolisticDetector | null>(null)
  const classifierRef = useRef<DynamicClassifier | null>(null)
  const windowRef = useRef(new FrameWindow())
  const stabilizerRef = useRef(new LabelStabilizer(STABILIZER_FRAMES))
  const rafRef = useRef<number | null>(null)
  const lastSampleRef = useRef<number | null>(null)
  const lastInferRef = useRef<number>(0)
  const inFlightRef = useRef(false)
  const targetRef = useRef<string | null>(null)

  const [labels, setLabels] = useState<string[]>([])
  const [trackerError, setTrackerError] = useState<string | null>(null)
  const [prediction, setPrediction] = useState<DynamicPrediction | null>(null)
  const [target, setTargetState] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)

  const setTarget = useCallback((gloss: string | null) => {
    targetRef.current = gloss
    setTargetState(gloss)
    setAccepted(false)
  }, [])

  // Lazily load the holistic detector + ONNX model once the camera is on.
  useEffect(() => {
    if (status !== 'on') return
    let cancelled = false
    if (!detectorRef.current) {
      createMediaPipeHolisticDetector()
        .then((d) => (cancelled ? d.close() : (detectorRef.current = d)))
        .catch((err: unknown) =>
          setTrackerError(
            err instanceof Error
              ? err.message
              : 'Failed to load holistic tracker.',
          ),
        )
    }
    if (!classifierRef.current) {
      createOnnxDynamicClassifier()
        .then((c) => {
          if (!cancelled) {
            classifierRef.current = c
            setLabels(c.labels)
          }
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

  // Capture loop: detect + draw + window + throttled async classify.
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
              const sequence = windowRef.current.toSequence()
              classifier
                .classify(sequence)
                .then((pred) => {
                  stabilizerRef.current.push(pred.label)
                  setPrediction(pred)
                  const tgt = targetRef.current
                  setAccepted(
                    tgt
                      ? accepts(
                          pred.probs,
                          classifier.labels,
                          tgt,
                          ACCEPT_THRESHOLD,
                        )
                      : false,
                  )
                })
                .catch(() => {
                  /* transient inference error; keep looping */
                })
                .finally(() => {
                  inFlightRef.current = false
                })
            }
          } catch {
            /* transient per-frame detect errors are non-fatal */
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

  const resetTransient = useCallback(() => {
    windowRef.current.reset()
    stabilizerRef.current.reset()
    lastSampleRef.current = null
    setPrediction(null)
    setAccepted(false)
  }, [])

  const handleStart = useCallback(() => void start(), [start])
  const handleStop = useCallback(() => {
    stop()
    resetTransient()
  }, [stop, resetTransient])

  return {
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
    start: handleStart,
    stop: handleStop,
  }
}
