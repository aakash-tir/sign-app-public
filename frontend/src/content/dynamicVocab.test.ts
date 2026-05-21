import { describe, it, expect } from 'vitest'
import { SHIPPED_GLOSSES, shippedLabels } from './dynamicVocab'

describe('shippedLabels', () => {
  it('drops glosses held back by the accuracy gate', () => {
    const modelLabels = ['drink', 'like', 'help', 'thank you', 'family']
    expect(shippedLabels(modelLabels)).toEqual(['drink', 'help', 'family'])
  })

  it('preserves the model label order', () => {
    expect(shippedLabels(['help', 'drink', 'yes'])).toEqual([
      'help',
      'drink',
      'yes',
    ])
  })

  it('ships 16 of the 20 curated glosses', () => {
    expect(SHIPPED_GLOSSES).toHaveLength(16)
    expect(SHIPPED_GLOSSES).not.toContain('like')
    expect(SHIPPED_GLOSSES).not.toContain('thank you')
  })
})
