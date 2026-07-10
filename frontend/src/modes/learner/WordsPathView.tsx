import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDynamicSignRecognition } from '../../recognition/useDynamicSignRecognition'
import { DynamicSignStage } from '../../recognition/DynamicSignStage'
import { SignReferencePlayer } from '../../recognition/SignReferencePlayer'
import { db } from '../../data/db'
import { WordBankRepo } from '../../data/wordBankRepo'
import { CurriculumRepo } from '../../data/curriculumRepo'
import { WORD_UNITS } from '../../content/curriculum'
import { SHIPPED_GLOSSES } from '../../content/dynamicVocab'
import {
  flattenRoute,
  learnedPool,
  routeAccess,
  wordStatus,
  type CurriculumSet,
} from '../../domain/curriculum'
import {
  confirmTaught,
  nextRecallPrompt,
  recallProgress,
  recordRecallOutcome,
  startRecallSession,
  type RecallSession,
} from '../../domain/recall'
import type { Rng } from '../../domain/rng'
import type { AttemptOutcome } from '../../domain/types'
import './WordsPathView.css'

const defaultWordRepo = new WordBankRepo(db)
const defaultCurriculumRepo = new CurriculumRepo(db)

const RECOGNIZED = new Set(SHIPPED_GLOSSES)
const ROUTE = flattenRoute(WORD_UNITS)

interface WordsPathViewProps {
  repo?: WordBankRepo
  curriculumRepo?: CurriculumRepo
  /** Injected for deterministic tests (frontend rules); UI entry uses Math.random. */
  rng?: Rng
}

/**
 * The learner words path (Phase 6 / P6M4, ADR-029): the curriculum route as a
 * linear-with-review list of units and sets (Q3), each set drilled by the
 * P6M3 teach → recall engine — teach card (stick-figure reference + camera
 * "try it"), recall prompts with the "I forgot → show me" reveal (ADR-008:
 * forgot records `wrong`) and the "That's what I did" valve, pool reviews
 * interleaved. Learners see clean video — no landmark overlay (plan §3).
 * Placeholder words (Q6) render as "coming soon" and are never taught.
 * Additive surface: not the default view until the P6M7 shell flip.
 */
export function WordsPathView({
  repo = defaultWordRepo,
  curriculumRepo = defaultCurriculumRepo,
  rng = Math.random,
}: WordsPathViewProps) {
  const recognition = useDynamicSignRecognition()
  const { setTarget, accepted } = recognition

  const [completedIds, setCompletedIds] = useState<ReadonlySet<string> | null>(
    null,
  )
  const [session, setSession] = useState<RecallSession | null>(null)
  const [revealedSign, setRevealedSign] = useState<string | null>(null)
  const recordingRef = useRef(false)

  useEffect(() => {
    let active = true
    void curriculumRepo.completedIds().then((ids) => {
      if (active) setCompletedIds(ids)
    })
    return () => {
      active = false
    }
  }, [curriculumRepo])

  const access = useMemo(
    () => (completedIds ? routeAccess(ROUTE, completedIds, RECOGNIZED) : null),
    [completedIds],
  )
  // Set ids are unique (test-enforced), so access states key cleanly by id.
  const accessById = useMemo(
    () =>
      access
        ? new Map(ROUTE.map((set, i) => [set.id, access[i] ?? 'locked']))
        : null,
    [access],
  )
  const pool = useMemo(
    () =>
      completedIds
        ? learnedPool(ROUTE, completedIds, RECOGNIZED)
        : new Set<string>(),
    [completedIds],
  )

  // The sign the recognizer should verify right now. During a reveal the
  // target stays on the revealed sign so the learner can retry with feedback;
  // acceptance there is encouragement only (no prompt is active).
  const sessionTarget =
    revealedSign ??
    (session?.phase === 'teach'
      ? session.teaching
      : (session?.prompt?.sign ?? null))
  useEffect(() => {
    setTarget(sessionTarget)
  }, [sessionTarget, setTarget])

  const handleStartSet = useCallback((set: CurriculumSet) => {
    recordingRef.current = false
    setRevealedSign(null)
    setSession(startRecallSession(set, RECOGNIZED))
  }, [])

  // Handlers below read `session` by value (not via updater functions):
  // updaters must stay pure — StrictMode double-invokes them in dev, which
  // would double-advance the teach queue and double-record attempts.
  const handleTaught = useCallback(() => {
    if (!session) return
    let next = confirmTaught(session)
    if (next.phase === 'recall') next = nextRecallPrompt(next, pool, rng)
    setSession(next)
  }, [session, pool, rng])

  const finishSet = useCallback(
    (setId: string) => {
      if (recordingRef.current) return
      recordingRef.current = true
      void curriculumRepo.markCompleted(setId).then(() => {
        setCompletedIds((prev) => new Set(prev ?? []).add(setId))
      })
    },
    [curriculumRepo],
  )

  const handleOutcome = useCallback(
    (outcome: AttemptOutcome) => {
      if (!session || session.phase !== 'recall' || !session.prompt) return
      const sign = session.prompt.sign
      void repo.recordAttempt(sign, outcome)
      const next = recordRecallOutcome(session, outcome)
      if (next.phase === 'complete') {
        finishSet(next.setId)
        setSession(next)
        return
      }
      if (outcome === 'wrong') {
        // "I forgot" — pause on the reference (ADR-008: already recorded as
        // wrong); the next prompt is issued when the learner continues.
        setRevealedSign(sign)
        setSession(next)
        return
      }
      setSession(nextRecallPrompt(next, pool, rng))
    },
    [session, repo, pool, rng, finishSet],
  )

  const handleRevealContinue = useCallback(() => {
    if (!session) return
    setRevealedSign(null)
    setSession(nextRecallPrompt(session, pool, rng))
  }, [session, pool, rng])

  // The recognizer accepted the target (per-sign bar, ADR-025) → a correct
  // recall. Rising-edge only (same guard as SentencesView): the still-true
  // flag would otherwise double-fire on the next prompt. Reveals are inert.
  const prevAcceptedRef = useRef(false)
  useEffect(() => {
    const wasAccepted = prevAcceptedRef.current
    prevAcceptedRef.current = accepted
    if (accepted && !wasAccepted && revealedSign === null) {
      handleOutcome('correct')
    }
  }, [accepted, revealedSign, handleOutcome])

  if (!completedIds || !access) {
    return <p className="words-path-loading">Loading…</p>
  }

  // ---- Session screens ----------------------------------------------------

  if (session && session.phase === 'complete') {
    return (
      <section className="words-path" aria-label="Words path">
        <h2>Words</h2>
        <div className="set-complete" data-testid="set-complete">
          <p className="feedback-text">
            Set complete — {session.newSigns.join(' + ')} 🎉
          </p>
          <button
            type="button"
            data-testid="back-to-path"
            onClick={() => setSession(null)}
          >
            Back to the path
          </button>
        </div>
      </section>
    )
  }

  if (session && session.phase === 'teach' && session.teaching) {
    return (
      <section className="words-path" aria-label="Words path">
        <h2>Words</h2>
        <div className="teach-card" data-testid="teach-card">
          <p className="teach-cue">New word</p>
          <p className="teach-word" data-testid="teach-word">
            {session.teaching}
          </p>
          <div className="teach-reference">
            <SignReferencePlayer gloss={session.teaching} />
          </div>
          <DynamicSignStage
            recognition={recognition}
            ariaLabel={`Try the sign “${session.teaching}”`}
            showReference={false}
            showOverlay={false}
          />
          <button type="button" data-testid="teach-next" onClick={handleTaught}>
            Got it — next
          </button>
        </div>
      </section>
    )
  }

  if (session && session.phase === 'recall') {
    const progress = recallProgress(session)
    return (
      <section className="words-path" aria-label="Words path">
        <h2>Words</h2>
        <p className="recall-progress" data-testid="recall-progress">
          {progress.done} of {progress.total} recalls
        </p>

        {revealedSign ? (
          <div className="recall-reveal" data-testid="recall-reveal">
            <p className="recall-cue">
              Here&apos;s “{revealedSign}” again — try it, then continue.
            </p>
            <SignReferencePlayer gloss={revealedSign} />
            <DynamicSignStage
              recognition={recognition}
              ariaLabel={`Practice the sign “${revealedSign}”`}
              showReference={false}
              showOverlay={false}
            />
            <button
              type="button"
              data-testid="recall-continue"
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
                  ? 'Quick review — sign:'
                  : 'Your turn — sign:'}
              </p>
              <p className="recall-word" data-testid="recall-prompt">
                {session.prompt.sign}
              </p>
              <DynamicSignStage
                recognition={recognition}
                ariaLabel={`Sign the word “${session.prompt.sign}”`}
                showReference={false}
                showOverlay={false}
              />
              <div className="recall-actions">
                <button
                  type="button"
                  data-testid="recall-valve"
                  onClick={() => handleOutcome('correct')}
                >
                  That&apos;s what I did
                </button>
                <button
                  type="button"
                  className="recall-secondary"
                  data-testid="recall-forgot"
                  onClick={() => handleOutcome('wrong')}
                >
                  I forgot — show me
                </button>
              </div>
            </>
          )
        )}
      </section>
    )
  }

  // ---- The path -----------------------------------------------------------

  const completedCount = access.filter((a) => a === 'completed').length
  const totalTeachable = access.filter((a) => a !== 'placeholder').length

  return (
    <section className="words-path" aria-label="Words path">
      <h2>Words</h2>
      <p className="words-path-progress" data-testid="words-path-progress">
        {completedCount} of {totalTeachable} sets completed
      </p>

      {WORD_UNITS.map((unit) => (
        <div key={unit.id} className="path-unit">
          <h3 className="path-unit-title">{unit.title}</h3>
          <ul className="path-sets">
            {unit.sets.map((set) => {
              const state = accessById?.get(set.id) ?? 'locked'
              return (
                <li
                  key={set.id}
                  className={`path-set path-set-${state}`}
                  data-testid="path-set"
                  data-state={state}
                >
                  <span className="path-set-signs">
                    {set.signs.map((sign) => (
                      <span
                        key={sign}
                        className={
                          wordStatus(sign, RECOGNIZED) === 'placeholder'
                            ? 'path-word path-word-soon'
                            : 'path-word'
                        }
                      >
                        {sign}
                      </span>
                    ))}
                  </span>
                  {state === 'placeholder' && (
                    <span className="path-soon-note">coming soon</span>
                  )}
                  {state === 'current' && (
                    <button
                      type="button"
                      data-testid="set-start"
                      onClick={() => handleStartSet(set)}
                    >
                      Start
                    </button>
                  )}
                  {state === 'completed' && (
                    <button
                      type="button"
                      className="path-review"
                      data-testid="set-review"
                      onClick={() => handleStartSet(set)}
                    >
                      Review
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}
