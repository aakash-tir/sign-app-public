import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDynamicSignRecognition } from '../../recognition/useDynamicSignRecognition'
import { SentenceDrill } from './SentenceDrill'
import { db } from '../../data/db'
import { WordBankRepo } from '../../data/wordBankRepo'
import { SentenceRepo } from '../../data/sentenceRepo'
import { SIGN_SENTENCES } from '../../content/signSentences'
import {
  eligibleSentences,
  pickSentence,
  type SignSentence,
} from '../../domain/sentences'
import { sentencesEnabled } from '../../domain/levels'
import { SENTENCE_UNLOCK_THRESHOLD, type UserProfile } from '../../domain/types'
import type { Rng } from '../../domain/rng'
import './SentencesView.css'

const defaultWordRepo = new WordBankRepo(db)
const defaultSentenceRepo = new SentenceRepo(db)

interface SentencesViewProps {
  repo?: WordBankRepo
  sentenceRepo?: SentenceRepo
  /** Injected for deterministic tests (frontend rules); UI entry uses Math.random. */
  rng?: Rng
}

/**
 * The Sentences section (Phase 5, FR-20, ADR-028): short sequences of the
 * learner's confident signs, verified one sign at a time by the dynamic
 * recognizer (per-sign calibrated acceptance, ADR-025) with the "That's what I
 * did" valve (ADR-008). Availability follows ADR-009 (`sentencesEnabled`);
 * completions persist via `SentenceRepo` and bias selection toward fresh
 * sentences. A sequencing exercise — not a claim of full ASL grammar (ADR-012).
 */
export function SentencesView({
  repo = defaultWordRepo,
  sentenceRepo = defaultSentenceRepo,
  rng = Math.random,
}: SentencesViewProps) {
  const recognition = useDynamicSignRecognition()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [confident, setConfident] = useState<ReadonlySet<string>>(new Set())
  const [confidentCount, setConfidentCount] = useState(0)
  const [completed, setCompleted] = useState<ReadonlySet<string>>(new Set())
  const [sentence, setSentence] = useState<SignSentence | null>(null)
  const [isDone, setIsDone] = useState(false)
  // Bumped per drill run: keys the SentenceDrill so a recycled pick of the
  // same sentence still remounts it (resetting its word index).
  const [round, setRound] = useState(0)
  const recordingRef = useRef(false)

  const eligible = useMemo(
    () =>
      profile
        ? eligibleSentences(SIGN_SENTENCES, confident, profile.level)
        : [],
    [profile, confident],
  )

  const beginSentence = useCallback((next: SignSentence | null) => {
    setSentence(next)
    setIsDone(false)
    setRound((r) => r + 1)
    recordingRef.current = false
  }, [])

  // Load profile (with the ADR-009/010 unlock latch recomputed), the confident
  // set, and persisted sentence completions; then pick the first sentence.
  useEffect(() => {
    let active = true
    void (async () => {
      const [loadedProfile, bank, completedIds] = await Promise.all([
        repo.refreshSentenceUnlock(),
        repo.allProgress(),
        sentenceRepo.completedIds(),
      ])
      if (!active) return
      const confidentSet = new Set(
        bank.filter((w) => w.bucket === 'confident').map((w) => w.wordId),
      )
      setProfile(loadedProfile)
      setConfident(confidentSet)
      setConfidentCount(confidentSet.size)
      setCompleted(completedIds)
    })()
    return () => {
      active = false
    }
  }, [repo, sentenceRepo])

  // First sentence once the data is in (and whenever eligibility changes from
  // a reload — not on every completion; Next/Skip drive later picks).
  useEffect(() => {
    if (!profile) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSentence((current) =>
      current ? current : pickSentence(eligible, completed, rng),
    )
    // `completed` is deliberately read fresh here but must not re-pick after
    // each completion (the learner chooses when to move on).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, eligible, rng])

  // Per-word advance + rising-edge accept live in the shared SentenceDrill
  // (P6M5); this view keeps selection, gating, and persistence.
  const finishSentence = useCallback(() => {
    if (!sentence || recordingRef.current) return
    recordingRef.current = true
    setIsDone(true)
    void sentenceRepo.recordCompletion(sentence.id).then(() => {
      setCompleted((prev) => new Set(prev).add(sentence.id))
    })
  }, [sentence, sentenceRepo])

  const handleNext = useCallback(() => {
    beginSentence(pickSentence(eligible, completed, rng, sentence?.id ?? null))
  }, [eligible, completed, rng, sentence, beginSentence])

  if (!profile) {
    return <p className="sentences-loading">Loading…</p>
  }

  // ADR-009 gate: beginner below the latched ≥20-confident unlock.
  if (!sentencesEnabled(profile.level, profile.sentencesUnlocked)) {
    return (
      <section className="sentences-view" aria-label="Sentences">
        <h2>Sentences</h2>
        <p
          className="sentences-locked"
          role="status"
          data-testid="sentences-locked"
        >
          Sentences unlock once you know {SENTENCE_UNLOCK_THRESHOLD} signs
          confidently — you&apos;re at {confidentCount}. Keep going in Learn and
          Practice, or raise your level in Settings if you already know some
          sign language.
        </p>
      </section>
    )
  }

  const completedCount = eligible.filter((s) => completed.has(s.id)).length

  // Unlocked but nothing performable yet (or none within the level's band).
  if (eligible.length === 0) {
    return (
      <section className="sentences-view" aria-label="Sentences">
        <h2>Sentences</h2>
        <p
          className="sentences-empty"
          role="status"
          data-testid="sentences-empty"
        >
          No sentences match your confident signs yet. Learn and practice a few
          more everyday signs and come back!
        </p>
      </section>
    )
  }

  return (
    <section className="sentences-view" aria-label="Sentences">
      <h2>Sentences</h2>
      <p className="sentences-progress" data-testid="sentences-progress">
        {completedCount} of {eligible.length} sentences completed
      </p>

      {sentence && (
        <>
          <p className="sentences-cue">Sign these words in order</p>
          <SentenceDrill
            key={`${round}-${sentence.id}`}
            sentence={sentence}
            recognition={recognition}
            onComplete={finishSentence}
            isDone={isDone}
            feedback={
              <div className="sentences-feedback" data-testid="sentence-done">
                <p className="feedback-text">Nice — whole sentence! 🎉</p>
                <button
                  type="button"
                  data-testid="sentence-next"
                  onClick={handleNext}
                >
                  Next sentence
                </button>
              </div>
            }
            secondaryAction={
              <button
                type="button"
                className="sentences-secondary"
                data-testid="sentence-skip"
                onClick={handleNext}
              >
                Skip sentence
              </button>
            }
          />
        </>
      )}
    </section>
  )
}
