import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraStatus = 'idle' | 'starting' | 'on' | 'error'

export interface UseCamera {
  videoRef: React.RefObject<HTMLVideoElement | null>
  status: CameraStatus
  error: string | null
  start: () => Promise<void>
  stop: () => void
}

/**
 * Manages the device camera via getUserMedia, with permission/error handling.
 * Always releases the MediaStream tracks on stop and on unmount.
 */
export function useCamera(): UseCamera {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setStatus('idle')
  }, [])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is not available in this browser.')
      setStatus('error')
      return
    }
    setStatus('starting')
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play()
      }
      setStatus('on')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to access camera.')
      setStatus('error')
    }
  }, [])

  // Release the camera when the component using this hook unmounts.
  useEffect(() => stop, [stop])

  return { videoRef, status, error, start, stop }
}
