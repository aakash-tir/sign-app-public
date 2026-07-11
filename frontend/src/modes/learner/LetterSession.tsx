import { useCallback, useEffect, useRef, useState } from 'react'
import { useUnifiedSignRecognition } from '../../recognition/useUnifiedSignRecognition'
import { CameraPlaceholder } from '../../recognition/CameraPlaceholder'
import { LETTER_HINTS } from '../../content/fingerspelling'
import type { CurriculumSet } from '../../domain/curriculum'
import {
  confirmTaught,
  nextRecallPrompt,
  recallProgress,
  recordRecallOutcome,
  startRecallSession,
} from '../../domain/recall'
import type { Rng } from '../../domain/rng'
import type { AttemptOutcome } from '../../domain/types'

interface LetterSessionProps {
  /** The letter batch to drill (2–3 letters, content/curriculum.ts). */
  batch: CurriculumSet
  /** The 24 recognizable letters (the engine's `recognized` set). */
  alphabet: ReadonlySet<string>
  /** Learned letters from completed batches — the recall-review pool. */
  pool: ReadonlySet<string>
  rng: Rng
  /** Word-bank write per attempt (buckets, ADR-008) — parent owns the repo. */
  onAttempt: (letter: string, outcome: AttemptOutcome) => void
  /** The batch's recall target is met — parent persists and switches screens. */
  onComplete: (batchId: string) => void
}

/**
 * One letter batch's teach → recall session (Phase 6 / P6M6, ADR-029), driven
 * by the P6M3 recall engine over the **static fingerspelling recognizer**
 * (letter mode of the unified hook, like LearnMode). Owns its camera hook, so
 * it must be the only recognition surface mounted — the parent unmounts it
 * before showing the FingerspellStage spell screen. Learners see clean video
 * (no landmark overlay, plan §3). A letter's "reference" is its LETTER_HINTS
 * text — the stick-figure player has no letter clips yet.
 */
export function LetterSession({
  batch,
  alphabet,
  pool,
  rng,
  onAttempt,
  onComplete,
}: LetterSessionProps) {
  const {
    videoRef,
    canvasRef,
    status,
    error,
    trackerError,
    ready,
    recognized,
    start,
    setMode,
    reset,
  } = useUnifiedSignRecognition()

  const [session, setSession] = useState(() =>
    startRecallSession(batch, alphabet),
  )
  const [revealedLetter, setRevealedLetter] = useState<string | null>(null)
  const committingRef = useRef(false)
  const completedRef = useRef(false)

  useEffect(() => {
    setMode('letter')
  }, [setMode])

  // Handlers read `session` by value — updaters must stay pure (StrictMode
  // double-invokes them in dev; same reasoning as WordsPathView).
  const handleTaught = useCallback(() => {
    let next = confirmTaught(session)
    if (next.phase === 'recall') next = nextRecallPrompt(next, pool, rng)
    committingRef.current = false
    reset()
    setSession(next)
  }, [session, pool, rng, reset])

  const handleOutcome = useCallback(
    (outcome: AttemptOutcome) => {
      if (session.phase !== 'recall' || !session.prompt) return
      const letter = session.prompt.sign
      onAttempt(letter, outcome)
      const next = recordRecallOutcome(session, outcome)
      if (next.phase === 'complete') {
        if (!completedRef.current) {
          completedRef.current = true
          onComplete(next.setId)
        }
        setSession(next)
        return
      }
      if (outcome === 'wrong') {
        // "I forgot" — pause on the hint (ADR-008: already recorded wrong).
        setRevealedLetter(letter)
        setSession(next)
        return
      }
      committingRef.current = false
      reset()
      setSession(nextRecallPrompt(next, pool, rng))
    },
    [session, pool, rng, onAttempt, onComplete, reset],
  )

  const handleRevealContinue = useCallback(() => {
    setRevealedLetter(null)
    committingRef.current = false
    reset()
    setSession(nextRecallPrompt(session, pool, rng))
  }, [session, pool, rng, reset])

  // The recognizer settled on the prompted letter → a correct recall. The
  // committing ref stops re-fires until the next prompt re-arms it (the
  // debounced `recognized` can repeat across renders); reveals are inert.
  useEffect(() => {
    if (session.phase !== 'recall' || !session.prompt) return
    if (revealedLetter !== null || committingRef.current) return
    if (recognized && recognized.label === session.prompt.sign) {
      committingRef.current = true
      // Reacting to the external recognizer is the legitimate effect case —
      // same pattern (and disable) as FingerspellStage's letter advance.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleOutcome('correct')
    }
  }, [recognized, session, revealedLetter, handleOutcome])

  const teaching = session.phase === 'teach' ? session.teaching : null
  const teachMatch =
    teaching !== null && recognized !== null && recognized.label === teaching

  const camera = (
    <>
      <div className="camera-stage">
        <video ref={videoRef} className="camera-video" playsInline muted />
        <canvas ref={canvasRef} className="camera-overlay camera-overlay-off" />
        {status === 'idle' && <CameraPlaceholder />}
      </div>
      {status === 'idle' && (
        <button type="button" onClick={start}>
          Enable camera
        </button>
      )}
      {status === 'starting' && <p role="status">Starting camera…</p>}
      {status === 'on' && !ready && (
        <p role="status" data-testid="model-loading">
          Preparing recognition…
        </p>
      )}
      {status === 'error' && (
        <p role="alert" data-testid="camera-error">
          {error ?? 'Camera error.'}
        </p>
      )}
      {trackerError && <p className="tracker-error">{trackerError}</p>}
    </>
  )

  if (teaching) {
    return (
      <div className="teach-card" data-testid="letter-teach-card">
        <p className="teach-cue">New letter</p>
        <p className="teach-word" data-testid="letter-teach">
          {teaching}
        </p>
        <p className="letter-hint" data-testid="letter-hint">
          {LETTER_HINTS[teaching] ?? 'Form the letter with your hand.'}
        </p>
        {camera}
        {teachMatch && (
          <p className="letter-match" role="status" data-testid="letter-match">
            That&apos;s it! ✅
          </p>
        )}
        <button
          type="button"
          data-testid="letter-teach-next"
          onClick={handleTaught}
        >
          Got it — next
        </button>
      </div>
    )
  }

  if (session.phase === 'recall') {
    const progress = recallProgress(session)
    return (
      <div className="letter-recall">
        <p className="recall-progress" data-testid="letter-recall-progress">
          {progress.done} of {progress.total} recalls
        </p>

        {revealedLetter ? (
          <div className="recall-reveal" data-testid="letter-reveal">
            <p className="recall-cue">
              Here&apos;s “{revealedLetter}” again — try it, then continue.
            </p>
            <p className="letter-hint">
              {LETTER_HINTS[revealedLetter] ??
                'Form the letter with your hand.'}
            </p>
            {camera}
            <button
              type="button"
              data-testid="letter-continue"
              onClick={handleRevealContinue}
            >
              Continue
            </button>
          </div>
        ) : (
          session.prompt && (
            <>
              <p className="recall-cue">
                {session.prompt.kind === 'review'
                  ? 'Quick review — sign the letter:'
                  : 'Your turn — sign the letter:'}
              </p>
              <p className="recall-word" data-testid="letter-recall-prompt">
                {session.prompt.sign}
              </p>
              {camera}
              <div className="recall-actions">
                <button
                  type="button"
                  data-testid="letter-valve"
                  onClick={() => handleOutcome('correct')}
                >
                  That&apos;s what I did
                </button>
                <button
                  type="button"
                  className="recall-secondary"
                  data-testid="letter-forgot"
                  onClick={() => handleOutcome('wrong')}
                >
                  I forgot — show me
                </button>
              </div>
            </>
          )
        )}
      </div>
    )
  }

  return null
}
