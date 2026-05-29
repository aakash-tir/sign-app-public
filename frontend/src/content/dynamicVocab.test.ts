import { describe, it, expect } from 'vitest'
import { SHIPPED_GLOSSES, shippedLabels } from './dynamicVocab'

describe('shippedLabels', () => {
  it('drops glosses held back by the accuracy gate', () => {
    const modelLabels = ['drink', 'good', 'help', 'thank you', 'family']
    expect(shippedLabels(modelLabels)).toEqual(['drink', 'help', 'family'])
  })

  it('preserves the model label order', () => {
    expect(shippedLabels(['help', 'drink', 'yes'])).toEqual([
      'help',
      'drink',
      'yes',
    ])
  })

  it('ships the 20 glosses that clear the honest signer-disjoint gate (P3M2)', () => {
    expect(SHIPPED_GLOSSES).toHaveLength(20)
    expect(SHIPPED_GLOSSES).toContain('like') // P3M2 promotion on MS-ASL ∪ WLASL
    expect(SHIPPED_GLOSSES).toContain('bad')
    expect(SHIPPED_GLOSSES).toContain('happy')
    expect(SHIPPED_GLOSSES).not.toContain('good') // demoted under the honest gate
    expect(SHIPPED_GLOSSES).not.toContain('before')
    expect(SHIPPED_GLOSSES).not.toContain('tall')
    expect(SHIPPED_GLOSSES).not.toContain('thank you') // still held back
  })
})
