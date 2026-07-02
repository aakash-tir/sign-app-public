import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { SignAppDB } from './db'
import { SentenceRepo } from './sentenceRepo'

let counter = 0
let db: SignAppDB
let repo: SentenceRepo

beforeEach(async () => {
  db = new SignAppDB(`sentence-test-${++counter}`)
  await db.open()
  repo = new SentenceRepo(db)
})

afterEach(async () => {
  await db.delete()
})

describe('SentenceRepo', () => {
  it('records a first completion', async () => {
    const progress = await repo.recordCompletion('want eat', 111)
    expect(progress).toEqual({
      sentenceId: 'want eat',
      timesCompleted: 1,
      lastCompletedAt: 111,
    })
    expect(await repo.getProgress('want eat')).toEqual(progress)
  })

  it('increments on repeat completions and keeps the latest timestamp', async () => {
    await repo.recordCompletion('want eat', 1)
    const progress = await repo.recordCompletion('want eat', 2)
    expect(progress.timesCompleted).toBe(2)
    expect(progress.lastCompletedAt).toBe(2)
  })

  it('persists across repo instances on the same db (survives a "reload")', async () => {
    await repo.recordCompletion('help please', 5)
    const again = new SentenceRepo(db)
    expect((await again.getProgress('help please'))?.timesCompleted).toBe(1)
  })

  it('lists all progress and exposes completed ids as a set', async () => {
    await repo.recordCompletion('a b', 1)
    await repo.recordCompletion('c d', 2)
    expect((await repo.allProgress()).length).toBe(2)
    expect(await repo.completedIds()).toEqual(new Set(['a b', 'c d']))
  })

  it('returns an empty set when nothing is completed', async () => {
    expect(await repo.completedIds()).toEqual(new Set())
  })
})

describe('SignAppDB v3 migration', () => {
  it('opens a database created at the pre-sentences schema (v2)', async () => {
    // Simulate an existing user's DB: versions 1–2 only, with data.
    const name = `migrate-test-${++counter}`
    const old = new Dexie(name)
    old.version(1).stores({ words: 'id, level', progress: 'wordId, bucket' })
    old.version(2).stores({ profile: 'id' })
    await old.open()
    await old.table('words').put({ id: 'hello', gloss: 'hello' })
    old.close()

    const upgraded = new SignAppDB(name)
    await upgraded.open()
    // Old data intact, new table usable.
    expect((await upgraded.words.get('hello'))?.gloss).toBe('hello')
    const repo2 = new SentenceRepo(upgraded)
    await repo2.recordCompletion('want eat', 9)
    expect(await repo2.completedIds()).toEqual(new Set(['want eat']))
    await upgraded.delete()
  })
})
