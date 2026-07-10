import { describe, it, expect } from 'vitest'
import { LETTER_BATCHES, PRIORITY_WORDS, WORD_UNITS } from './curriculum'
import { SHIPPED_GLOSSES } from './dynamicVocab'
import { SIGN_SENTENCES } from './signSentences'
import { LETTER_HINTS } from './fingerspelling'
import { flattenRoute, routeConstructibility } from '../domain/curriculum'

const recognized = new Set(SHIPPED_GLOSSES)
const route = flattenRoute(WORD_UNITS)
const routeWords = route.flatMap((set) => [...set.signs])

/**
 * The ideal-but-not-yet-recognized words (Q6 placeholder slots). Asserted
 * explicitly on purpose: when the model track ships one of these, this test
 * fails and prompts the curriculum + sentence-bank update it should get.
 */
const EXPECTED_PLACEHOLDERS = [
  'goodbye',
  'you',
  'me',
  'my',
  'your',
  'feel',
  'deaf',
  'when',
  'why',
  'today',
  'tomorrow',
  'morning',
  'night',
]

describe('WORD_UNITS invariants (P6M1)', () => {
  it('every word set has 1–2 signs', () => {
    for (const { signs } of route) {
      expect(signs.length).toBeGreaterThanOrEqual(1)
      expect(signs.length).toBeLessThanOrEqual(2)
    }
  })

  it('set ids are the joined signs and unique (stable progress keys)', () => {
    for (const set of route) expect(set.id).toBe(set.signs.join(' '))
    expect(new Set(route.map((s) => s.id)).size).toBe(route.length)
  })

  it('unit ids are unique', () => {
    const ids = WORD_UNITS.map((u) => u.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('no word appears twice in the route', () => {
    expect(new Set(routeWords).size).toBe(routeWords.length)
  })

  it('covers every shipped gloss exactly (recognized route words == SHIPPED_GLOSSES)', () => {
    const recognizedRouteWords = routeWords.filter((w) => recognized.has(w))
    expect(new Set(recognizedRouteWords).size).toBe(SHIPPED_GLOSSES.length)
    for (const gloss of SHIPPED_GLOSSES) {
      expect(routeWords).toContain(gloss)
    }
  })

  it('placeholder words are exactly the expected ideal-but-missing set', () => {
    const placeholders = routeWords.filter((w) => !recognized.has(w))
    expect(placeholders).toEqual(EXPECTED_PLACEHOLDERS)
  })

  it('after every set the learned pool builds ≥ 1 bank sentence (plan.md §2.1)', () => {
    const perPrefix = routeConstructibility(route, SIGN_SENTENCES, recognized)
    perPrefix.forEach((ok, i) => {
      expect(ok, `set ${i} ("${route[i]?.id}") breaks constructibility`).toBe(
        true,
      )
    })
  })

  it('the finished route builds the entire sentence bank', () => {
    const pool = new Set(routeWords.filter((w) => recognized.has(w)))
    for (const sentence of SIGN_SENTENCES) {
      for (const sign of sentence.signs) expect(pool.has(sign)).toBe(true)
    }
  })
})

describe('PRIORITY_WORDS (the model-track expansion queue)', () => {
  it('is the placeholders in route order', () => {
    expect([...PRIORITY_WORDS]).toEqual(EXPECTED_PLACEHOLDERS)
  })

  it('contains no shipped gloss', () => {
    for (const word of PRIORITY_WORDS) {
      expect(recognized.has(word)).toBe(false)
    }
  })
})

describe('LETTER_BATCHES invariants (Q5)', () => {
  it('every batch has 2–3 letters', () => {
    for (const { signs } of LETTER_BATCHES) {
      expect(signs.length).toBeGreaterThanOrEqual(2)
      expect(signs.length).toBeLessThanOrEqual(3)
    }
  })

  it('covers exactly the 24 statically verifiable letters — no J, no Z', () => {
    const letters = LETTER_BATCHES.flatMap((b) => [...b.signs])
    expect(new Set(letters).size).toBe(letters.length)
    expect(letters.sort()).toEqual(Object.keys(LETTER_HINTS).sort())
    expect(letters).not.toContain('J')
    expect(letters).not.toContain('Z')
  })
})
