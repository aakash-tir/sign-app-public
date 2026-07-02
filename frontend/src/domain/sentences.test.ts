import { describe, it, expect } from 'vitest'
import {
  sentenceOf,
  eligibleSentences,
  pickSentence,
  LEVEL_LENGTH_BANDS,
} from './sentences'
import { mulberry32 } from './rng'

const bank = [
  sentenceOf(['want', 'eat']),
  sentenceOf(['help', 'please']),
  sentenceOf(['hungry', 'want', 'eat']),
  sentenceOf(['want', 'eat', 'more', 'please']),
]

const allSigns = new Set(['want', 'eat', 'help', 'please', 'hungry', 'more'])

describe('sentenceOf', () => {
  it('derives a stable id from the joined glosses', () => {
    expect(sentenceOf(['want', 'eat']).id).toBe('want eat')
    expect(sentenceOf(['thank you', 'friend']).id).toBe('thank you friend')
  })
})

describe('eligibleSentences', () => {
  it('requires every sign to be confident (ADR-009)', () => {
    const confident = new Set(['want', 'eat', 'help'])
    const ids = eligibleSentences(bank, confident, 'beginner').map((s) => s.id)
    expect(ids).toContain('want eat')
    expect(ids).not.toContain('help please') // 'please' not confident
    expect(ids).not.toContain('hungry want eat') // 'hungry' not confident
  })

  it('applies the level length bands', () => {
    const beginner = eligibleSentences(bank, allSigns, 'beginner')
    expect(beginner.map((s) => s.signs.length)).toEqual([2, 2, 3]) // no 4s
    const expert = eligibleSentences(bank, allSigns, 'expert')
    expect(expert.map((s) => s.signs.length)).toEqual([3, 4]) // no 2s
    const intermediate = eligibleSentences(bank, allSigns, 'intermediate')
    expect(intermediate).toHaveLength(4) // full 2–4 range
  })

  it('bands cover 2–4 and are sane', () => {
    for (const { min, max } of Object.values(LEVEL_LENGTH_BANDS)) {
      expect(min).toBeGreaterThanOrEqual(2)
      expect(max).toBeLessThanOrEqual(4)
      expect(min).toBeLessThanOrEqual(max)
    }
  })
})

describe('pickSentence', () => {
  const eligible = eligibleSentences(bank, allSigns, 'intermediate')

  it('returns null when nothing is eligible', () => {
    expect(pickSentence([], new Set(), mulberry32(1))).toBeNull()
  })

  it('is deterministic under a seeded rng', () => {
    const a = pickSentence(eligible, new Set(), mulberry32(7))
    const b = pickSentence(eligible, new Set(), mulberry32(7))
    expect(a).toEqual(b)
  })

  it('prefers sentences not yet completed', () => {
    const completed = new Set(eligible.slice(0, 3).map((s) => s.id))
    // Only one fresh sentence remains — any rng must land on it.
    for (const seed of [1, 2, 3, 4, 5]) {
      const pick = pickSentence(eligible, completed, mulberry32(seed))
      expect(pick?.id).toBe(eligible[3]?.id)
    }
  })

  it('recycles the pool once everything is completed', () => {
    const completed = new Set(eligible.map((s) => s.id))
    const pick = pickSentence(eligible, completed, mulberry32(1))
    expect(pick).not.toBeNull()
  })

  it('avoids repeating the current sentence when an alternative exists', () => {
    const completed = new Set(eligible.map((s) => s.id))
    const current = eligible[0]?.id ?? null
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const pick = pickSentence(eligible, completed, mulberry32(seed), current)
      expect(pick?.id).not.toBe(current)
    }
  })

  it('returns the current sentence when it is the only option', () => {
    const only = [sentenceOf(['want', 'eat'])]
    const pick = pickSentence(only, new Set(), mulberry32(1), 'want eat')
    expect(pick?.id).toBe('want eat')
  })
})
