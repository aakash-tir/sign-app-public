import type { AttemptOutcome, WordProgress } from './types'
import { PROMOTION_THRESHOLD } from './types'

/** A fresh word starts in need-practice (per the product spec). */
export function newWordProgress(wordId: string): WordProgress {
  return {
    wordId,
    bucket: 'need-practice',
    needPracticeStreak: 0,
    learnProficiency: 0,
    timesSeen: 0,
    lastSeenAt: 0,
  }
}

/**
 * Apply one attempt's terminal outcome to a word's progress, returning a NEW
 * object (pure). This is the single bucket transition committed per attempt
 * (ADR-008), implementing the spec's promotion/demotion rules:
 *
 * - correct + need-practice: streak += 1; promote to confident at 3.
 * - correct + confident:     stays confident.
 * - wrong + need-practice:   streak resets to 0, stays need-practice.
 * - wrong + confident:       demote to need-practice, streak 0.
 */
export function applyOutcome(
  progress: WordProgress,
  outcome: AttemptOutcome,
  now: number = Date.now(),
): WordProgress {
  const base: WordProgress = {
    ...progress,
    timesSeen: progress.timesSeen + 1,
    lastSeenAt: now,
  }

  if (outcome === 'correct') {
    if (base.bucket === 'confident') {
      return base
    }
    const streak = base.needPracticeStreak + 1
    if (streak >= PROMOTION_THRESHOLD) {
      return { ...base, bucket: 'confident', needPracticeStreak: 0 }
    }
    return { ...base, needPracticeStreak: streak }
  }

  // outcome === 'wrong'
  if (base.bucket === 'confident') {
    return { ...base, bucket: 'need-practice', needPracticeStreak: 0 }
  }
  return { ...base, needPracticeStreak: 0 }
}
