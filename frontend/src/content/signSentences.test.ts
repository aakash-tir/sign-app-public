import { describe, it, expect } from 'vitest'
import { SIGN_SENTENCES } from './signSentences'
import { SHIPPED_GLOSSES } from './dynamicVocab'

describe('SIGN_SENTENCES invariants (P5M1)', () => {
  it('every sentence uses only shipped glosses (so each sign is recognizable)', () => {
    const shipped = new Set(SHIPPED_GLOSSES)
    for (const { signs } of SIGN_SENTENCES) {
      for (const sign of signs) expect(shipped.has(sign)).toBe(true)
    }
  })

  it('every sentence is 2–4 signs long', () => {
    for (const { signs } of SIGN_SENTENCES) {
      expect(signs.length).toBeGreaterThanOrEqual(2)
      expect(signs.length).toBeLessThanOrEqual(4)
    }
  })

  it('ids are the joined glosses and unique (stable progress keys)', () => {
    const ids = SIGN_SENTENCES.map((s) => s.id)
    for (const s of SIGN_SENTENCES) expect(s.id).toBe(s.signs.join(' '))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('offers a meaningful pool at every level band', () => {
    const twoOrThree = SIGN_SENTENCES.filter((s) => s.signs.length <= 3)
    const threeOrFour = SIGN_SENTENCES.filter((s) => s.signs.length >= 3)
    expect(twoOrThree.length).toBeGreaterThanOrEqual(10) // beginner band
    expect(threeOrFour.length).toBeGreaterThanOrEqual(10) // expert band
  })
})
