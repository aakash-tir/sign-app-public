import type { Level } from './types'
import type { Rng } from './rng'

/**
 * A multi-sign sentence for the Sentences section (Phase 5, ADR-028): a short,
 * conservative gloss-order sequence — a sequencing exercise ("sign these words
 * in order"), not a claim of full ASL grammar (ADR-012). `id` is the joined
 * gloss string: stable and derivable, so persisted progress keys survive
 * reorderings of the content file.
 */
export type SignSentence = {
  readonly id: string
  readonly signs: readonly string[]
}

/** Build a sentence from its signs; the id is the joined gloss string. */
export function sentenceOf(signs: readonly string[]): SignSentence {
  return { id: signs.join(' '), signs }
}

/**
 * Per-level sentence length bands (signs), within the ADR-009 "small = 2–4"
 * frame: beginners start shortest; expert skips the 2-sign warm-ups. Starting
 * values, tunable (ADR-028).
 */
export const LEVEL_LENGTH_BANDS: Record<
  Level,
  { readonly min: number; readonly max: number }
> = {
  beginner: { min: 2, max: 3 },
  intermediate: { min: 2, max: 4 },
  expert: { min: 3, max: 4 },
}

/**
 * Sentences the learner can perform right now: every sign `confident`
 * (ADR-009 — sentences are built only from words the user knows) and the
 * length within the level's band. Preserves bank order; pure.
 */
export function eligibleSentences(
  bank: readonly SignSentence[],
  confident: ReadonlySet<string>,
  level: Level,
): SignSentence[] {
  const { min, max } = LEVEL_LENGTH_BANDS[level]
  return bank.filter(
    (s) =>
      s.signs.length >= min &&
      s.signs.length <= max &&
      s.signs.every((sign) => confident.has(sign)),
  )
}

/**
 * Pick the next sentence to drill. Prefers sentences **not yet completed**
 * (persisted progress, FR-6); once everything eligible is completed it recycles
 * the whole pool. Avoids returning `currentId` again whenever an alternative
 * exists. Injected `rng` keeps this deterministic in tests (frontend rules —
 * no direct `Math.random` in domain logic).
 */
export function pickSentence(
  eligible: readonly SignSentence[],
  completedIds: ReadonlySet<string>,
  rng: Rng = Math.random,
  currentId: string | null = null,
): SignSentence | null {
  if (eligible.length === 0) return null
  const fresh = eligible.filter((s) => !completedIds.has(s.id))
  let pool = fresh.length > 0 ? fresh : eligible
  if (currentId !== null && pool.length > 1) {
    pool = pool.filter((s) => s.id !== currentId)
  }
  return pool[Math.floor(rng() * pool.length)] ?? null
}
