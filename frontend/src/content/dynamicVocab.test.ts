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

  it('ships the curated 16 plus the P2M5b additions, minus held-back glosses', () => {
    expect(SHIPPED_GLOSSES).toHaveLength(20)
    expect(SHIPPED_GLOSSES).toContain('walk') // P2M5b addition
    expect(SHIPPED_GLOSSES).toContain('cold')
    expect(SHIPPED_GLOSSES).not.toContain('like') // still held back
    expect(SHIPPED_GLOSSES).not.toContain('thank you')
  })
})
