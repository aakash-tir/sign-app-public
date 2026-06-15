import { useEffect, useState } from 'react'
import { useUnifiedSignRecognition } from './useUnifiedSignRecognition'
import { CameraPlaceholder } from './CameraPlaceholder'
import { LETTER_HINTS } from '../content/fingerspelling'
import './FingerspellStage.css'

/**
 * Spell a word letter-by-letter with the static fingerspelling recognizer
 * (P4M9). Used as the search fallback when a typed word isn't a shipped dynamic
 * sign but can be fingerspelled. Owns its own camera + recognition hook so the
 * recognizer only spins up when the learner opts into spelling (the hook mounts
 * with the component). Advances on the recognized letter, mirroring the Learn
 * "Spell words" drill.
 */
export function FingerspellStage({
  letters,
  word,
}: {
  letters: string[]
  word: string
}) {
  const {
    videoRef,
    canvasRef,
    status: cameraStatus,
    trackerError,
    ready: cameraReady,
    recognized,
    start: startCamera,
    setMode,
  } = useUnifiedSignRecognition()

  const [index, setIndex] = useState(0)
  const [done, setDone] = useState(false)

  // Static letters only.
  useEffect(() => {
    setMode('letter')
  }, [setMode])

  // Advance as each letter is recognized.
  useEffect(() => {
    if (done) return
    if (recognized && recognized.label === letters[index]) {
      const next = index + 1
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIndex(next)
      if (next >= letters.length) setDone(true)
    }
  }, [recognized, done, letters, index])

  const restart = () => {
    setIndex(0)
    setDone(false)
  }

  const current = letters[index]

  return (
    <div className="fingerspell-stage" data-testid="fingerspell-stage">
      <p className="fingerspell-cue">Fingerspell it letter by letter</p>
      <div className="spell-word" data-testid="fingerspell-word">
        {letters.map((letter, i) => (
          <span
            key={`${letter}-${i}`}
            className={i < index ? 'spell-letter done' : 'spell-letter'}
          >
            {letter}
          </span>
        ))}
      </div>

      {!done && current && (
        <p className="fingerspell-hint">
          <strong>{current}</strong> —{' '}
          {LETTER_HINTS[current] ?? 'Form the letter with your hand.'}
        </p>
      )}

      <div className="camera-stage">
        <video ref={videoRef} className="camera-video" playsInline muted />
        <canvas ref={canvasRef} className="camera-overlay" />
        {cameraStatus === 'idle' && <CameraPlaceholder />}
      </div>
      {cameraStatus === 'idle' && (
        <button type="button" onClick={startCamera}>
          Enable camera
        </button>
      )}
      {cameraStatus === 'starting' && <p role="status">Starting camera…</p>}
      {cameraStatus === 'on' && !cameraReady && (
        <p role="status" data-testid="model-loading">
          Preparing recognition…
        </p>
      )}
      {trackerError && <p className="tracker-error">{trackerError}</p>}

      {done && (
        <div className="learn-feedback" data-testid="fingerspell-done">
          <p className="feedback-text">Nice — you spelled “{word}”! ✅</p>
          <button type="button" onClick={restart}>
            Spell it again
          </button>
        </div>
      )}
    </div>
  )
}
