import { useCallback, useEffect, useRef, useState } from 'react'
import { useSignRecognition } from '../../recognition/useSignRecognition'
import { fingerspellingModel } from '../../recognition/signClassifier'
import { db } from '../../data/db'
import { WordBankRepo } from '../../data/wordBankRepo'
import { sentencesEnabled } from '../../domain/levels'
import type { UserProfile, WordProgress } from '../../domain/types'
import { LETTER_HINTS } from '../../content/fingerspelling'
import { spellableWords } from '../../content/words'
import './LearnMode.css'

const defaultRepo = new WordBankRepo(db)
const LABELS = fingerspellingModel.labels

type View = 'teach' | 'spell'

function notConfident(bank: WordProgress[]): string[] {
  const confident = new Set(
    bank.filter((w) => w.bucket === 'confident').map((w) => w.wordId),
  )
  return LABELS.filter((letter) => !confident.has(letter))
}

function pickNext(remaining: string[], after: string | null): string | null {
  if (remaining.length === 0) return null
  if (after === null) return remaining[0] ?? null
  const index = remaining.indexOf(after)
  if (index === -1) return remaining[0] ?? null
  return remaining[(index + 1) % remaining.length] ?? null
}

export function LearnMode({ repo = defaultRepo }: { repo?: WordBankRepo }) {
  const {
    videoRef,
    canvasRef,
    status: cameraStatus,
    trackerError,
    prediction,
    start: startCamera,
    resetPrediction,
  } = useSignRecognition()

  const committingRef = useRef(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [bank, setBank] = useState<WordProgress[]>([])
  const [view, setView] = useState<View>('teach')

  // Teach state
  const [target, setTarget] = useState<string | null>(null)
  const [taught, setTaught] = useState(false)

  // Spell state
  const [word, setWord] = useState<string | null>(null)
  const [spellIndex, setSpellIndex] = useState(0)
  const [spellDone, setSpellDone] = useState(false)

  // Load profile + bank + first target on mount.
  useEffect(() => {
    let active = true
    void (async () => {
      await repo.ensureSeeded(LABELS)
      const [loadedProfile, all] = await Promise.all([
        repo.getProfile(),
        repo.allProgress(),
      ])
      if (!active) return
      setProfile(loadedProfile)
      setBank(all)
      setTarget(pickNext(notConfident(all), null))
    })()
    return () => {
      active = false
    }
  }, [repo])

  const confidentSet = new Set(
    bank.filter((w) => w.bucket === 'confident').map((w) => w.wordId),
  )
  const spellable = spellableWords(confidentSet)
  const canSpell =
    profile !== null &&
    sentencesEnabled(profile.level, profile.sentencesUnlocked) &&
    spellable.length > 0

  // ----- Teaching -----
  const teachCorrect = useCallback(async () => {
    if (!target || committingRef.current) return
    committingRef.current = true
    await repo.recordAttempt(target, 'correct')
    setBank(await repo.allProgress())
    setTaught(true)
  }, [repo, target])

  const teachNext = useCallback(() => {
    setTaught(false)
    committingRef.current = false
    setTarget((prev) => pickNext(notConfident(bank), prev))
    resetPrediction()
  }, [bank, resetPrediction])

  // Camera recognized the target letter -> correct.
  useEffect(() => {
    if (view !== 'teach' || taught || !target) return
    if (prediction && prediction.label === target) {
      void teachCorrect()
    }
  }, [prediction, view, taught, target, teachCorrect])

  // ----- Spelling -----
  const startSpell = useCallback(() => {
    const choice =
      spellable[Math.floor(Math.random() * spellable.length)] ?? null
    setWord(choice)
    setSpellIndex(0)
    setSpellDone(false)
    setView('spell')
    resetPrediction()
  }, [spellable, resetPrediction])

  // Camera recognized the next letter of the word -> advance.
  useEffect(() => {
    if (view !== 'spell' || spellDone || !word) return
    if (prediction && prediction.label === word[spellIndex]) {
      const nextIndex = spellIndex + 1
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSpellIndex(nextIndex)
      if (nextIndex >= word.length) {
        setSpellDone(true)
      }
    }
  }, [prediction, view, spellDone, word, spellIndex])

  if (!profile) {
    return <p className="learn-loading">Loading…</p>
  }

  const cameraBlock = (
    <>
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
    </>
  )

  return (
    <section className="learn" aria-label="Learn">
      <nav className="learn-tabs">
        <button
          type="button"
          aria-pressed={view === 'teach'}
          onClick={() => setView('teach')}
        >
          Learn letters
        </button>
        {canSpell && (
          <button
            type="button"
            aria-pressed={view === 'spell'}
            data-testid="spell-tab"
            onClick={startSpell}
          >
            Spell words
          </button>
        )}
      </nav>

      {view === 'teach' && (
        <div className="learn-teach">
          {target === null ? (
            <p data-testid="learn-done">
              You&apos;ve learned all the letters! 🎉
            </p>
          ) : (
            <>
              <div className="learn-prompt">
                <span className="learn-target" data-testid="learn-target">
                  {target}
                </span>
                <p className="learn-hint">
                  {LETTER_HINTS[target] ?? 'Form the letter with your hand.'}
                </p>
              </div>
              {cameraBlock}
              {taught ? (
                <div className="learn-feedback" data-testid="learn-good">
                  <p className="feedback-text">Good job! ✅</p>
                  <button
                    type="button"
                    data-testid="learn-next"
                    onClick={teachNext}
                  >
                    Next
                  </button>
                </div>
              ) : (
                <div className="learn-actions">
                  <button
                    type="button"
                    data-testid="learn-got-it"
                    onClick={() => void teachCorrect()}
                  >
                    That&apos;s what I did
                  </button>
                  <button
                    type="button"
                    className="learn-secondary"
                    data-testid="learn-skip"
                    onClick={teachNext}
                  >
                    Skip
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {view === 'spell' && word !== null && (
        <div className="learn-spell">
          <p className="learn-cue">Fingerspell this word</p>
          <div className="spell-word" data-testid="spell-word">
            {[...word].map((letter, i) => (
              <span
                key={`${letter}-${i}`}
                className={
                  i < spellIndex ? 'spell-letter done' : 'spell-letter'
                }
              >
                {letter}
              </span>
            ))}
          </div>
          {cameraBlock}
          {spellDone ? (
            <div className="learn-feedback" data-testid="spell-done">
              <p className="feedback-text">Nice! ✅</p>
              <button
                type="button"
                data-testid="spell-another"
                onClick={startSpell}
              >
                Another word
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="learn-secondary"
              data-testid="spell-skip"
              onClick={startSpell}
            >
              Skip word
            </button>
          )}
        </div>
      )}
    </section>
  )
}
