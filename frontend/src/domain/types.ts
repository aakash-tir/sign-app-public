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

export interface Word {
  id: string
  gloss: string
  level?: 'beginner' | 'intermediate' | 'expert'
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
