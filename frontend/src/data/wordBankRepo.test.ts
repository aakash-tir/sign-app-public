import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SENTENCE_UNLOCK_THRESHOLD } from '../domain/types'
import { SignAppDB } from './db'
import { WordBankRepo } from './wordBankRepo'

let counter = 0
let db: SignAppDB
let repo: WordBankRepo

beforeEach(async () => {
  db = new SignAppDB(`test-${++counter}`)
  await db.open()
  repo = new WordBankRepo(db)
})

afterEach(async () => {
  await db.delete()
})

describe('WordBankRepo', () => {
  it('creates default need-practice progress when adding a word', async () => {
    await repo.putWord({ id: 'hello', gloss: 'HELLO' })
    const progress = await repo.getProgress('hello')
    expect(progress?.bucket).toBe('need-practice')
    expect(progress?.needPracticeStreak).toBe(0)
  })

  it('records an attempt for an unseen word by creating progress', async () => {
    const progress = await repo.recordAttempt('x', 'wrong', 1)
    expect(progress.bucket).toBe('need-practice')
    expect(await repo.getProgress('x')).toBeDefined()
  })

  it('lists all progress', async () => {
    await repo.putWord({ id: 'a', gloss: 'A' })
    await repo.putWord({ id: 'b', gloss: 'B' })
    const ids = (await repo.allProgress()).map((p) => p.wordId).sort()
    expect(ids).toEqual(['a', 'b'])
  })

  it('persists bucket transitions across a reload', async () => {
    await repo.putWord({ id: 'a', gloss: 'A' })
    await repo.recordAttempt('a', 'correct', 1)
    await repo.recordAttempt('a', 'correct', 2)
    await repo.recordAttempt('a', 'correct', 3) // promotes to confident
    db.close()

    const reopened = new SignAppDB(db.name)
    await reopened.open()
    const progress = await new WordBankRepo(reopened).getProgress('a')
    expect(progress?.bucket).toBe('confident')
    expect(progress?.timesSeen).toBe(3)
    await reopened.delete()
  })

  it('ensureSeeded seeds once and is idempotent', async () => {
    await repo.ensureSeeded(['A', 'B', 'C'])
    await repo.ensureSeeded(['X']) // no-op: already seeded
    const ids = (await repo.allProgress()).map((p) => p.wordId).sort()
    expect(ids).toEqual(['A', 'B', 'C'])
  })

  it('defaults the profile to beginner, sentences locked, classic overlay, explainer unseen', async () => {
    expect(await repo.getProfile()).toEqual({
      level: 'beginner',
      sentencesUnlocked: false,
      overlayColorMode: 'classic',
      cameraExplainerSeen: false,
      devMode: false,
    })
  })

  it('persists the overlay color mode without touching other profile fields', async () => {
    await repo.setLevel('intermediate')
    await repo.setOverlayColorMode('per-finger')
    const profile = await repo.getProfile()
    expect(profile.overlayColorMode).toBe('per-finger')
    expect(profile.level).toBe('intermediate') // unchanged
  })

  it('persists the camera-explainer-seen flag without touching other fields', async () => {
    await repo.setOverlayColorMode('per-finger')
    await repo.setCameraExplainerSeen(true)
    const profile = await repo.getProfile()
    expect(profile.cameraExplainerSeen).toBe(true)
    expect(profile.overlayColorMode).toBe('per-finger') // unchanged
  })

  it('reassigns the level without touching progress', async () => {
    await repo.putWord({ id: 'a', gloss: 'A' })
    await repo.recordAttempt('a', 'correct', 1)
    await repo.setLevel('intermediate')
    expect((await repo.getProfile()).level).toBe('intermediate')
    expect((await repo.getProgress('a'))?.needPracticeStreak).toBe(1)
  })

  it('markKnown moves a word straight to confident', async () => {
    await repo.markKnown('Z')
    expect((await repo.getProgress('Z'))?.bucket).toBe('confident')
  })

  it('refreshSentenceUnlock latches once enough words are confident', async () => {
    await repo.markKnown('A')
    expect((await repo.refreshSentenceUnlock()).sentencesUnlocked).toBe(false)

    for (let i = 0; i < SENTENCE_UNLOCK_THRESHOLD; i++) {
      await repo.markKnown(`L${i}`)
    }
    expect((await repo.refreshSentenceUnlock()).sentencesUnlocked).toBe(true)
  })
})
