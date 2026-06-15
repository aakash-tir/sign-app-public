import { describe, it, expect } from 'vitest'
import { fingerspellLetters, canFingerspell } from './fingerspell'

// The static model knows the ASL alphabet minus the dynamic letters J and Z.
const ALPHABET = new Set('ABCDEFGHIKLMNOPQRSTUVWXY'.split(''))

describe('fingerspellLetters', () => {
  it('returns the uppercase letters of a spellable word', () => {
    expect(fingerspellLetters('father', ALPHABET)).toEqual([
      'F',
      'A',
      'T',
      'H',
      'E',
      'R',
    ])
  })

  it('is case-insensitive and trims', () => {
    expect(fingerspellLetters('  Help ', ALPHABET)).toEqual([
      'H',
      'E',
      'L',
      'P',
    ])
  })

  it('returns null for a word containing a non-static letter (J/Z)', () => {
    expect(fingerspellLetters('jazz', ALPHABET)).toBeNull()
    expect(fingerspellLetters('zip', ALPHABET)).toBeNull()
  })

  it('returns null for non-alphabetic input', () => {
    expect(fingerspellLetters('thank you', ALPHABET)).toBeNull() // space
    expect(fingerspellLetters('h2o', ALPHABET)).toBeNull() // digit
    expect(fingerspellLetters('', ALPHABET)).toBeNull()
    expect(fingerspellLetters('   ', ALPHABET)).toBeNull()
  })
})

describe('canFingerspell', () => {
  it('mirrors fingerspellLetters as a boolean', () => {
    expect(canFingerspell('cat', ALPHABET)).toBe(true)
    expect(canFingerspell('jam', ALPHABET)).toBe(false)
  })
})
