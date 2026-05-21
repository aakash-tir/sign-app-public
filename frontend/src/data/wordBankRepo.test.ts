import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
})
