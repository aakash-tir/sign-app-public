import { useCallback, useEffect, useRef, useState } from 'react'
import { useSignRecognition } from '../../recognition/useSignRecognition'
import { fingerspellingModel } from '../../recognition/signClassifier'
import { db } from '../../data/db'
import { WordBankRepo } from '../../data/wordBankRepo'
import { PracticeSession } from '../../domain/selection'
import type { AttemptOutcome, WordProgress } from '../../domain/types'
import { LETTER_HINTS } from '../../content/fingerspelling'
import './PracticeMode.css'

type Phase = 'loading' | 'signing' | 'revealed' | 'correct'

const defaultRepo = new WordBankRepo(db)

export function PracticeMode({ repo = defaultRepo }: { repo?: WordBankRepo }) {
  const {
    videoRef,
    canvasRef,
    status: cameraStatus,
    trackerError,
    prediction,
    start: startCamera,
    resetPrediction,
  } = useSignRecognition()

  const sessionRef = useRef(new PracticeSession())
  const committingRef = useRef(false)
  const [bank, setBank] = useState<WordProgress[]>([])
  const [current, setCurrent] = useState<WordProgress | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')

  const advance = useCallback(
    (fromBank: WordProgress[]) => {
      const next = sessionRef.current.next(fromBank)
      setCurrent(next)
      setPhase('signing')
      committingRef.current = false
      resetPrediction()
    },
    [resetPrediction],
  )

  // Seed + load + pick the first word on mount.
  useEffect(() => {
    let active = true
    void (async () => {
      await repo.ensureSeeded(fingerspellingModel.labels)
      const all = await repo.allProgress()
      if (!active) return
      setBank(all)
      const first = sessionRef.current.next(all)
      setCurrent(first)
      setPhase(first ? 'signing' : 'loading')
    })()
    return () => {
      active = false
    }
  }, [repo])

  // Commit one attempt outcome (deferred-commit per ADR-008).
  const commit = useCallback(
    async (outcome: AttemptOutcome) => {
      if (!current || committingRef.current) return
      committingRef.current = true
      await repo.recordAttempt(current.wordId, outcome)
      const all = await repo.allProgress()
      setBank(all)
      if (outcome === 'correct') {
        setPhase('correct')
      } else {
        advance(all)
      }
    },
    [current, repo, advance],
  )

  // Camera recognized the target letter -> correct. Reacts to a new debounced
  // prediction from the recognition loop; guarded by phase + committingRef so it
  // commits at most once per attempt.
  useEffect(() => {
    if (phase !== 'signing' || !current) return
    if (prediction && prediction.label === current.wordId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void commit('correct')
    }
  }, [prediction, phase, current, commit])

  if (phase === 'loading' || !current) {
    return <p className="practice-loading">Loading practice…</p>
  }

  const target = current.wordId
  const hint = LETTER_HINTS[target] ?? 'Form the letter with your hand.'
  const confidentCount = bank.filter((w) => w.bucket === 'confident').length

  return (
    <section className="practice" aria-label="Practice">
      <p className="practice-progress" data-testid="practice-progress">
        Confident: {confidentCount} / {bank.length}
      </p>

      <div className="practice-prompt">
        <span className="practice-cue">Sign this letter</span>
        <span className="practice-target" data-testid="practice-target">
          {target}
        </span>
      </div>

      <div className="camera-stage">
        <video ref={videoRef} className="camera-video" playsInline muted />
        <canvas ref={canvasRef} className="camera-overlay" />
      </div>

      {cameraStatus === 'idle' && (
        <button type="button" onClick={startCamera}>
          Enable camera
        </button>
      )}
      {cameraStatus === 'starting' && <p role="status">Starting camera…</p>}
      {trackerError && <p className="tracker-error">{trackerError}</p>}

      {phase === 'signing' && (
        <button
          type="button"
          className="practice-secondary"
          data-testid="i-forgot"
          onClick={() => setPhase('revealed')}
        >
          I forgot
        </button>
      )}

      {phase === 'revealed' && (
        <div className="practice-reveal" data-testid="reveal">
          <p className="reveal-hint">{hint}</p>
          <button
            type="button"
            data-testid="thats-what-i-did"
            onClick={() => void commit('correct')}
          >
            That&apos;s what I did
          </button>
          <button
            type="button"
            className="practice-secondary"
            data-testid="reveal-next"
            onClick={() => void commit('wrong')}
          >
            Next
          </button>
        </div>
      )}

      {phase === 'correct' && (
        <div className="practice-feedback" data-testid="correct-feedback">
          <p className="feedback-text">Correct! ✅</p>
          <button
            type="button"
            data-testid="next-word"
            onClick={() => advance(bank)}
          >
            Next word
          </button>
        </div>
      )}
    </section>
  )
}
