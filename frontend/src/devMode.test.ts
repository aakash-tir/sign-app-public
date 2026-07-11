import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SignAppDB } from './data/db'
import { WordBankRepo } from './data/wordBankRepo'
import { getDevMode, loadDevMode, setDevMode } from './devMode'

let counter = 0
let db: SignAppDB
let repo: WordBankRepo

beforeEach(async () => {
  db = new SignAppDB(`test-devmode-${++counter}`)
  await db.open()
  repo = new WordBankRepo(db)
  // Reset the module-level store from a fresh (dev-mode-off) profile.
  await loadDevMode(repo)
})

afterEach(async () => {
  await db.delete()
})

describe('dev-mode store', () => {
  it('defaults to off', () => {
    expect(getDevMode()).toBe(false)
  })

  it('set + persists through the repository', async () => {
    setDevMode(true, repo)
    expect(getDevMode()).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect((await repo.getProfile()).devMode).toBe(true)
  })

  it('hydrates from the persisted profile', async () => {
    // Persist directly through the repo while the in-memory flag is off.
    await repo.setDevMode(true)
    expect(getDevMode()).toBe(false)
    await loadDevMode(repo)
    expect(getDevMode()).toBe(true)
  })
})
