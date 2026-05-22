import { useCallback, useEffect, useRef, useState } from 'react'
import { useUnifiedSignRecognition } from '../../recognition/useUnifiedSignRecognition'
import { fingerspellingModel } from '../../recognition/signClassifier'
import { db } from '../../data/db'
import { WordBankRepo } from '../../data/wordBankRepo'
import { sentencesEnabled } from '../../domain/levels'
import type { UserProfile, WordProgress } from '../../domain/types'
import { LETTER_HINTS } from '../../content/fingerspelling'
import { spellableWords } from '../../content/words'
import { SHIPPED_GLOSSES } from '../../content/dynamicVocab'
import { signDictionaryUrl } from '../../content/signReference'
import './LearnMode.css'

const defaultRepo = new WordBankRepo(db)
const LABELS = fingerspellingModel.labels

type View = 'teach' | 'spell' | 'signs'

function confidentIds(bank: WordProgress[]): Set<string> {
  return new Set(
    bank.filter((w) => w.bucket === 'confident').map((w) => w.wordId),
  )
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
    ready: cameraReady,
    recognized,
    start: startCamera,
    setMode,
    reset: resetRecognition,
  } = useUnifiedSignRecognition()

  const committingRef = useRef(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [bank, setBank] = useState<WordProgress[]>([])
  const [view, setView] = useState<View>('teach')

  // Teach (letters) state
  const [target, setTarget] = useState<string | null>(null)
  const [taught, setTaught] = useState(false)

  // Signs (dynamic) state
  const [signTarget, setSignTarget] = useState<string | null>(null)
  const [signTaught, setSignTaught] = useState(false)

  // Spell state
  const [word, setWord] = useState<string | null>(null)
  const [spellIndex, setSpellIndex] = useState(0)
  const [spellDone, setSpellDone] = useState(false)

  // Load profile + bank + first target on mount.
  useEffect(() => {
    let active = true
    void (async () => {
      await repo.ensureSeeded(LABELS)
      await repo.ensurePresent([...SHIPPED_GLOSSES])
      const [loadedProfile, all] = await Promise.all([
        repo.getProfile(),
        repo.allProgress(),
      ])
      if (!active) return
      setProfile(loadedProfile)
      setBank(all)
      const confident = confidentIds(all)
      setTarget(
        pickNext(
          LABELS.filter((l) => !confident.has(l)),
          null,
        ),
      )
    })()
    return () => {
      active = false
    }
  }, [repo])

  // Point the recognizer at the right model for the active view.
  useEffect(() => {
    setMode(view === 'signs' ? 'sign' : 'letter')
  }, [view, setMode])

  const confident = confidentIds(bank)
  const spellable = spellableWords(confident)
  const canSpell =
    profile !== null &&
    sentencesEnabled(profile.level, profile.sentencesUnlocked) &&
    spellable.length > 0
  const remainingLetters = LABELS.filter((l) => !confident.has(l))
  const remainingSigns = SHIPPED_GLOSSES.filter((g) => !confident.has(g))

  // ----- Teaching letters -----
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
    setTarget((prev) => pickNext(remainingLetters, prev))
    resetRecognition()
  }, [remainingLetters, resetRecognition])

  useEffect(() => {
    if (view !== 'teach' || taught || !target) return
    if (recognized && recognized.label === target) void teachCorrect()
  }, [recognized, view, taught, target, teachCorrect])

  // ----- Teaching dynamic signs -----
  const startSigns = useCallback(() => {
    setView('signs')
    setSignTaught(false)
    committingRef.current = false
    setSignTarget((prev) => prev ?? pickNext(remainingSigns, null))
    resetRecognition()
  }, [remainingSigns, resetRecognition])

  const signCorrect = useCallback(async () => {
    if (!signTarget || committingRef.current) return
    committingRef.current = true
    await repo.recordAttempt(signTarget, 'correct')
    setBank(await repo.allProgress())
    setSignTaught(true)
  }, [repo, signTarget])

  const signNext = useCallback(() => {
    setSignTaught(false)
    committingRef.current = false
    setSignTarget((prev) => pickNext(remainingSigns, prev))
    resetRecognition()
  }, [remainingSigns, resetRecognition])

  useEffect(() => {
    if (view !== 'signs' || signTaught || !signTarget) return
    if (recognized && recognized.label === signTarget) void signCorrect()
  }, [recognized, view, signTaught, signTarget, signCorrect])

  // ----- Spelling -----
  const startSpell = useCallback(() => {
    const choice =
      spellable[Math.floor(Math.random() * spellable.length)] ?? null
    setWord(choice)
    setSpellIndex(0)
    setSpellDone(false)
    setView('spell')
    resetRecognition()
  }, [spellable, resetRecognition])

  useEffect(() => {
    if (view !== 'spell' || spellDone || !word) return
    if (recognized && recognized.label === word[spellIndex]) {
      const nextIndex = spellIndex + 1
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSpellIndex(nextIndex)
      if (nextIndex >= word.length) setSpellDone(true)
    }
  }, [recognized, view, spellDone, word, spellIndex])

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
      {cameraStatus === 'on' && !cameraReady && (
        <p role="status" data-testid="model-loading">
          Preparing recognition…
        </p>
      )}
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
        <button
          type="button"
          aria-pressed={view === 'signs'}
          data-testid="signs-tab"
          onClick={startSigns}
        >
          Learn signs
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

      {view === 'signs' && (
        <div className="learn-teach">
          {signTarget === null ? (
            <p data-testid="signs-done">
              You&apos;ve learned all the signs! 🎉
            </p>
          ) : (
            <>
              <div className="learn-prompt">
                <span className="learn-target" data-testid="sign-target">
                  {signTarget}
                </span>
                <a
                  className="sign-reference-link"
                  href={signDictionaryUrl(signTarget)}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="sign-reference"
                >
                  How to sign “{signTarget}” ↗
                </a>
              </div>
              {cameraBlock}
              {signTaught ? (
                <div className="learn-feedback" data-testid="sign-good">
                  <p className="feedback-text">Good job! ✅</p>
                  <button
                    type="button"
                    data-testid="sign-next"
                    onClick={signNext}
                  >
                    Next
                  </button>
                </div>
              ) : (
                <div className="learn-actions">
                  <button
                    type="button"
                    data-testid="sign-got-it"
                    onClick={() => void signCorrect()}
                  >
                    That&apos;s what I did
                  </button>
                  <button
                    type="button"
                    className="learn-secondary"
                    data-testid="sign-skip"
                    onClick={signNext}
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
