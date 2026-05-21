import { describe, it, expect } from 'vitest'
import { signDictionaryUrl } from './signReference'

describe('signDictionaryUrl', () => {
  it('builds a dictionary URL for a single-word gloss', () => {
    expect(signDictionaryUrl('drink')).toBe(
      'https://www.signasl.org/sign/drink',
    )
  })

  it('lowercases and hyphenates multi-word glosses', () => {
    expect(signDictionaryUrl('Thank You')).toBe(
      'https://www.signasl.org/sign/thank-you',
    )
  })

  it('trims surrounding whitespace', () => {
    expect(signDictionaryUrl('  help  ')).toBe(
      'https://www.signasl.org/sign/help',
    )
  })
})
