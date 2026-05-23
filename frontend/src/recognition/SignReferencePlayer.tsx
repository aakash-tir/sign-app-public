import { useEffect, useRef, useState } from 'react'
import { drawHolistic } from './drawHolistic'
import { getOverlayColorMode } from './overlayColorMode'
import { loadSignReference } from './signReferenceData'
import type { HolisticObservation } from './dynamicTypes'
import './SignReferencePlayer.css'

const PLAYBACK_FPS_MS = 1000 / 12

type Status = 'loading' | 'ready' | 'error'

/**
 * In-app, offline reference for a dynamic sign: a looping landmark animation
 * rendered with the same overlay the learner sees live (P2M4, replaces the old
 * external-dictionary link, ADR-017).
 */
export function SignReferencePlayer({ gloss }: { gloss: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const framesRef = useRef<HolisticObservation[]>([])
  const [status, setStatus] = useState<Status>('loading')

  // Load the clip whenever the gloss changes.
  useEffect(() => {
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus('loading')
    loadSignReference(gloss)
      .then((frames) => {
        if (!active) return
        framesRef.current = frames
        setStatus(frames.length > 0 ? 'ready' : 'error')
      })
      .catch(() => {
        if (active) setStatus('error')
      })
    return () => {
      active = false
    }
  }, [gloss])

  // Loop the frames onto the canvas once loaded.
  useEffect(() => {
    if (status !== 'ready') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let frame = 0
    let last = 0
    const loop = (now: number) => {
      if (now - last >= PLAYBACK_FPS_MS) {
        last = now
        const frames = framesRef.current
        const obs = frames[frame % frames.length]
        if (obs) {
          drawHolistic(
            ctx,
            obs,
            canvas.width,
            canvas.height,
            getOverlayColorMode(),
          )
        }
        frame++
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [status])

  return (
    <figure className="sign-reference" data-testid="sign-reference">
      <canvas
        ref={canvasRef}
        width={320}
        height={240}
        className="sign-reference-canvas"
      />
      <figcaption className="sign-reference-caption">
        {status === 'error'
          ? `Reference for “${gloss}” isn’t available offline yet.`
          : `How to sign “${gloss}”`}
      </figcaption>
    </figure>
  )
}
