import { describe, it, expect } from 'vitest'
import { SHIPPED_GLOSSES, shippedLabels } from './dynamicVocab'

describe('shippedLabels', () => {
  it('drops glosses held back by the accuracy gate', () => {
    // `dog` and `stop` stay below the honest 0.50 gate (P4M10 label-smoothed model).
    const modelLabels = ['drink', 'dog', 'help', 'stop', 'family']
    expect(shippedLabels(modelLabels)).toEqual(['drink', 'help', 'family'])
  })

  it('preserves the model label order', () => {
    expect(shippedLabels(['help', 'drink', 'yes'])).toEqual([
      'help',
      'drink',
      'yes',
    ])
  })

  it('ships the 106 glosses that clear the honest signer-disjoint gate (P4M16)', () => {
    // P4M16: a 36-gloss MS-ASL download → 117-gloss model; 27 new clear ≥ 0.50.
    expect(SHIPPED_GLOSSES).toHaveLength(106)
    expect(SHIPPED_GLOSSES).toContain('thank you') // retained from P3M2c
    expect(SHIPPED_GLOSSES).toContain('hungry') // P4M10 promotion
    expect(SHIPPED_GLOSSES).toContain('apple') // P4M16 download promotion
    expect(SHIPPED_GLOSSES).toContain('orange') // P4M16
    expect(SHIPPED_GLOSSES).toContain('grandmother') // P4M16
    expect(SHIPPED_GLOSSES).toContain('woman') // current sign retained (no-demote)
    expect(SHIPPED_GLOSSES).not.toContain('dog') // on-disk P4M15 — still not shipped
    expect(SHIPPED_GLOSSES).not.toContain('night') // P4M16 download below gate (0.00)
    expect(SHIPPED_GLOSSES).not.toContain('pencil') // P4M16 download below gate (0.10)
  })

  it('has no duplicate glosses', () => {
    expect(new Set(SHIPPED_GLOSSES).size).toBe(SHIPPED_GLOSSES.length)
  })
})
