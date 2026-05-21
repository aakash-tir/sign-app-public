import { describe, it, expect } from 'vitest'
import { PracticeSession, rememberRecent, selectNextWord } from './selection'
import { mulberry32 } from './rng'
import type { Bucket, WordProgress } from './types'

function word(id: string, bucket: Bucket): WordProgress {
  return {
    wordId: id,
    bucket,
    needPracticeStreak: 0,
    learnProficiency: 0,
    timesSeen: 0,
    lastSeenAt: 0,
  }
}

function bankOf(count: number, bucket: Bucket, prefix = 'w'): WordProgress[] {
  return Array.from({ length: count }, (_, i) => word(`${prefix}${i}`, bucket))
}

describe('rememberRecent', () => {
  it('prepends, de-duplicates, and caps at the window', () => {
    let recent: string[] = []
    recent = rememberRecent(recent, 'a', 3)
    recent = rememberRecent(recent, 'b', 3)
    recent = rememberRecent(recent, 'a', 3) // moves 'a' to front, no dup
    expect(recent).toEqual(['a', 'b'])
    recent = rememberRecent(recent, 'c', 3)
    recent = rememberRecent(recent, 'd', 3) // caps at 3
    expect(recent).toEqual(['d', 'c', 'a'])
  })
})

describe('selectNextWord', () => {
  it('returns null for an empty bank', () => {
    expect(selectNextWord([], [], mulberry32(1))).toBeNull()
  })

  it('always returns the only word in a 1-word bank', () => {
    const bank = bankOf(1, 'need-practice')
    const rng = mulberry32(1)
    for (let i = 0; i < 5; i++) {
      expect(selectNextWord(bank, ['w0'], rng)?.wordId).toBe('w0')
    }
  })

  it('only picks from the non-empty bucket (all need-practice)', () => {
    const bank = bankOf(5, 'need-practice')
    const session = new PracticeSession(mulberry32(2))
    for (let i = 0; i < 50; i++) {
      expect(session.next(bank)?.bucket).toBe('need-practice')
    }
  })

  it('only picks from the non-empty bucket (all confident)', () => {
    const bank = bankOf(5, 'confident')
    const session = new PracticeSession(mulberry32(3))
    for (let i = 0; i < 50; i++) {
      expect(session.next(bank)?.bucket).toBe('confident')
    }
  })

  it('never repeats within the no-repeat window for a large bank', () => {
    const bank = bankOf(20, 'need-practice')
    const session = new PracticeSession(mulberry32(4))
    const history: string[] = []
    for (let i = 0; i < 200; i++) {
      const id = session.next(bank)?.wordId
      expect(id).toBeDefined()
      expect(history.slice(-10)).not.toContain(id)
      history.push(id as string)
    }
  })

  it('cycles through a small bank before repeating (window shrinks)', () => {
    const bank = bankOf(5, 'need-practice')
    const session = new PracticeSession(mulberry32(5))
    const ids: string[] = []
    for (let i = 0; i < 25; i++) {
      ids.push(session.next(bank)?.wordId as string)
    }
    // Every 5 consecutive picks should be the 5 distinct words.
    for (let i = 0; i + 5 <= ids.length; i += 5) {
      expect(new Set(ids.slice(i, i + 5)).size).toBe(5)
    }
  })

  it('holds the 1:2 confident:need-practice ratio on average', () => {
    const bank = [
      ...bankOf(30, 'need-practice', 'n'),
      ...bankOf(30, 'confident', 'c'),
    ]
    const session = new PracticeSession(mulberry32(42))
    let needCount = 0
    const total = 6000
    for (let i = 0; i < total; i++) {
      if (session.next(bank)?.bucket === 'need-practice') needCount++
    }
    const ratio = needCount / total
    expect(ratio).toBeGreaterThan(0.63)
    expect(ratio).toBeLessThan(0.7)
  })
})
