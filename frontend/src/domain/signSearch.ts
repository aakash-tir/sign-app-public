import { SHIPPED_GLOSSES } from '../content/dynamicVocab'
import { SIGN_SYNONYMS } from '../content/signSynonyms'

/** Result of looking up a learner's search query against the shipped vocabulary. */
export type SignMatch =
  | { status: 'found'; gloss: string }
  | { status: 'suggestions'; query: string; suggestions: string[] }
  | { status: 'not-found'; query: string }

/** How many "did you mean…" suggestions to surface on a near miss. */
export const MAX_SUGGESTIONS = 3

/** How many as-you-type autocomplete options to show under the search box. */
export const MAX_AUTOCOMPLETE = 8

/**
 * Canonicalize a raw query the same way the ML ingest layer normalizes glosses
 * (`ml/src/sign_ml/ingest.py` `canonical_label`): trim, lowercase, collapse
 * internal whitespace.
 */
export function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Levenshtein edit distance between two strings (pure, two-row DP). Used to rank
 * typo-tolerant search suggestions. (`?? 0` guards index access under
 * `noUncheckedIndexedAccess`; every index here is provably in bounds.)
 */
export function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = new Uint16Array(n + 1)
  let curr = new Uint16Array(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (curr[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      )
    }
    const tmp = prev
    prev = curr
    curr = tmp
  }
  return prev[n] ?? 0
}

// Common English inflection suffixes, longest-first so the greedy strip prefers
// the most specific (e.g. `walking` -> `walk`, not `walkin`). A stem must keep at
// least 3 characters so we don't reduce a query to noise.
const SUFFIXES = ['ing', 'ed', 'es', 's', 'd'] as const

/** Candidate stems of a normalized query (morphological variants → base form). */
function stems(query: string): string[] {
  const out: string[] = []
  for (const suffix of SUFFIXES) {
    if (query.length - suffix.length >= 3 && query.endsWith(suffix)) {
      out.push(query.slice(0, query.length - suffix.length))
    }
  }
  return out
}

/** Resolve a term to a shipped gloss via synonym + membership, or null. */
function resolve(
  term: string,
  glosses: readonly string[],
  synonyms: Record<string, string>,
): string | null {
  const canonical = synonyms[term] ?? term
  return glosses.includes(canonical) ? canonical : null
}

/**
 * Typo- and prefix-tolerant suggestions for a query that didn't match exactly.
 * Considers both shipped glosses and synonym keys (mapped to their canonical
 * gloss), ranks prefix matches ahead of pure edit-distance matches, dedupes by
 * gloss, and returns the closest few. Deterministic (no RNG).
 */
export function fuzzySuggestions(
  normalized: string,
  glosses: readonly string[] = SHIPPED_GLOSSES,
  synonyms: Record<string, string> = SIGN_SYNONYMS,
): string[] {
  const maxDist = normalized.length <= 4 ? 1 : 2

  // term -> canonical shipped gloss (glosses map to themselves; synonym keys map
  // to their target when that target is shipped).
  const terms = new Map<string, string>()
  for (const gloss of glosses) terms.set(gloss, gloss)
  for (const [key, target] of Object.entries(synonyms)) {
    if (!terms.has(key) && glosses.includes(target)) terms.set(key, target)
  }

  const scored: { gloss: string; rank: number }[] = []
  for (const [term, gloss] of terms) {
    const longEnough = term.length >= 3 && normalized.length >= 3
    const isPrefix =
      longEnough && (term.startsWith(normalized) || normalized.startsWith(term))
    const dist = editDistance(normalized, term)
    if (isPrefix || dist <= maxDist) {
      // Prefix hits sort ahead of edit-distance hits; ties broken by gloss name.
      scored.push({ gloss, rank: isPrefix ? Math.min(dist, 1) - 0.5 : dist })
    }
  }
  scored.sort((a, b) => a.rank - b.rank || a.gloss.localeCompare(b.gloss))

  const out: string[] = []
  const seen = new Set<string>()
  for (const { gloss } of scored) {
    if (seen.has(gloss)) continue
    seen.add(gloss)
    out.push(gloss)
    if (out.length >= MAX_SUGGESTIONS) break
  }
  return out
}

/**
 * As-you-type autocomplete: the ranked shipped glosses that match a **partial**
 * query, for the dropdown under the search box (P4M11). Ranking, best first:
 * exact term → prefix → substring → typo-tolerant fuzzy (edit distance, only for
 * queries ≥ 3 chars). Considers both gloss names and synonym keys (mapped to their
 * canonical gloss); a synonym hit is penalized so a gloss's own name wins a tie.
 * Dedupes by gloss and returns the best `limit`. Pure + deterministic; returns
 * `[]` for an empty query. Unlike {@link fuzzySuggestions} (tuned for a full-word
 * near miss after submit) this favors prefixes so short prefixes surface early.
 */
export function autocomplete(
  query: string,
  glosses: readonly string[] = SHIPPED_GLOSSES,
  synonyms: Record<string, string> = SIGN_SYNONYMS,
  limit: number = MAX_AUTOCOMPLETE,
): string[] {
  const normalized = normalizeQuery(query)
  if (normalized === '') return []

  // term -> canonical shipped gloss (glosses map to themselves; synonym keys map
  // to their target when that target is shipped).
  const terms = new Map<string, string>()
  for (const gloss of glosses) terms.set(gloss, gloss)
  for (const [key, target] of Object.entries(synonyms)) {
    if (!terms.has(key) && glosses.includes(target)) terms.set(key, target)
  }

  const maxDist = normalized.length <= 4 ? 1 : 2
  const best = new Map<string, number>() // canonical gloss -> best (lowest) rank
  for (const [term, gloss] of terms) {
    let rank = Infinity
    if (term === normalized) rank = 0
    else if (term.startsWith(normalized)) rank = 1
    else if (term.includes(normalized)) rank = 2
    else if (normalized.length >= 3) {
      const dist = editDistance(normalized, term)
      if (dist <= maxDist) rank = 3 + dist
    }
    if (rank === Infinity) continue
    // A gloss reached via a synonym key loses a tie to its own name.
    if (term !== gloss) rank += 0.5
    const prev = best.get(gloss)
    if (prev === undefined || rank < prev) best.set(gloss, rank)
  }

  return [...best.entries()]
    .sort(
      (a, b) =>
        a[1] - b[1] || a[0].length - b[0].length || a[0].localeCompare(b[0]),
    )
    .slice(0, limit)
    .map(([gloss]) => gloss)
}

/**
 * Look up a typed query against the app's teachable vocabulary (P4M1 + P4M9).
 *
 * Resolution order: (1) exact / synonym / case- + whitespace-insensitive match →
 * `found`; (2) morphological stem (`walking` → `walk`) → `found`; (3) typo- or
 * prefix-tolerant near misses → `suggestions` ("did you mean…"); (4) otherwise
 * `not-found`. Resolves only against the **shipped dynamic signs** (ADR-021);
 * fingerspelling letters are out of scope here (the view offers a spell-it-out
 * fallback on a miss).
 */
export function matchSign(
  query: string,
  glosses: readonly string[] = SHIPPED_GLOSSES,
  synonyms: Record<string, string> = SIGN_SYNONYMS,
): SignMatch {
  const normalized = normalizeQuery(query)
  const trimmed = query.trim()
  if (normalized === '') return { status: 'not-found', query: trimmed }

  // 1. exact or synonym match.
  const direct = resolve(normalized, glosses, synonyms)
  if (direct) return { status: 'found', gloss: direct }

  // 2. morphological stem (e.g. `walking` -> `walk`, `books` -> `book`).
  for (const stem of stems(normalized)) {
    const stemmed = resolve(stem, glosses, synonyms)
    if (stemmed) return { status: 'found', gloss: stemmed }
  }

  // 3. typo / prefix suggestions.
  const suggestions = fuzzySuggestions(normalized, glosses, synonyms)
  if (suggestions.length > 0) {
    return { status: 'suggestions', query: trimmed, suggestions }
  }

  return { status: 'not-found', query: trimmed }
}
