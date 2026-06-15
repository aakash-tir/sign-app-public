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

  it('ships the 79 glosses that clear the honest signer-disjoint gate (P4M10)', () => {
    // Label smoothing (0.15) lifted honest CV 0.687 → 0.732; re-gate at ≥ 0.50.
    expect(SHIPPED_GLOSSES).toHaveLength(79)
    expect(SHIPPED_GLOSSES).toContain('thank you') // retained from P3M2c
    expect(SHIPPED_GLOSSES).toContain('good') // P4M5 promotion
    expect(SHIPPED_GLOSSES).toContain('woman') // retained (no-demote-on-noise)
    expect(SHIPPED_GLOSSES).toContain('hungry') // P4M10 promotion (recovered ≥ 0.50)
    expect(SHIPPED_GLOSSES).toContain('come') // P4M10 promotion
    expect(SHIPPED_GLOSSES).toContain('mother') // P4M10 promotion
    expect(SHIPPED_GLOSSES).toContain('sleep') // P4M10 promotion
    expect(SHIPPED_GLOSSES).not.toContain('dog') // still below (0.38 honestly)
    expect(SHIPPED_GLOSSES).not.toContain('stop') // still below (0.47 honestly)
  })

  it('has no duplicate glosses', () => {
    expect(new Set(SHIPPED_GLOSSES).size).toBe(SHIPPED_GLOSSES.length)
  })
})
