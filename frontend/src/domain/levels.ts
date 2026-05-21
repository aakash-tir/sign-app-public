import type { Level } from './types'
import { SENTENCE_UNLOCK_THRESHOLD } from './types'

/** Beginner small-sentence length range (signs), per ADR-009. */
export const SMALL_SENTENCE_MIN = 2
export const SMALL_SENTENCE_MAX = 4

/**
 * Latch update: once the confident-word count first reaches the threshold,
 * sentences stay unlocked (ADR-010) so the gate doesn't flap on demotions.
 */
export function nextSentencesUnlocked(
  current: boolean,
  confidentCount: number,
): boolean {
  return current || confidentCount >= SENTENCE_UNLOCK_THRESHOLD
}

/**
 * Whether sentence usage is active for a profile (ADR-009): on for
 * intermediate/expert; for beginner only once the unlock latch is set.
 */
export function sentencesEnabled(
  level: Level,
  sentencesUnlocked: boolean,
): boolean {
  return level !== 'beginner' || sentencesUnlocked
}
