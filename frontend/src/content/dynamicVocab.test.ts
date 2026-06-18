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

  it('ships the 103 glosses that clear the honest signer-disjoint gate (P4M17)', () => {
    // P4M16 shipped 106 from a 36-gloss MS-ASL download; P4M17 dropped 3 new glosses
    // (dance/paper/slow) that confused existing stand/school → 103.
    expect(SHIPPED_GLOSSES).toHaveLength(103)
    expect(SHIPPED_GLOSSES).toContain('thank you') // retained from P3M2c
    expect(SHIPPED_GLOSSES).toContain('apple') // P4M16 download promotion
    expect(SHIPPED_GLOSSES).toContain('orange') // P4M16
    expect(SHIPPED_GLOSSES).toContain('grandmother') // P4M16
    expect(SHIPPED_GLOSSES).toContain('stand') // P4M17: restored (kept; recovers)
    expect(SHIPPED_GLOSSES).not.toContain('dance') // P4M17: dropped (confused stand)
    expect(SHIPPED_GLOSSES).not.toContain('paper') // P4M17: dropped (confused school)
    expect(SHIPPED_GLOSSES).not.toContain('slow') // P4M17: dropped (confused school)
    expect(SHIPPED_GLOSSES).not.toContain('dog') // on-disk P4M15 — still not shipped
    expect(SHIPPED_GLOSSES).not.toContain('night') // P4M16 download below gate (0.00)
  })

  it('has no duplicate glosses', () => {
    expect(new Set(SHIPPED_GLOSSES).size).toBe(SHIPPED_GLOSSES.length)
  })
})
