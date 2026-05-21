// Reference media for dynamic signs links out to an external ASL dictionary
// rather than hosting clips (owner decision; avoids media licensing/hosting).
// Recognition stays fully on-device — only the "how do I sign this?" reference
// needs the network.
const DICTIONARY_BASE = 'https://www.signasl.org/sign/'

/**
 * External ASL-dictionary URL showing how to perform a gloss. Glosses are
 * lowercased and spaces become hyphens (e.g. "thank you" → ".../thank-you").
 */
export function signDictionaryUrl(gloss: string): string {
  const slug = gloss.trim().toLowerCase().replace(/\s+/g, '-')
  return DICTIONARY_BASE + encodeURIComponent(slug)
}
