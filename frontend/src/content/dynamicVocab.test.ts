import { describe, it, expect } from 'vitest'
import { SHIPPED_GLOSSES, shippedLabels } from './dynamicVocab'

describe('shippedLabels', () => {
  it('drops glosses held back by the accuracy gate', () => {
    // `good` and `come` stay below the honest 0.50 gate on the 81-gloss model.
    const modelLabels = ['drink', 'good', 'help', 'come', 'family']
    expect(shippedLabels(modelLabels)).toEqual(['drink', 'help', 'family'])
  })

  it('preserves the model label order', () => {
    expect(shippedLabels(['help', 'drink', 'yes'])).toEqual([
      'help',
      'drink',
      'yes',
    ])
  })

  it('ships the 63 glosses that clear the honest signer-disjoint gate (P3M2c)', () => {
    expect(SHIPPED_GLOSSES).toHaveLength(63)
    expect(SHIPPED_GLOSSES).toContain('like') // P3M2 promotion on MS-ASL ∪ WLASL
    expect(SHIPPED_GLOSSES).toContain('bad')
    expect(SHIPPED_GLOSSES).toContain('happy')
    expect(SHIPPED_GLOSSES).toContain('thank you') // P3M2c: finally clears (0.63)
    expect(SHIPPED_GLOSSES).toContain('teacher') // P3M2c new sign
    expect(SHIPPED_GLOSSES).toContain('water')
    expect(SHIPPED_GLOSSES).not.toContain('good') // still below the honest gate
    expect(SHIPPED_GLOSSES).not.toContain('before')
    expect(SHIPPED_GLOSSES).not.toContain('tall')
    expect(SHIPPED_GLOSSES).not.toContain('come') // 0.08 — hard/confusable
    expect(SHIPPED_GLOSSES).not.toContain('mother') // 0.49 — near miss
  })

  it('has no duplicate glosses', () => {
    expect(new Set(SHIPPED_GLOSSES).size).toBe(SHIPPED_GLOSSES.length)
  })
})
