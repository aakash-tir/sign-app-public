import { useCallback, useEffect, useMemo, useState } from 'react'
import { CoursePathSwitch } from './CoursePathSwitch'
import { LetterSession } from './LetterSession'
import { FingerspellStage } from '../../recognition/FingerspellStage'
import { db } from '../../data/db'
import { WordBankRepo } from '../../data/wordBankRepo'
import { CurriculumRepo } from '../../data/curriculumRepo'
import { LETTER_BATCHES } from '../../content/curriculum'
import { LETTER_HINTS } from '../../content/fingerspelling'
import { SHORT_WORDS, spellableWords } from '../../content/words'
import {
  learnedPool,
  routeAccess,
  type CurriculumSet,
} from '../../domain/curriculum'
import type { Rng } from '../../domain/rng'
import type { AttemptOutcome } from '../../domain/types'
import './WordsPathView.css'
import './AlphabetPathView.css'

const defaultWordRepo = new WordBankRepo(db)
const defaultCurriculumRepo = new CurriculumRepo(db)

/** The 24 statically verifiable letters (Q5 — no J/Z). */
const ALPHABET = new Set(Object.keys(LETTER_HINTS))

interface AlphabetPathViewProps {
  repo?: WordBankRepo
  curriculumRepo?: CurriculumRepo
  /** Injected for deterministic tests (frontend rules); UI entry uses Math.random. */
  rng?: Rng
}

/**
 * The learner alphabet path (Phase 6 / P6M6, ADR-029; plan §2.3 path 1):
 * letter batches of 3 drilled by the P6M3 engine (via `LetterSession`, which
 * owns the static-letter camera), linear-with-review (Q3) over the same
 * persisted `curriculumSets` table as the words path. Once every batch is
 * complete, the **spell-words** stage unlocks — short words spelled
 * letter-by-letter with the existing `FingerspellStage`. Additive surface:
 * not the default until the P6M7 shell flip.
 */
export function AlphabetPathView({
  repo = defaultWordRepo,
  curriculumRepo = defaultCurriculumRepo,
  rng = Math.random,
}: AlphabetPathViewProps) {
  const [completedIds, setCompletedIds] = useState<ReadonlySet<string> | null>(
    null,
  )
  const [activeBatch, setActiveBatch] = useState<CurriculumSet | null>(null)
  const [justCompleted, setJustCompleted] = useState<string | null>(null)
  const [spellWord, setSpellWord] = useState<string | null>(null)

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
    () =>
      completedIds ? routeAccess(LETTER_BATCHES, completedIds, ALPHABET) : null,
    [completedIds],
  )
  const pool = useMemo(
    () =>
      completedIds
        ? learnedPool(LETTER_BATCHES, completedIds, ALPHABET)
        : new Set<string>(),
    [completedIds],
  )
  const allDone = access !== null && access.every((a) => a === 'completed')

  const handleAttempt = useCallback(
    (letter: string, outcome: AttemptOutcome) => {
      void repo.recordAttempt(letter, outcome)
    },
    [repo],
  )

  const handleBatchComplete = useCallback(
    (batchId: string) => {
      void curriculumRepo.markCompleted(batchId).then(() => {
        setCompletedIds((prev) => new Set(prev ?? []).add(batchId))
      })
      setActiveBatch(null)
      setJustCompleted(batchId)
    },
    [curriculumRepo],
  )

  const pickSpellWord = useCallback(
    (previous: string | null) => {
      const words = spellableWords(pool)
      const candidates =
        words.length > 1 ? words.filter((w) => w !== previous) : words
      return candidates[Math.floor(rng() * candidates.length)] ?? null
    },
    [pool, rng],
  )

  if (!completedIds || !access) {
    return <p className="words-path-loading">Loading…</p>
  }

  // ---- Session / feedback / spell screens ---------------------------------

  if (activeBatch) {
    return (
      <section className="words-path" aria-label="Alphabet path">
        <h2>Alphabet</h2>
        <button
          type="button"
          className="exit-lesson"
          data-testid="exit-lesson"
          onClick={() => setActiveBatch(null)}
        >
          ← Exit lesson
        </button>
        <LetterSession
          key={activeBatch.id}
          batch={activeBatch}
          alphabet={ALPHABET}
          pool={pool}
          rng={rng}
          onAttempt={handleAttempt}
          onComplete={handleBatchComplete}
        />
      </section>
    )
  }

  if (justCompleted) {
    return (
      <section className="words-path" aria-label="Alphabet path">
        <h2>Alphabet</h2>
        <div className="set-complete" data-testid="batch-complete">
          <p className="feedback-text">
            Batch complete — {justCompleted.split(' ').join(' + ')} 🎉
          </p>
          <button
            type="button"
            data-testid="back-to-alphabet"
            onClick={() => setJustCompleted(null)}
          >
            Back to the alphabet
          </button>
        </div>
      </section>
    )
  }

  if (spellWord) {
    return (
      <section className="words-path" aria-label="Alphabet path">
        <h2>Alphabet</h2>
        <div className="spell-screen" data-testid="spell-screen">
          <FingerspellStage
            key={spellWord}
            word={spellWord.toLowerCase()}
            letters={[...spellWord]}
            showOverlay={false}
          />
          <div className="recall-actions">
            <button
              type="button"
              data-testid="spell-another"
              onClick={() => setSpellWord(pickSpellWord(spellWord))}
            >
              Another word
            </button>
            <button
              type="button"
              className="recall-secondary"
              data-testid="spell-back"
              onClick={() => setSpellWord(null)}
            >
              Back to the alphabet
            </button>
          </div>
        </div>
      </section>
    )
  }

  // ---- The path ------------------------------------------------------------

  const completedCount = access.filter((a) => a === 'completed').length

  return (
    <section className="words-path" aria-label="Alphabet path">
      <h2>Alphabet</h2>
      <CoursePathSwitch />
      <p className="words-path-progress" data-testid="alphabet-progress">
        {completedCount} of {LETTER_BATCHES.length} batches completed
      </p>

      <ul className="path-sets">
        {LETTER_BATCHES.map((batch, i) => {
          const state = access[i] ?? 'locked'
          return (
            <li
              key={batch.id}
              className={`path-set path-set-${state}`}
              data-testid="letter-batch"
              data-state={state}
            >
              <span className="path-set-signs">
                {batch.signs.map((letter) => (
                  <span key={letter} className="path-word path-letter">
                    {letter}
                  </span>
                ))}
              </span>
              {state === 'current' && (
                <button
                  type="button"
                  data-testid="batch-start"
                  onClick={() => setActiveBatch(batch)}
                >
                  Start
                </button>
              )}
              {state === 'completed' && (
                <button
                  type="button"
                  className="path-review"
                  data-testid="batch-review"
                  onClick={() => setActiveBatch(batch)}
                >
                  Review
                </button>
              )}
            </li>
          )
        })}
      </ul>

      <div
        className={`path-set spell-card${allDone ? '' : ' path-set-locked'}`}
        data-testid="spell-card"
      >
        <span className="path-set-signs">
          <span className="path-word">Spell words</span>
          <span className="path-soon-note">
            {allDone
              ? `${SHORT_WORDS.length} short words`
              : 'finish the alphabet to unlock'}
          </span>
        </span>
        {allDone && (
          <button
            type="button"
            data-testid="spell-start"
            onClick={() => setSpellWord(pickSpellWord(null))}
          >
            Start
          </button>
        )}
      </div>
    </section>
  )
}
