import { describe, it, expect } from 'vitest'
import { curriculumSetOf } from './curriculum'
import { mulberry32 } from './rng'
import {
  startRecallSession,
  confirmTaught,
  nextRecallPrompt,
  recordRecallOutcome,
  dueNewSigns,
  recallProgress,
  RECALL_TARGET_REPS,
  REVIEW_INTERLEAVE_EVERY,
  type RecallSession,
} from './recall'

const recognized = new Set(['want', 'eat', 'drink', 'water', 'more', 'please'])
const pool = new Set(['drink', 'water'])
const emptyPool = new Set<string>()

const wantEat = curriculumSetOf(['want', 'eat'])

/** Drive a session through the teach phase into recall. */
function taught(session: RecallSession): RecallSession {
  let s = session
  while (s.phase === 'teach') s = confirmTaught(s)
  return s
}

describe('startRecallSession', () => {
  it('starts teaching the first sign of the set', () => {
    const s = startRecallSession(wantEat, recognized)
    expect(s.phase).toBe('teach')
    expect(s.teaching).toBe('want')
    expect(s.teachQueue).toEqual(['eat'])
    expect(s.newSigns).toEqual(['want', 'eat'])
    expect(s.reps).toEqual({ want: 0, eat: 0 })
    expect(s.targetReps).toBe(RECALL_TARGET_REPS)
  })

  it('excludes placeholder signs from teaching and drilling', () => {
    const s = startRecallSession(curriculumSetOf(['you', 'want']), recognized)
    expect(s.newSigns).toEqual(['want'])
    expect(s.teaching).toBe('want')
    expect(s.teachQueue).toEqual([])
  })

  it('a placeholder-only set starts already complete', () => {
    const s = startRecallSession(curriculumSetOf(['you', 'me']), recognized)
    expect(s.phase).toBe('complete')
    expect(s.teaching).toBeNull()
  })

  it('accepts a custom recall target', () => {
    const s = startRecallSession(wantEat, recognized, 1)
    expect(s.targetReps).toBe(1)
  })
})

describe('confirmTaught', () => {
  it('advances through the teach queue then enters recall', () => {
    let s = startRecallSession(wantEat, recognized)
    s = confirmTaught(s)
    expect(s.phase).toBe('teach')
    expect(s.teaching).toBe('eat')
    s = confirmTaught(s)
    expect(s.phase).toBe('recall')
    expect(s.teaching).toBeNull()
    expect(s.prompt).toBeNull()
  })

  it('is a no-op outside the teach phase', () => {
    const s = taught(startRecallSession(wantEat, recognized))
    expect(confirmTaught(s)).toBe(s)
  })
})

describe('nextRecallPrompt', () => {
  it('is a no-op outside the recall phase or with a prompt pending', () => {
    const teachPhase = startRecallSession(wantEat, recognized)
    expect(nextRecallPrompt(teachPhase, pool, mulberry32(1))).toBe(teachPhase)

    const withPrompt = nextRecallPrompt(taught(teachPhase), pool, mulberry32(1))
    expect(withPrompt.prompt).not.toBeNull()
    expect(nextRecallPrompt(withPrompt, pool, mulberry32(1))).toBe(withPrompt)
  })

  it('prompts only due new signs before any review turn', () => {
    const s = nextRecallPrompt(
      taught(startRecallSession(wantEat, recognized)),
      pool,
      mulberry32(7),
    )
    expect(s.prompt?.kind).toBe('new')
    expect(['want', 'eat']).toContain(s.prompt?.sign)
    expect(s.sinceReview).toBe(1)
  })

  it(`every ${REVIEW_INTERLEAVE_EVERY}rd prompt reviews the learned pool`, () => {
    const rng = mulberry32(42)
    let s = taught(startRecallSession(wantEat, recognized))
    const kinds: string[] = []
    for (let i = 0; i < REVIEW_INTERLEAVE_EVERY * 2; i++) {
      s = nextRecallPrompt(s, pool, rng)
      kinds.push(s.prompt?.kind ?? 'none')
      // Answer wrong so new signs stay due and the session keeps going.
      s = recordRecallOutcome(s, 'wrong')
    }
    expect(kinds).toEqual(['new', 'new', 'review', 'new', 'new', 'review'])
  })

  it('review prompts draw from the pool, not the set', () => {
    const rng = mulberry32(3)
    let s = taught(startRecallSession(wantEat, recognized))
    for (let i = 0; i < REVIEW_INTERLEAVE_EVERY; i++) {
      s = nextRecallPrompt(s, pool, rng)
      if (i < REVIEW_INTERLEAVE_EVERY - 1) {
        s = recordRecallOutcome(s, 'wrong')
      }
    }
    expect(s.prompt?.kind).toBe('review')
    expect([...pool]).toContain(s.prompt?.sign)
  })

  it('never reviews when the pool is empty — all prompts drill new signs', () => {
    const rng = mulberry32(9)
    let s = taught(startRecallSession(wantEat, recognized))
    for (let i = 0; i < 6; i++) {
      s = nextRecallPrompt(s, emptyPool, rng)
      expect(s.prompt?.kind).toBe('new')
      s = recordRecallOutcome(s, 'wrong')
    }
  })

  it('avoids the immediately previous sign when an alternative exists', () => {
    const rng = mulberry32(11)
    let s = taught(startRecallSession(wantEat, recognized))
    let last: string | null = null
    for (let i = 0; i < 8; i++) {
      s = nextRecallPrompt(s, emptyPool, rng)
      expect(s.prompt?.sign).not.toBe(last)
      last = s.prompt?.sign ?? null
      s = recordRecallOutcome(s, 'wrong')
    }
  })

  it('repeats the same sign when it is the only one due', () => {
    const rng = mulberry32(5)
    let s = taught(startRecallSession(curriculumSetOf(['want']), recognized))
    s = nextRecallPrompt(s, emptyPool, rng)
    expect(s.prompt?.sign).toBe('want')
    s = recordRecallOutcome(s, 'wrong')
    s = nextRecallPrompt(s, emptyPool, rng)
    expect(s.prompt?.sign).toBe('want')
  })

  it('is deterministic under a seeded rng', () => {
    const run = () => {
      const rng = mulberry32(1234)
      let s = taught(startRecallSession(wantEat, recognized))
      const signs: (string | undefined)[] = []
      for (let i = 0; i < 5; i++) {
        s = nextRecallPrompt(s, pool, rng)
        signs.push(s.prompt?.sign)
        s = recordRecallOutcome(s, 'wrong')
      }
      return signs
    }
    expect(run()).toEqual(run())
  })
})

describe('recordRecallOutcome', () => {
  it('correct on a new sign counts toward its target', () => {
    let s = taught(startRecallSession(wantEat, recognized))
    s = nextRecallPrompt(s, emptyPool, mulberry32(2))
    const sign = s.prompt?.sign as string
    s = recordRecallOutcome(s, 'correct')
    expect(s.reps[sign]).toBe(1)
    expect(s.prompt).toBeNull()
    expect(s.lastSign).toBe(sign)
  })

  it('wrong never counts — the sign stays due', () => {
    let s = taught(startRecallSession(wantEat, recognized))
    s = nextRecallPrompt(s, emptyPool, mulberry32(2))
    const sign = s.prompt?.sign as string
    s = recordRecallOutcome(s, 'wrong')
    expect(s.reps[sign]).toBe(0)
    expect(dueNewSigns(s)).toContain(sign)
  })

  it('review outcomes never affect completion progress', () => {
    const rng = mulberry32(42)
    let s = taught(startRecallSession(wantEat, recognized))
    for (let i = 0; i < REVIEW_INTERLEAVE_EVERY - 1; i++) {
      s = nextRecallPrompt(s, pool, rng)
      s = recordRecallOutcome(s, 'wrong')
    }
    s = nextRecallPrompt(s, pool, rng)
    expect(s.prompt?.kind).toBe('review')
    const before = { ...s.reps }
    s = recordRecallOutcome(s, 'correct')
    expect(s.reps).toEqual(before)
    expect(s.phase).toBe('recall')
  })

  it('is a no-op without an active prompt', () => {
    const s = taught(startRecallSession(wantEat, recognized))
    expect(recordRecallOutcome(s, 'correct')).toBe(s)
  })

  it('completes the session once every new sign hits the target', () => {
    const rng = mulberry32(8)
    let s = taught(startRecallSession(wantEat, recognized, 1))
    while (s.phase === 'recall') {
      s = nextRecallPrompt(s, emptyPool, rng)
      s = recordRecallOutcome(s, 'correct')
    }
    expect(s.phase).toBe('complete')
    expect(dueNewSigns(s)).toEqual([])
  })
})

describe('recallProgress', () => {
  it('tracks done/total across the set', () => {
    let s = taught(startRecallSession(wantEat, recognized))
    expect(recallProgress(s)).toEqual({
      done: 0,
      total: 2 * RECALL_TARGET_REPS,
    })
    s = nextRecallPrompt(s, emptyPool, mulberry32(2))
    s = recordRecallOutcome(s, 'correct')
    expect(recallProgress(s).done).toBe(1)
  })
})

describe('a full session (teach → drill → complete)', () => {
  it('walks a 2-word set to completion with pool reviews interleaved', () => {
    const rng = mulberry32(2026)
    let s = startRecallSession(wantEat, recognized)

    // Teach both words.
    expect(s.teaching).toBe('want')
    s = confirmTaught(s)
    expect(s.teaching).toBe('eat')
    s = confirmTaught(s)
    expect(s.phase).toBe('recall')

    // Drill correctly to the end; count prompt kinds.
    let reviews = 0
    let news = 0
    let guard = 0
    while (s.phase === 'recall' && guard++ < 50) {
      s = nextRecallPrompt(s, pool, rng)
      if (s.phase !== 'recall') break
      if (s.prompt?.kind === 'review') reviews++
      else news++
      s = recordRecallOutcome(s, 'correct')
    }

    expect(s.phase).toBe('complete')
    // Every new sign hit its target exactly (correct answers only).
    expect(news).toBe(2 * RECALL_TARGET_REPS)
    // Reviews were interleaved but never required for completion.
    expect(reviews).toBeGreaterThan(0)
    expect(recallProgress(s)).toEqual({
      done: 2 * RECALL_TARGET_REPS,
      total: 2 * RECALL_TARGET_REPS,
    })
  })
})
