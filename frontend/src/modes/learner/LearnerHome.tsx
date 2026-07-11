import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../data/db'
import { CurriculumRepo } from '../../data/curriculumRepo'
import { LETTER_BATCHES, WORD_UNITS } from '../../content/curriculum'
import { LETTER_HINTS } from '../../content/fingerspelling'
import { SHIPPED_GLOSSES } from '../../content/dynamicVocab'
import { flattenRoute, routeAccess } from '../../domain/curriculum'
import './LearnerHome.css'

const defaultCurriculumRepo = new CurriculumRepo(db)

const RECOGNIZED = new Set(SHIPPED_GLOSSES)
const ALPHABET = new Set(Object.keys(LETTER_HINTS))
const WORD_ROUTE = flattenRoute(WORD_UNITS)

interface LearnerHomeProps {
  curriculumRepo?: CurriculumRepo
}

/**
 * The learner home (Phase 6 / P6M7, ADR-029): "continue where you left off" —
 * both always-open paths with live progress and one primary Continue action,
 * plus the sentence and search surfaces. This is the app's default view; the
 * developer surfaces live behind the dev-mode setting (Q2).
 */
export function LearnerHome({
  curriculumRepo = defaultCurriculumRepo,
}: LearnerHomeProps) {
  const [completedIds, setCompletedIds] = useState<ReadonlySet<string> | null>(
    null,
  )

  useEffect(() => {
    let active = true
    void curriculumRepo.completedIds().then((ids) => {
      if (active) setCompletedIds(ids)
    })
    return () => {
      active = false
    }
  }, [curriculumRepo])

  const summary = useMemo(() => {
    if (!completedIds) return null
    const wordAccess = routeAccess(WORD_ROUTE, completedIds, RECOGNIZED)
    const letterAccess = routeAccess(LETTER_BATCHES, completedIds, ALPHABET)
    const wordsDone = wordAccess.filter((a) => a === 'completed').length
    const wordsTotal = wordAccess.filter((a) => a !== 'placeholder').length
    const lettersDone = letterAccess.filter((a) => a === 'completed').length
    const nextWordSet =
      WORD_ROUTE[wordAccess.indexOf('current')]?.signs.join(' + ') ?? null
    const nextBatch =
      LETTER_BATCHES[letterAccess.indexOf('current')]?.signs.join(' ') ?? null
    return { wordsDone, wordsTotal, lettersDone, nextWordSet, nextBatch }
  }, [completedIds])

  if (!summary) {
    return <p className="home-loading">Loading…</p>
  }

  const { wordsDone, wordsTotal, lettersDone, nextWordSet, nextBatch } = summary
  const started = wordsDone > 0 || lettersDone > 0

  return (
    <section className="learner-home" aria-label="Home">
      <div className="home-hero" data-testid="home-hero">
        <h2>{started ? 'Welcome back 👋' : 'Learn sign language 👋'}</h2>
        <p className="home-tagline">
          Short lessons, your camera checks every sign — all on your device.
        </p>
        <Link
          to="/course"
          className="home-continue"
          data-testid="home-continue"
        >
          {started ? 'Continue learning' : 'Start learning'}
        </Link>
      </div>

      <div className="home-cards">
        <Link to="/course" className="home-card" data-testid="home-words-card">
          <h3>Words</h3>
          <p className="home-card-progress">
            {wordsDone} of {wordsTotal} sets
          </p>
          <p className="home-card-next">
            {nextWordSet ? `Next: ${nextWordSet}` : 'All sets complete 🎉'}
          </p>
        </Link>

        <Link
          to="/course/alphabet"
          className="home-card"
          data-testid="home-alphabet-card"
        >
          <h3>Alphabet</h3>
          <p className="home-card-progress">
            {lettersDone} of {LETTER_BATCHES.length} batches
          </p>
          <p className="home-card-next">
            {nextBatch ? `Next: ${nextBatch}` : 'Spell words unlocked 🎉'}
          </p>
        </Link>

        <Link
          to="/sentences"
          className="home-card"
          data-testid="home-sentences-card"
        >
          <h3>Sentences</h3>
          <p className="home-card-next">Use your signs in real sequences</p>
        </Link>

        <Link to="/search" className="home-card" data-testid="home-search-card">
          <h3>Look up a sign</h3>
          <p className="home-card-next">Search and try any of the 103 signs</p>
        </Link>
      </div>
    </section>
  )
}
