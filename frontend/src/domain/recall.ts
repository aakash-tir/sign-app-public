import type { CurriculumSet } from './curriculum'
import { teachableSigns } from './curriculum'
import type { Rng } from './rng'
import type { AttemptOutcome } from './types'

/**
 * The teach → recall engine for one curriculum set (Phase 6 / P6M3, ADR-029;
 * plan.md §2.2): teach the set's signs one at a time, then drill recall until
 * every new sign has been recalled correctly `targetReps` times, interleaving
 * recall of the **whole learned pool** so older words stay warm as the
 * vocabulary expands.
 *
 * Pure and framework-free. This machine only orchestrates the flow — bucket
 * transitions stay the job of `applyOutcome` (ADR-008), applied by the glue
 * layer per attempt; "I forgot → view the sign again" is a UI affordance whose
 * outcome arrives here as a normal `wrong`. Set completion feeds the
 * linear-with-review route (`routeAccess`, Q3) via the caller persisting the
 * completed set id. Session-based by design — no wall clock (Q4).
 */

/** Successful recalls each newly taught sign needs ("recall it several times"). */
export const RECALL_TARGET_REPS = 3

/**
 * Every Nth recall prompt reviews a word from the learned pool instead of the
 * new set (plan.md §2.2 "mixed into recall from the whole learned pool").
 */
export const REVIEW_INTERLEAVE_EVERY = 3

export type RecallPhase = 'teach' | 'recall' | 'complete'

export type RecallPromptKind = 'new' | 'review'

export type RecallPrompt = {
  readonly sign: string
  readonly kind: RecallPromptKind
}

export type RecallSession = {
  readonly setId: string
  readonly phase: RecallPhase
  /** Sign currently being taught — non-null exactly in the teach phase. */
  readonly teaching: string | null
  /** Set signs still queued for teaching (after `teaching`). */
  readonly teachQueue: readonly string[]
  /** The set's teachable signs (placeholders already excluded). */
  readonly newSigns: readonly string[]
  /** Correct recalls so far per new sign. */
  readonly reps: Readonly<Record<string, number>>
  /** Correct recalls each new sign needs. */
  readonly targetReps: number
  /** New-sign prompts issued since the last pool-review interleave. */
  readonly sinceReview: number
  /** The active recall prompt — non-null only in the recall phase. */
  readonly prompt: RecallPrompt | null
  /** The last prompted sign (no-immediate-repeat guard). */
  readonly lastSign: string | null
}

/**
 * Start a session for a set. Only teachable (recognized) signs take part —
 * placeholder words are Q6 stubs, never taught or drilled. A set with nothing
 * teachable starts already `complete` (the route renders it as a placeholder
 * slot; completing it is a no-op for progress).
 */
export function startRecallSession(
  set: CurriculumSet,
  recognized: ReadonlySet<string>,
  targetReps: number = RECALL_TARGET_REPS,
): RecallSession {
  const newSigns = teachableSigns(set, recognized)
  const [first, ...rest] = newSigns
  return {
    setId: set.id,
    phase: first === undefined ? 'complete' : 'teach',
    teaching: first ?? null,
    teachQueue: rest,
    newSigns,
    reps: Object.fromEntries(newSigns.map((sign) => [sign, 0])),
    targetReps,
    sinceReview: 0,
    prompt: null,
    lastSign: null,
  }
}

/**
 * The learner has seen (and tried) the current teach card — advance to the
 * next sign, or into the recall phase once every sign is taught. No-op outside
 * the teach phase.
 */
export function confirmTaught(session: RecallSession): RecallSession {
  if (session.phase !== 'teach') return session
  const [next, ...rest] = session.teachQueue
  if (next === undefined) {
    return { ...session, phase: 'recall', teaching: null, teachQueue: [] }
  }
  return { ...session, teaching: next, teachQueue: rest }
}

/** The new signs still short of their recall target. */
export function dueNewSigns(session: RecallSession): string[] {
  return session.newSigns.filter(
    (sign) => (session.reps[sign] ?? 0) < session.targetReps,
  )
}

/** Overall recall progress across the set's new signs (for a progress line). */
export function recallProgress(session: RecallSession): {
  done: number
  total: number
} {
  const total = session.newSigns.length * session.targetReps
  const done = session.newSigns.reduce(
    (sum, sign) => sum + Math.min(session.reps[sign] ?? 0, session.targetReps),
    0,
  )
  return { done, total }
}

/** Avoid the immediately previous sign whenever an alternative exists. */
function avoidLast(candidates: readonly string[], lastSign: string | null) {
  if (candidates.length <= 1) return [...candidates]
  const filtered = candidates.filter((sign) => sign !== lastSign)
  return filtered.length > 0 ? filtered : [...candidates]
}

/**
 * Issue the next recall prompt (recall phase only; no-op otherwise, including
 * when a prompt is already pending). Every `REVIEW_INTERLEAVE_EVERY`-th prompt
 * reviews a random word from the learned `pool` (when it has any); the rest
 * drill the set's due new signs. Never repeats the previous sign when an
 * alternative exists. Injected `rng` per the frontend rules.
 */
export function nextRecallPrompt(
  session: RecallSession,
  pool: ReadonlySet<string>,
  rng: Rng = Math.random,
): RecallSession {
  if (session.phase !== 'recall' || session.prompt !== null) return session

  const due = dueNewSigns(session)
  if (due.length === 0) {
    return { ...session, phase: 'complete' }
  }

  const reviewCandidates = avoidLast([...pool], session.lastSign)
  const isReviewTurn =
    session.sinceReview + 1 >= REVIEW_INTERLEAVE_EVERY &&
    reviewCandidates.length > 0

  if (isReviewTurn) {
    const sign = reviewCandidates[Math.floor(rng() * reviewCandidates.length)]
    if (sign !== undefined) {
      return {
        ...session,
        prompt: { sign, kind: 'review' },
        sinceReview: 0,
      }
    }
  }

  const newCandidates = avoidLast(due, session.lastSign)
  const sign = newCandidates[Math.floor(rng() * newCandidates.length)] ?? due[0]
  if (sign === undefined) return session
  return {
    ...session,
    prompt: { sign, kind: 'new' },
    sinceReview: session.sinceReview + 1,
  }
}

/**
 * Record the terminal outcome of the active prompt (ADR-008: one committed
 * outcome per attempt — the "That's what I did" valve resolves to `correct`
 * upstream). A correct **new** recall counts toward the sign's target; a wrong
 * one simply doesn't (the sign stays due and comes around again). Review
 * outcomes never affect set completion — their bucket effects are applied by
 * the glue layer. Completes the session once every new sign hits the target.
 */
export function recordRecallOutcome(
  session: RecallSession,
  outcome: AttemptOutcome,
): RecallSession {
  if (session.phase !== 'recall' || session.prompt === null) return session

  const { sign, kind } = session.prompt
  const reps =
    kind === 'new' && outcome === 'correct'
      ? { ...session.reps, [sign]: (session.reps[sign] ?? 0) + 1 }
      : session.reps

  const next: RecallSession = {
    ...session,
    reps,
    prompt: null,
    lastSign: sign,
  }
  const allDone = next.newSigns.every((s) => (reps[s] ?? 0) >= next.targetReps)
  return allDone ? { ...next, phase: 'complete' } : next
}
