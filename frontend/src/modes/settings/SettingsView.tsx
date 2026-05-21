import { useCallback, useEffect, useState } from 'react'
import { db } from '../../data/db'
import { WordBankRepo } from '../../data/wordBankRepo'
import { sentencesEnabled } from '../../domain/levels'
import {
  SENTENCE_UNLOCK_THRESHOLD,
  type Level,
  type UserProfile,
} from '../../domain/types'
import { fingerspellingModel } from '../../recognition/signClassifier'
import './SettingsView.css'

const defaultRepo = new WordBankRepo(db)
const LEVELS: Level[] = ['beginner', 'intermediate', 'expert']

export function SettingsView({ repo = defaultRepo }: { repo?: WordBankRepo }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [confident, setConfident] = useState<Set<string>>(new Set())

  const reload = useCallback(async () => {
    await repo.ensureSeeded(fingerspellingModel.labels)
    const [loadedProfile, all] = await Promise.all([
      repo.getProfile(),
      repo.allProgress(),
    ])
    setProfile(loadedProfile)
    setConfident(
      new Set(all.filter((w) => w.bucket === 'confident').map((w) => w.wordId)),
    )
  }, [repo])

  useEffect(() => {
    // Initial data load on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  const changeLevel = useCallback(
    async (level: Level) => {
      setProfile(await repo.setLevel(level))
    },
    [repo],
  )

  const markKnown = useCallback(
    async (letter: string) => {
      await repo.markKnown(letter)
      await repo.refreshSentenceUnlock()
      await reload()
    },
    [repo, reload],
  )

  if (!profile) {
    return <p className="settings-loading">Loading…</p>
  }

  const enabled = sentencesEnabled(profile.level, profile.sentencesUnlocked)

  return (
    <section className="settings" aria-label="Settings">
      <h2>Level</h2>
      <p data-testid="level-current">
        Current level: <strong>{profile.level}</strong>
      </p>
      <div className="level-options">
        {LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            aria-pressed={profile.level === level}
            data-testid={`level-${level}`}
            onClick={() => void changeLevel(level)}
          >
            {level}
          </button>
        ))}
      </div>
      <p className="settings-note">
        You can change your level any time — your progress is kept.
      </p>

      <h2>Sentences</h2>
      <p data-testid="sentence-status">
        {enabled
          ? 'Sentences are on.'
          : `Sentences unlock at ${SENTENCE_UNLOCK_THRESHOLD} confident letters ` +
            `(you have ${confident.size}).`}
      </p>

      <h2>Letters you already know</h2>
      <p className="settings-note">
        Tap letters you can already sign to add them as confident.
      </p>
      <div className="letter-grid">
        {fingerspellingModel.labels.map((letter) => (
          <button
            key={letter}
            type="button"
            aria-pressed={confident.has(letter)}
            className={confident.has(letter) ? 'known' : undefined}
            data-testid={`known-${letter}`}
            disabled={confident.has(letter)}
            onClick={() => void markKnown(letter)}
          >
            {letter}
          </button>
        ))}
      </div>
    </section>
  )
}
