import { describe, it, expect } from 'vitest'
import { matchSign, normalizeQuery } from './signSearch'
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

  it('treats an inexact variant of a shipped sign as not-found', () => {
    // exact + synonym only — no stemming/fuzzy (deferred per P4M1 scope)
    expect(matchSign('walking').status).toBe('not-found')
    expect(matchSign('walk').status).toBe('found')
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
