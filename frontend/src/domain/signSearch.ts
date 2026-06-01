import { SHIPPED_GLOSSES } from '../content/dynamicVocab'
import { SIGN_SYNONYMS } from '../content/signSynonyms'

/** Result of looking up a learner's search query against the shipped vocabulary. */
export type SignMatch =
  | { status: 'found'; gloss: string }
  | { status: 'not-found'; query: string }

/**
 * Canonicalize a raw query the same way the ML ingest layer normalizes glosses
 * (`ml/src/sign_ml/ingest.py` `canonical_label`): trim, lowercase, collapse
 * internal whitespace.
 */
export function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Look up a typed query against the app's teachable vocabulary (P4M1).
 *
 * Matching is **case-insensitive, whitespace-tolerant, and synonym-aware** but
 * otherwise exact — `walk` matches, `walking` does not. Resolves only against the
 * **shipped dynamic signs** (ADR-021); fingerspelling letters are out of scope and
 * report not-found.
 */
export function matchSign(
  query: string,
  glosses: readonly string[] = SHIPPED_GLOSSES,
  synonyms: Record<string, string> = SIGN_SYNONYMS,
): SignMatch {
  const normalized = normalizeQuery(query)
  if (normalized === '') return { status: 'not-found', query: query.trim() }
  const canonical = synonyms[normalized] ?? normalized
  if (glosses.includes(canonical)) return { status: 'found', gloss: canonical }
  return { status: 'not-found', query: query.trim() }
}
