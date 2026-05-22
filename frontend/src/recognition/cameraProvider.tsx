import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { db } from '../data/db'
import { WordBankRepo } from '../data/wordBankRepo'
import { CameraContext, type CameraStatus } from './cameraContext'
import './cameraContext.css'

const defaultRepo = new WordBankRepo(db)

/**
 * Owns the **single** device camera for the whole app, mounted above the router
 * so the stream survives view switches (ADR-018, FR-15). Shows a one-time privacy
 * explainer before the first acquire and remembers it
 * (`profile.cameraExplainerSeen`). Releases the device on `stop()` and on app
 * teardown — but never on a view unmount.
 */
export function CameraProvider({
  children,
  repo = defaultRepo,
}: {
  children: ReactNode
  repo?: WordBankRepo
}) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [explainerOpen, setExplainerOpen] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const explainerSeenRef = useRef(false)

  // Load the one-time-explainer flag from the persisted profile (best-effort).
  useEffect(() => {
    let active = true
    void repo
      .getProfile()
      .then((profile) => {
        if (active) explainerSeenRef.current = profile.cameraExplainerSeen
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [repo])

  const setActiveStream = useCallback((next: MediaStream | null) => {
    streamRef.current = next
    setStream(next)
  }, [])

  const enableNow = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is not available in this browser.')
      setStatus('error')
      return
    }
    setStatus('starting')
    setError(null)
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })
      setActiveStream(next)
      setStatus('on')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to access camera.')
      setStatus('error')
    }
  }, [setActiveStream])

  const start = useCallback(() => {
    if (explainerSeenRef.current) {
      void enableNow()
    } else {
      setExplainerOpen(true)
    }
  }, [enableNow])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    setActiveStream(null)
    setStatus('idle')
  }, [setActiveStream])

  const confirmExplainer = useCallback(() => {
    explainerSeenRef.current = true
    void repo.setCameraExplainerSeen(true).catch(() => {})
    setExplainerOpen(false)
    void enableNow()
  }, [enableNow, repo])

  const cancelExplainer = useCallback(() => {
    setExplainerOpen(false)
  }, [])

  // Release the device if the whole app tears down.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  return (
    <CameraContext.Provider value={{ stream, status, error, start, stop }}>
      {children}
      {explainerOpen && (
        <div
          className="camera-explainer-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="camera-explainer-title"
          data-testid="camera-explainer"
        >
          <div className="camera-explainer">
            <h2 id="camera-explainer-title">
              Your camera stays on your device
            </h2>
            <p>
              Sign App uses your camera to watch your hands and check your
              signs. The video is processed entirely on your device — it is
              never recorded, stored, or uploaded. You can turn the camera off
              at any time.
            </p>
            <div className="camera-explainer-actions">
              <button
                type="button"
                className="camera-explainer-secondary"
                data-testid="camera-explainer-cancel"
                onClick={cancelExplainer}
              >
                Not now
              </button>
              <button
                type="button"
                data-testid="camera-explainer-continue"
                onClick={confirmExplainer}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </CameraContext.Provider>
  )
}
