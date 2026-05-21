/**
 * Short words for the fingerspelling "sentence" exercise. In the current
 * fingerspelling MVP a "sentence" is a short word spelled letter-by-letter from
 * letters the user is confident with (see ADR-012 note). Real multi-sign
 * sentences arrive with the dynamic recognizer.
 */
export const SHORT_WORDS: readonly string[] = [
  'CAT',
  'DOG',
  'SUN',
  'HAT',
  'CUP',
  'BED',
  'BOX',
  'EGG',
  'FAN',
  'MAP',
  'PEN',
  'RUN',
  'TOP',
  'WIN',
  'YES',
  'BAG',
  'CAR',
  'KEY',
  'MUD',
  'OWL',
]

/** Words whose every letter is in the confident set (so they're performable). */
export function spellableWords(confident: ReadonlySet<string>): string[] {
  return SHORT_WORDS.filter((word) => [...word].every((c) => confident.has(c)))
}
