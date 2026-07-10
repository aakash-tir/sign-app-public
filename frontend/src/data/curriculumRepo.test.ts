import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SignAppDB } from './db'
import { CurriculumRepo } from './curriculumRepo'

let counter = 0
let database: SignAppDB
let repo: CurriculumRepo

beforeEach(async () => {
  database = new SignAppDB(`test-curriculum-${++counter}`)
  await database.open()
  repo = new CurriculumRepo(database)
})

afterEach(async () => {
  await database.delete()
})

describe('CurriculumRepo', () => {
  it('starts with no completed sets', async () => {
    expect(await repo.completedIds()).toEqual(new Set())
  })

  it('records a completion and reports it', async () => {
    const record = await repo.markCompleted('want eat', 1234)
    expect(record).toEqual({ setId: 'want eat', completedAt: 1234 })
    expect(await repo.completedIds()).toEqual(new Set(['want eat']))
  })

  it('is idempotent — the first completion time wins', async () => {
    await repo.markCompleted('want eat', 1000)
    const second = await repo.markCompleted('want eat', 2000)
    expect(second.completedAt).toBe(1000)
    expect((await repo.completedIds()).size).toBe(1)
  })

  it('tracks multiple sets independently', async () => {
    await repo.markCompleted('want eat', 1)
    await repo.markCompleted('drink water', 2)
    expect(await repo.completedIds()).toEqual(
      new Set(['want eat', 'drink water']),
    )
  })
})

describe('schema migration', () => {
  it('opens a database created at the pre-curriculum schema (v3)', async () => {
    const name = `test-curriculum-migrate-${++counter}`

    // Simulate an existing user's v3 database (Phase 5 schema).
    const old = new Dexie(name)
    old.version(1).stores({ words: 'id, level', progress: 'wordId, bucket' })
    old.version(2).stores({ profile: 'id' })
    old.version(3).stores({ sentences: 'sentenceId' })
    await old.open()
    await old.table('sentences').put({
      sentenceId: 'want eat',
      timesCompleted: 2,
      lastCompletedAt: 42,
    })
    old.close()

    // Reopening at v4 keeps existing data and adds the curriculumSets table.
    const upgraded = new SignAppDB(name)
    await upgraded.open()
    expect(await upgraded.sentences.get('want eat')).toMatchObject({
      timesCompleted: 2,
    })
    const migratedRepo = new CurriculumRepo(upgraded)
    expect(await migratedRepo.completedIds()).toEqual(new Set())
    await migratedRepo.markCompleted('want eat', 7)
    expect(await migratedRepo.completedIds()).toEqual(new Set(['want eat']))
    await upgraded.delete()
  })
})
