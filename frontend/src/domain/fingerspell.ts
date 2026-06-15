/**
 * Helpers for the search "spell it out" fallback (P4M9). When a searched word
 * isn't one of the shipped dynamic signs, the learner can instead fingerspell it
 * letter-by-letter using the static recognizer — but only if every letter is one
 * the static model actually knows (the ASL alphabet minus the dynamic letters
 * J and Z). Pure + framework-free so it stays unit-testable.
 */

/**
 * The uppercase letter sequence to fingerspell `query`, or `null` if it can't be
 * spelled with the given alphabet. Returns null for non-alphabetic queries
 * (digits, spaces, punctuation) and for words containing a letter outside
 * `alphabet` (e.g. J/Z, which the static model doesn't recognize).
 */
export function fingerspellLetters(
  query: string,
  alphabet: ReadonlySet<string>,
): string[] | null {
  const cleaned = query.trim()
  if (!/^[a-zA-Z]+$/.test(cleaned)) return null
  const letters = [...cleaned.toUpperCase()]
  for (const letter of letters) {
    if (!alphabet.has(letter)) return null
  }
  return letters
}

/** Whether `query` can be fingerspelled with the given alphabet. */
export function canFingerspell(
  query: string,
  alphabet: ReadonlySet<string>,
): boolean {
  return fingerspellLetters(query, alphabet) !== null
}
