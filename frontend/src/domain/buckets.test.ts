import { describe, it, expect } from 'vitest'
import { applyOutcome, newWordProgress } from './buckets'
import type { WordProgress } from './types'

describe('newWordProgress', () => {
  it('starts a word in need-practice with a zero streak', () => {
    const p = newWordProgress('hello')
    expect(p.bucket).toBe('need-practice')
    expect(p.needPracticeStreak).toBe(0)
    expect(p.timesSeen).toBe(0)
  })
})

describe('applyOutcome', () => {
  it('increments the streak on a correct need-practice answer', () => {
    const p = applyOutcome(newWordProgress('w'), 'correct', 1)
    expect(p.bucket).toBe('need-practice')
    expect(p.needPracticeStreak).toBe(1)
    expect(p.timesSeen).toBe(1)
    expect(p.lastSeenAt).toBe(1)
  })

  it('promotes to confident after 3 correct answers', () => {
    let p = newWordProgress('w')
    p = applyOutcome(p, 'correct', 1)
    p = applyOutcome(p, 'correct', 2)
    expect(p.bucket).toBe('need-practice')
    p = applyOutcome(p, 'correct', 3)
    expect(p.bucket).toBe('confident')
    expect(p.needPracticeStreak).toBe(0)
  })

  it('resets the streak on a wrong need-practice answer', () => {
    let p = applyOutcome(newWordProgress('w'), 'correct', 1)
    p = applyOutcome(p, 'wrong', 2)
    expect(p.bucket).toBe('need-practice')
    expect(p.needPracticeStreak).toBe(0)
  })

  it('keeps a confident word confident on a correct answer', () => {
    const confident: WordProgress = {
      ...newWordProgress('w'),
      bucket: 'confident',
    }
    const p = applyOutcome(confident, 'correct', 5)
    expect(p.bucket).toBe('confident')
    expect(p.needPracticeStreak).toBe(0)
  })

  it('demotes a confident word to need-practice on a wrong answer', () => {
    const confident: WordProgress = {
      ...newWordProgress('w'),
      bucket: 'confident',
    }
    const p = applyOutcome(confident, 'wrong', 5)
    expect(p.bucket).toBe('need-practice')
    expect(p.needPracticeStreak).toBe(0)
  })

  it('handles demote then re-promote', () => {
    let p: WordProgress = { ...newWordProgress('w'), bucket: 'confident' }
    p = applyOutcome(p, 'wrong', 1) // -> need-practice
    expect(p.bucket).toBe('need-practice')
    p = applyOutcome(p, 'correct', 2)
    p = applyOutcome(p, 'correct', 3)
    p = applyOutcome(p, 'correct', 4) // 3 in a row -> confident
    expect(p.bucket).toBe('confident')
  })

  it('does not mutate the input', () => {
    const original = newWordProgress('w')
    const snapshot = { ...original }
    applyOutcome(original, 'correct', 1)
    expect(original).toEqual(snapshot)
  })
})
