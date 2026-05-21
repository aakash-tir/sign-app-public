import { describe, it, expect } from 'vitest'
import { nextSentencesUnlocked, sentencesEnabled } from './levels'
import { SENTENCE_UNLOCK_THRESHOLD } from './types'

describe('sentencesEnabled', () => {
  it('is always on for intermediate and expert', () => {
    expect(sentencesEnabled('intermediate', false)).toBe(true)
    expect(sentencesEnabled('expert', false)).toBe(true)
  })

  it('is off for beginner until the unlock latch is set', () => {
    expect(sentencesEnabled('beginner', false)).toBe(false)
    expect(sentencesEnabled('beginner', true)).toBe(true)
  })
})

describe('nextSentencesUnlocked', () => {
  it('latches true once the confident count reaches the threshold', () => {
    expect(nextSentencesUnlocked(false, SENTENCE_UNLOCK_THRESHOLD - 1)).toBe(
      false,
    )
    expect(nextSentencesUnlocked(false, SENTENCE_UNLOCK_THRESHOLD)).toBe(true)
  })

  it('stays true even if the count later drops (no flapping)', () => {
    expect(nextSentencesUnlocked(true, 0)).toBe(true)
  })
})
