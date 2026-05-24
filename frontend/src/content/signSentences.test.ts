import { describe, it, expect } from 'vitest'
import { SIGN_SENTENCES, signableSentences } from './signSentences'
import { SHIPPED_GLOSSES } from './dynamicVocab'

describe('signableSentences', () => {
  it('includes only sequences whose every sign is confident', () => {
    const confident = new Set(['want', 'eat'])
    const result = signableSentences(confident)
    expect(result).toContainEqual(['want', 'eat'])
    expect(result.every((seq) => seq.every((s) => confident.has(s)))).toBe(true)
    expect(result).not.toContainEqual(['want', 'drink']) // 'drink' not confident
  })

  it('returns nothing when no full sequence is confident', () => {
    expect(signableSentences(new Set(['want']))).toEqual([])
  })

  it('every sentence uses only shipped glosses (so each sign is recognizable)', () => {
    const shipped = new Set(SHIPPED_GLOSSES)
    for (const seq of SIGN_SENTENCES) {
      for (const sign of seq) expect(shipped.has(sign)).toBe(true)
    }
  })
})
