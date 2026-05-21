/** Practice buckets a word can be in. */
export type Bucket = 'need-practice' | 'confident'

/** The single committed result of one practice attempt (see ADR-008). */
export type AttemptOutcome = 'correct' | 'wrong'

/** Consecutive correct answers in need-practice required to promote to confident. */
export const PROMOTION_THRESHOLD = 3

/** A word must not reappear within this many displayed words (when possible). */
export const NO_REPEAT_WINDOW = 10

/** P(show a need-practice word) when both buckets are available — the 1:2 bias. */
export const NEED_PRACTICE_PROBABILITY = 2 / 3

export type Level = 'beginner' | 'intermediate' | 'expert'

/** Confident words required to unlock beginner sentences (ADR-009). */
export const SENTENCE_UNLOCK_THRESHOLD = 20

export interface Word {
  id: string
  gloss: string
  level?: Level
}

export interface UserProfile {
  level: Level
  /** Latch: true once confident-word count first reaches the threshold. */
  sentencesUnlocked: boolean
}

export function defaultProfile(): UserProfile {
  return { level: 'beginner', sentencesUnlocked: false }
}

export interface WordProgress {
  wordId: string
  bucket: Bucket
  /** Consecutive correct answers while in need-practice (resets on wrong). */
  needPracticeStreak: number
  /** Learn-mode proficiency (used in M5); kept here as the canonical record. */
  learnProficiency: number
  timesSeen: number
  lastSeenAt: number
}
