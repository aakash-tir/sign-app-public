/**
 * Dynamic-sign glosses the app **prompts** (see `.claude/docs/recognition.md` §6.1).
 *
 * The model is trained on 24 glosses (MS-ASL ∪ WLASL, P3M2). Membership here is
 * decided by the **honest signer-disjoint** gate (per-gloss top-1 ≥ 0.50, ADR-019)
 * on the combined data: 20 glosses clear it. P3M2 promoted `like`/`bad`/`happy`
 * (now ≥ 0.50 with the larger, more signer-diverse data) and demoted
 * `good`/`before`/`tall` (below 0.50 under the honest gate); `thank you` (0.44)
 * stays held back. Recognition misses are absorbed by the "That's what I did" valve
 * (ADR-007).
 */
export const SHIPPED_GLOSSES: readonly string[] = [
  'drink',
  'go',
  'help',
  'yes',
  'no',
  'want',
  'finish',
  'family',
  'more',
  'learn',
  'eat',
  'sad',
  'please',
  'sorry',
  'love',
  'cold',
  'walk',
  // P3M2: promoted under the honest signer-disjoint gate on MS-ASL u WLASL data
  'like',
  'bad',
  'happy',
]

/** Filter a model's labels to the shipped set, preserving the model's order. */
export function shippedLabels(modelLabels: readonly string[]): string[] {
  const shipped = new Set(SHIPPED_GLOSSES)
  return modelLabels.filter((label) => shipped.has(label))
}

/** True for a dynamic (word-level) sign id; false for a fingerspelling letter. */
export function isDynamicGloss(id: string): boolean {
  return SHIPPED_GLOSSES.includes(id)
}
