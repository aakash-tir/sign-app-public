import type { SignSentence } from './sentences'

/**
 * The learning route for the learner app (Phase 6, ADR-029): ordered units of
 * small sets — word sets of 1–2 signs, letter batches of 2–3 — traversed
 * **linearly with review** (plan.md §6 Q3). Pure and framework-free (frontend
 * rules): the recognized-vocabulary set is always injected, never imported, so
 * reconciliation (Q6) is *derived* — a route word is a `placeholder` exactly
 * when the recognizer can't verify it yet, and the tag can never drift from
 * the shipped vocabulary.
 */
export type CurriculumSet = {
  readonly id: string
  readonly signs: readonly string[]
}

export type CurriculumUnit = {
  readonly id: string
  readonly title: string
  readonly sets: readonly CurriculumSet[]
}

/** Build a set from its signs; the id is the joined sign string (stable, derivable). */
export function curriculumSetOf(signs: readonly string[]): CurriculumSet {
  return { id: signs.join(' '), signs }
}

/**
 * Q6: a route word the recognizer can't verify yet is a **placeholder slot** —
 * shown where it would be taught, but not taught, verified, or recalled until
 * the owner adds it (model-track expansion).
 */
export type WordStatus = 'recognized' | 'placeholder'

export function wordStatus(
  sign: string,
  recognized: ReadonlySet<string>,
): WordStatus {
  return recognized.has(sign) ? 'recognized' : 'placeholder'
}

/** The signs of a set the app can actually teach (and later draw into recall). */
export function teachableSigns(
  set: CurriculumSet,
  recognized: ReadonlySet<string>,
): string[] {
  return set.signs.filter((sign) => recognized.has(sign))
}

/** True when every sign in the set is a placeholder — the set renders a stub. */
export function isPlaceholderOnlySet(
  set: CurriculumSet,
  recognized: ReadonlySet<string>,
): boolean {
  return teachableSigns(set, recognized).length === 0
}

/** Units → the flat, ordered route the traversal functions operate on. */
export function flattenRoute(
  units: readonly CurriculumUnit[],
): CurriculumSet[] {
  return units.flatMap((unit) => [...unit.sets])
}

/**
 * Linear-with-review access (Q3): completed sets stay open for review, exactly
 * one set is `current` (teachable next), everything beyond is `locked`.
 * Placeholder-only sets (Q6) are never `current` and never block progression —
 * they render as "coming soon" stubs wherever they sit in the route.
 */
export type SetAccess = 'completed' | 'current' | 'locked' | 'placeholder'

export function routeAccess(
  route: readonly CurriculumSet[],
  completedIds: ReadonlySet<string>,
  recognized: ReadonlySet<string>,
): SetAccess[] {
  let currentAssigned = false
  return route.map((set) => {
    if (isPlaceholderOnlySet(set, recognized)) return 'placeholder'
    if (completedIds.has(set.id)) return 'completed'
    if (!currentAssigned) {
      currentAssigned = true
      return 'current'
    }
    return 'locked'
  })
}

/** All recognized signs of completed sets — the learner's usable pool. */
export function learnedPool(
  route: readonly CurriculumSet[],
  completedIds: ReadonlySet<string>,
  recognized: ReadonlySet<string>,
): Set<string> {
  const pool = new Set<string>()
  for (const set of route) {
    if (!completedIds.has(set.id)) continue
    for (const sign of teachableSigns(set, recognized)) pool.add(sign)
  }
  return pool
}

/** The bank sentences whose every sign is already in the pool. */
export function sentencesBuildableFrom(
  bank: readonly SignSentence[],
  pool: ReadonlySet<string>,
): SignSentence[] {
  return bank.filter((sentence) =>
    sentence.signs.every((sign) => pool.has(sign)),
  )
}

/**
 * The plan's ordering rule (plan.md §2.1): after **each** set, the pool of
 * recognized words learned so far must build ≥ 1 bank sentence. Returns the
 * per-prefix truth so the content test can pinpoint exactly which set breaks
 * the rule. Placeholder words never count toward the pool (Q6).
 */
export function routeConstructibility(
  route: readonly CurriculumSet[],
  bank: readonly SignSentence[],
  recognized: ReadonlySet<string>,
): boolean[] {
  const pool = new Set<string>()
  return route.map((set) => {
    for (const sign of teachableSigns(set, recognized)) pool.add(sign)
    return sentencesBuildableFrom(bank, pool).length > 0
  })
}

/**
 * Sentences to stage right after a set completes (plan.md §2.3 path 2 —
 * "after a set completes, use those words in sentences"): buildable from the
 * learner's pool, preferring sentences that **use at least one just-learned
 * sign**; when none exist (not every set's words appear in the bank), any
 * buildable sentence is still useful pool practice. Note the course pool is
 * the **learned** pool — the standalone Sentences tab keeps its stricter
 * all-`confident` eligibility (ADR-009).
 */
export function stageSentenceCandidates(
  bank: readonly SignSentence[],
  pool: ReadonlySet<string>,
  newSigns: readonly string[],
): SignSentence[] {
  const buildable = sentencesBuildableFrom(bank, pool)
  const usesNew = buildable.filter((sentence) =>
    sentence.signs.some((sign) => newSigns.includes(sign)),
  )
  return usesNew.length > 0 ? usesNew : buildable
}

/**
 * The placeholder words in route order, deduped (a word's first slot wins) —
 * the **priority queue** for the next model-vocabulary expansion (plan.md
 * §2.1; the MS-ASL download → retrain → honest-gate pipeline).
 */
export function priorityWords(
  units: readonly CurriculumUnit[],
  recognized: ReadonlySet<string>,
): string[] {
  const seen = new Set<string>()
  const queue: string[] = []
  for (const set of flattenRoute(units)) {
    for (const sign of set.signs) {
      if (recognized.has(sign) || seen.has(sign)) continue
      seen.add(sign)
      queue.push(sign)
    }
  }
  return queue
}

/** One unit's progress (P6M8, #60). Placeholder-only sets (Q6) are not counted. */
export type UnitProgress = {
  readonly unitId: string
  readonly title: string
  readonly setsDone: number
  readonly setsTotal: number
  /** True once every teachable set is done; never true for an all-placeholder unit. */
  readonly isComplete: boolean
}

export type CourseProgress = {
  readonly units: readonly UnitProgress[]
  readonly setsDone: number
  readonly setsTotal: number
  readonly unitsDone: number
  /** Units with at least one teachable set — an all-placeholder unit is left out. */
  readonly unitsTotal: number
}

/**
 * Visible progress for the learner (P6M8, #60): sets and units completed, per unit
 * and overall. Totals count only what the app can teach today — a placeholder-only
 * set (Q6) is neither done nor counted, so a learner can always reach 100 %. Stale
 * completion ids (a set whose signs were later edited) are ignored, since only the
 * route's current set ids are looked up.
 */
export function courseProgress(
  units: readonly CurriculumUnit[],
  completedIds: ReadonlySet<string>,
  recognized: ReadonlySet<string>,
): CourseProgress {
  const unitProgress = units.map((unit): UnitProgress => {
    const teachable = unit.sets.filter(
      (set) => !isPlaceholderOnlySet(set, recognized),
    )
    const setsDone = teachable.filter((set) => completedIds.has(set.id)).length
    return {
      unitId: unit.id,
      title: unit.title,
      setsDone,
      setsTotal: teachable.length,
      isComplete: teachable.length > 0 && setsDone === teachable.length,
    }
  })
  const counted = unitProgress.filter((unit) => unit.setsTotal > 0)
  return {
    units: unitProgress,
    setsDone: counted.reduce((sum, unit) => sum + unit.setsDone, 0),
    setsTotal: counted.reduce((sum, unit) => sum + unit.setsTotal, 0),
    unitsDone: counted.filter((unit) => unit.isComplete).length,
    unitsTotal: counted.length,
  }
}
