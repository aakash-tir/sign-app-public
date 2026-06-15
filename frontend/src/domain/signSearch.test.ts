import { describe, it, expect } from 'vitest'
import {
  matchSign,
  normalizeQuery,
  editDistance,
  fuzzySuggestions,
} from './signSearch'
import { SHIPPED_GLOSSES } from '../content/dynamicVocab'
import { SIGN_SYNONYMS } from '../content/signSynonyms'

describe('normalizeQuery', () => {
  it('trims, lowercases, and collapses internal whitespace', () => {
    expect(normalizeQuery('  Thank   You  ')).toBe('thank you')
    expect(normalizeQuery('FATHER')).toBe('father')
  })
})

describe('matchSign', () => {
  it('finds an exact shipped gloss', () => {
    expect(matchSign('father')).toEqual({ status: 'found', gloss: 'father' })
  })

  it('is case- and whitespace-insensitive', () => {
    expect(matchSign('  Thank  You ')).toEqual({
      status: 'found',
      gloss: 'thank you',
    })
  })

  it('resolves synonyms onto a shipped gloss', () => {
    expect(matchSign('thanks')).toEqual({ status: 'found', gloss: 'thank you' })
    expect(matchSign('dad')).toEqual({ status: 'found', gloss: 'father' })
    expect(matchSign('PC')).toEqual({ status: 'found', gloss: 'computer' })
  })

  it('reports an absent term as not-found (with the trimmed query)', () => {
    expect(matchSign('  xyzzy ')).toEqual({
      status: 'not-found',
      query: 'xyzzy',
    })
  })

  it('resolves a morphological variant via stemming (P4M9)', () => {
    // `walking` -> `walk`, `books` -> `book`, `helped` -> `help`.
    expect(matchSign('walking')).toEqual({ status: 'found', gloss: 'walk' })
    expect(matchSign('books')).toEqual({ status: 'found', gloss: 'book' })
    expect(matchSign('helped')).toEqual({ status: 'found', gloss: 'help' })
    expect(matchSign('walk')).toEqual({ status: 'found', gloss: 'walk' })
  })

  it('offers typo-tolerant suggestions on a near miss (P4M9)', () => {
    const result = matchSign('fathr') // 1 edit from `father`
    expect(result.status).toBe('suggestions')
    if (result.status === 'suggestions') {
      expect(result.suggestions).toContain('father')
      expect(result.query).toBe('fathr')
    }
  })

  it('suggests via a misspelled synonym (mapped to its canonical gloss)', () => {
    const result = matchSign('thanx') // near the synonym `thanks` -> `thank you`
    expect(result.status).toBe('suggestions')
    if (result.status === 'suggestions') {
      expect(result.suggestions).toContain('thank you')
    }
  })

  it('still reports a genuinely absent term as not-found', () => {
    expect(matchSign('  xyzzy ')).toEqual({
      status: 'not-found',
      query: 'xyzzy',
    })
  })

  it('reports an empty / whitespace query as not-found', () => {
    expect(matchSign('').status).toBe('not-found')
    expect(matchSign('   ').status).toBe('not-found')
  })

  it('accepts injected glosses/synonyms for isolation', () => {
    expect(matchSign('cat', ['cat', 'dog'], {})).toEqual({
      status: 'found',
      gloss: 'cat',
    })
    expect(matchSign('kitty', ['cat'], { kitty: 'cat' })).toEqual({
      status: 'found',
      gloss: 'cat',
    })
  })
})

describe('SIGN_SYNONYMS invariant', () => {
  it('every synonym target is a shipped gloss', () => {
    const shipped = new Set(SHIPPED_GLOSSES)
    for (const target of Object.values(SIGN_SYNONYMS)) {
      expect(shipped.has(target)).toBe(true)
    }
  })

  it('keys are already normalized', () => {
    for (const key of Object.keys(SIGN_SYNONYMS)) {
      expect(key).toBe(normalizeQuery(key))
    }
  })
})

describe('editDistance', () => {
  it('is zero for identical strings and symmetric', () => {
    expect(editDistance('father', 'father')).toBe(0)
    expect(editDistance('abc', 'abd')).toBe(editDistance('abd', 'abc'))
  })

  it('counts single edits', () => {
    expect(editDistance('father', 'fathr')).toBe(1) // deletion
    expect(editDistance('hello', 'hello')).toBe(0)
    expect(editDistance('cat', 'cart')).toBe(1) // insertion
    expect(editDistance('cat', 'cot')).toBe(1) // substitution
  })

  it('handles empty strings', () => {
    expect(editDistance('', 'abc')).toBe(3)
    expect(editDistance('abc', '')).toBe(3)
  })
})

describe('fuzzySuggestions', () => {
  const glosses = ['father', 'mother', 'brother'] as const

  it('ranks the closest gloss first and caps the list', () => {
    // `fathr` is 1 edit from father, further from the others.
    expect(fuzzySuggestions('fathr', glosses, {})[0]).toBe('father')
  })

  it('treats a prefix as a strong match', () => {
    expect(fuzzySuggestions('fath', glosses, {})).toContain('father')
  })

  it('returns nothing for a far-off query', () => {
    expect(fuzzySuggestions('zzzzzz', glosses, {})).toEqual([])
  })

  it('dedupes a gloss reachable via both its name and a synonym', () => {
    const suggestions = fuzzySuggestions('fathr', glosses, { papa: 'father' })
    expect(suggestions.filter((g) => g === 'father')).toHaveLength(1)
  })
})
