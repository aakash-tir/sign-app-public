import { describe, it, expect } from 'vitest'
import { SHIPPED_GLOSSES, shippedLabels } from './dynamicVocab'

describe('shippedLabels', () => {
  it('drops glosses held back by the accuracy gate', () => {
    // `come` and `mother` stay below the honest 0.50 gate (P4M5 BiGRU+attention model).
    const modelLabels = ['drink', 'come', 'help', 'mother', 'family']
    expect(shippedLabels(modelLabels)).toEqual(['drink', 'help', 'family'])
  })

  it('preserves the model label order', () => {
    expect(shippedLabels(['help', 'drink', 'yes'])).toEqual([
      'help',
      'drink',
      'yes',
    ])
  })

  it('ships the 71 glosses that clear the honest signer-disjoint gate (P4M5)', () => {
    // BiGRU + attention pooling lifted honest CV 0.615 → 0.687; re-gate at ≥ 0.50.
    expect(SHIPPED_GLOSSES).toHaveLength(71)
    expect(SHIPPED_GLOSSES).toContain('thank you') // retained from P3M2c
    expect(SHIPPED_GLOSSES).toContain('good') // P4M5 promotion (was below the gate)
    expect(SHIPPED_GLOSSES).toContain('woman') // P4M5 new sign
    expect(SHIPPED_GLOSSES).toContain('money')
    expect(SHIPPED_GLOSSES).not.toContain('hungry') // P4M5 demotion (0.33 honestly)
    expect(SHIPPED_GLOSSES).not.toContain('come') // still below (0.46)
    expect(SHIPPED_GLOSSES).not.toContain('mother') // still below (0.45)
    expect(SHIPPED_GLOSSES).not.toContain('sleep')
  })

  it('has no duplicate glosses', () => {
    expect(new Set(SHIPPED_GLOSSES).size).toBe(SHIPPED_GLOSSES.length)
  })
})
