import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SignAppDB } from '../data/db'
import { WordBankRepo } from '../data/wordBankRepo'
import {
  getOverlayColorMode,
  loadOverlayColorMode,
  setOverlayColorMode,
} from './overlayColorMode'

let counter = 0
let db: SignAppDB
let repo: WordBankRepo

beforeEach(async () => {
  db = new SignAppDB(`test-overlay-${++counter}`)
  await db.open()
  repo = new WordBankRepo(db)
  // Reset the module-level store to a known value from a fresh (classic) profile.
  await loadOverlayColorMode(repo)
})

afterEach(async () => {
  await db.delete()
})

describe('overlay color mode store', () => {
  it('defaults to classic', () => {
    expect(getOverlayColorMode()).toBe('classic')
  })

  it('setOverlayColorMode updates the current value immediately', () => {
    setOverlayColorMode('per-finger', repo)
    expect(getOverlayColorMode()).toBe('per-finger')
  })

  it('loadOverlayColorMode hydrates from the persisted profile', async () => {
    await repo.setOverlayColorMode('per-finger')
    await loadOverlayColorMode(repo)
    expect(getOverlayColorMode()).toBe('per-finger')
  })
})
