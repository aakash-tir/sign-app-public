/**
 * Short multi-sign sequences for the Learn "Sign sentences" drill (ADR-012
 * follow-on, P2M7). This is a **production/sequencing exercise** — "sign these
 * words in order" — not a claim of full ASL grammar. Every sequence uses only
 * shipped dynamic glosses (`dynamicVocab.ts`) so the recognizer can verify each
 * sign, and a learner only sees a sequence once **all** its signs are confident.
 *
 * Kept short (2 signs, within the ADR-009 beginner 2–4 range) and deliberately
 * simple. Owner-reviewed content — adjust freely.
 */
export const SIGN_SENTENCES: readonly (readonly string[])[] = [
  ['want', 'eat'],
  ['want', 'drink'],
  ['help', 'please'],
  ['more', 'please'],
  ['love', 'family'],
  ['learn', 'more'],
  ['yes', 'please'],
  ['eat', 'more'],
]

/** Sequences whose every sign is in the confident set (so they're performable). */
export function signableSentences(
  confident: ReadonlySet<string>,
): readonly string[][] {
  return SIGN_SENTENCES.filter((seq) =>
    seq.every((sign) => confident.has(sign)),
  ).map((seq) => [...seq])
}
