import { useCallback, useEffect, useRef } from 'react'
import { useCameraContext, type CameraStatus } from './cameraContext'

export type { CameraStatus }

export interface UseCamera {
  /** Callback ref to attach to the `<video>` element. */
  videoRef: React.RefCallback<HTMLVideoElement>
  /** The current `<video>` node, for the render loop to read. */
  videoEl: React.RefObject<HTMLVideoElement | null>
  status: CameraStatus
  error: string | null
  start: () => void
  stop: () => void
}

function attachStream(
  node: HTMLVideoElement,
  stream: MediaStream | null,
): void {
  if (stream) {
    if (node.srcObject !== stream) {
      node.srcObject = stream
      try {
        const played = node.play?.()
        if (played) void played.catch(() => {})
      } catch {
        /* play() can reject/throw transiently (e.g. jsdom); the loop tolerates it */
      }
    }
  } else {
    node.srcObject = null
  }
}

/**
 * Adapter over the app-level {@link CameraProvider} (ADR-018): wires the single
 * shared `MediaStream` to this view's `<video>` and re-exposes the shared
 * status/controls. Because the provider owns the stream (mounted above the
 * router), it **survives view switches** — so this hook never calls
 * `getUserMedia` and never stops the camera on unmount.
 *
 * Uses a **callback ref** so a `<video>` that mounts *after* the stream is
 * already on (e.g. behind a "Loading…" gate in Practice/Learn) still gets the
 * stream attached the moment it appears. The loop reads {@link videoEl}.
 */
export function useCamera(): UseCamera {
  const { stream, status, error, start, stop } = useCameraContext()
  const videoEl = useRef<HTMLVideoElement | null>(null)

  const videoRef = useCallback<React.RefCallback<HTMLVideoElement>>(
    (node) => {
      videoEl.current = node
      if (node) attachStream(node, stream)
    },
    [stream],
  )

  // Re-attach to an already-mounted node when the stream changes (enable/disable).
  useEffect(() => {
    if (videoEl.current) attachStream(videoEl.current, stream)
  }, [stream])

  return { videoRef, videoEl, status, error, start, stop }
}
