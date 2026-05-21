import { describe, it, expect } from 'vitest'
import { LabelStabilizer } from './debounce'

describe('LabelStabilizer', () => {
  it('requires N consecutive frames before a label becomes stable', () => {
    const s = new LabelStabilizer(3)
    expect(s.push('A')).toBe(null)
    expect(s.push('A')).toBe(null)
    expect(s.push('A')).toBe('A')
  })

  it('resets the streak when the candidate changes', () => {
    const s = new LabelStabilizer(3)
    s.push('A')
    s.push('A')
    expect(s.push('B')).toBe(null) // streak restarted, nothing stable yet
    s.push('B')
    expect(s.push('B')).toBe('B')
  })

  it('keeps the last stable label across null frames', () => {
    const s = new LabelStabilizer(2)
    s.push('A')
    expect(s.push('A')).toBe('A')
    expect(s.push(null)).toBe('A')
    expect(s.stable).toBe('A')
  })

  it('switches the stable label after enough new frames', () => {
    const s = new LabelStabilizer(2)
    s.push('A')
    s.push('A')
    s.push('B')
    expect(s.push('B')).toBe('B')
  })

  it('reset clears all state', () => {
    const s = new LabelStabilizer(1)
    s.push('A')
    s.reset()
    expect(s.stable).toBe(null)
  })

  it('throws when required < 1', () => {
    expect(() => new LabelStabilizer(0)).toThrow()
  })
})
