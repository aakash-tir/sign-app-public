import { useCallback, useEffect, useRef, useState } from 'react'
import { useCamera, type CameraStatus } from './useCamera'
import { createMediaPipeHolisticDetector } from './holisticDetector'
import { createOnnxDynamicClassifier } from './onnxDynamicClassifier'
import { drawHolistic } from './drawHolistic'
import { getOverlayColorMode } from './overlayColorMode'
import { normalizeFrame } from './dynamicNormalization'
import { FrameWindow, shouldSampleFrame } from './frameWindow'
import { LabelStabilizer } from './debounce'
import {
  acceptThresholdFor,
  accepts,
  averageProbs,
  topPrediction,
} from './dynamicClassifier'
import type { HolisticDetector } from './dynamicTypes'
import type { DynamicClassifier, DynamicPrediction } from './dynamicClassifier'

const STABILIZER_FRAMES = 2 // agreeing classifications before a label is "stable"
const INFER_INTERVAL_MS = 250 // throttle async inference (ONNX runs are not free)
const ACCEPT_THRESHOLD = 0.5 // default acceptance bar (per-sign override via metadata)
const VOTE_WINDOWS = 3 // average the last N inference windows (P4M7 temporal voting)

export interface UseDynamicSignRecognition {
  videoRef: React.RefCallback<HTMLVideoElement>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  status: CameraStatus
  error: string | null
  trackerError: string | null
  /** True once both the holistic tracker and the sign model have loaded. */
  ready: boolean
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
  const { videoRef, videoEl, status, error, start, stop } = useCamera()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const detectorRef = useRef<HolisticDetector | null>(null)
  const classifierRef = useRef<DynamicClassifier | null>(null)
  const windowRef = useRef(new FrameWindow())
  const stabilizerRef = useRef(new LabelStabilizer(STABILIZER_FRAMES))
  const probsBufferRef = useRef<number[][]>([]) // recent windows for temporal voting
  const rafRef = useRef<number | null>(null)
  const lastSampleRef = useRef<number | null>(null)
  const lastInferRef = useRef<number>(0)
  const inFlightRef = useRef(false)
  const targetRef = useRef<string | null>(null)

  const [labels, setLabels] = useState<string[]>([])
  const [trackerError, setTrackerError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [prediction, setPrediction] = useState<DynamicPrediction | null>(null)
  const [target, setTargetState] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)

  // Ready once both the detector and the classifier are loaded.
  const markReadyIfLoaded = useCallback(() => {
    if (detectorRef.current && classifierRef.current) setReady(true)
  }, [])

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
        .then((d) => {
          if (cancelled) d.close()
          else {
            detectorRef.current = d
            markReadyIfLoaded()
          }
        })
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
            markReadyIfLoaded()
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
  }, [status, markReadyIfLoaded])

  // Capture loop: detect + draw + window + throttled async classify.
  useEffect(() => {
    if (status !== 'on') return

    const loop = () => {
      // Throttle the heavy detect to ~30 FPS (matches the trained window cadence
      // and keeps the main thread responsive now the camera stays on — ADR-018).
      const now = performance.now()
      if (!shouldSampleFrame(lastSampleRef.current, now)) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }
      lastSampleRef.current = now

      const video = videoEl.current
      const canvas = canvasRef.current
      const detector = detectorRef.current
      if (video && canvas && detector && video.readyState >= 2) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          try {
            const obs = detector.detect(video, now)
            drawHolistic(
              ctx,
              obs,
              canvas.width,
              canvas.height,
              getOverlayColorMode(),
            )

            // Detect runs at the sampling cadence, so push every (gated) frame.
            windowRef.current.push(normalizeFrame(obs))

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
                  // Multi-window voting (P4M7): average the last few windows so a
                  // borderline sign isn't decided on one noisy window.
                  const buf = probsBufferRef.current
                  buf.push(pred.probs)
                  if (buf.length > VOTE_WINDOWS) buf.shift()
                  const voted = averageProbs(buf)
                  const top = topPrediction(voted, classifier.labels)
                  stabilizerRef.current.push(top.label)
                  setPrediction({
                    label: top.label,
                    confidence: top.confidence,
                    probs: voted,
                  })
                  const tgt = targetRef.current
                  setAccepted(
                    tgt
                      ? accepts(
                          voted,
                          classifier.labels,
                          tgt,
                          acceptThresholdFor(
                            classifier.acceptThresholds,
                            tgt,
                            ACCEPT_THRESHOLD,
                          ),
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
  }, [status, videoEl])

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
    probsBufferRef.current = []
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
    ready,
    labels,
    prediction,
    target,
    setTarget,
    accepted,
    start: handleStart,
    stop: handleStop,
  }
}
