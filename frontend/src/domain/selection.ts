import type { Rng } from './rng'
import type { WordProgress } from './types'
import { NEED_PRACTICE_PROBABILITY, NO_REPEAT_WINDOW } from './types'

/**
 * Prepend `id` to the most-recent-first recent list, de-duplicated and capped at
 * `window`. Used to enforce the no-repeat window.
 */
export function rememberRecent(
  recentIds: readonly string[],
  id: string,
  window: number = NO_REPEAT_WINDOW,
): string[] {
  return [id, ...recentIds.filter((existing) => existing !== id)].slice(
    0,
    window,
  )
}

/**
 * Pick the next practice word (pure). Honors the spec's two rules:
 *
 * - **No repeat within 10:** the most-recent `min(10, bank.length - 1)` words are
 *   excluded — so for a small bank the window shrinks "as large as possible"
 *   (you cycle through all words before any repeats), and a 1-word bank always
 *   returns that word.
 * - **1:2 confident:need-practice bias:** when both buckets are available, a
 *   need-practice word is chosen with probability 2/3.
 *
 * Returns `null` only when the bank is empty.
 */
export function selectNextWord(
  bank: readonly WordProgress[],
  recentIds: readonly string[],
  rng: Rng = Math.random,
): WordProgress | null {
  if (bank.length === 0) {
    return null
  }

  const effectiveWindow = Math.min(NO_REPEAT_WINDOW, bank.length - 1)
  const blocked = new Set(recentIds.slice(0, effectiveWindow))
  const eligible = bank.filter((word) => !blocked.has(word.wordId))

  const needPractice = eligible.filter((w) => w.bucket === 'need-practice')
  const confident = eligible.filter((w) => w.bucket === 'confident')

  let pool: WordProgress[]
  if (needPractice.length > 0 && confident.length > 0) {
    pool = rng() < NEED_PRACTICE_PROBABILITY ? needPractice : confident
  } else {
    pool = needPractice.length > 0 ? needPractice : confident
  }

  const index = Math.floor(rng() * pool.length)
  return pool[index] ?? null
}

/**
 * Stateful helper around {@link selectNextWord} that tracks the recent window
 * across calls. Pure selection logic stays in the functions above.
 */
export class PracticeSession {
  private recent: string[] = []
  private readonly rng: Rng

  constructor(rng: Rng = Math.random) {
    this.rng = rng
  }

  next(bank: readonly WordProgress[]): WordProgress | null {
    const choice = selectNextWord(bank, this.recent, this.rng)
    if (choice) {
      this.recent = rememberRecent(this.recent, choice.wordId)
    }
    return choice
  }

  get recentIds(): readonly string[] {
    return this.recent
  }

  reset(): void {
    this.recent = []
  }
}
