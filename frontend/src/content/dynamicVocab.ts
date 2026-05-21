/**
 * Dynamic-sign glosses that passed the M6.4 accuracy gate (≥ 0.50 per-gloss top-1
 * in 5-fold cross-validation — see `.claude/docs/recognition.md` §6.1).
 *
 * The model is trained on all 20 curated glosses, but the app only **prompts**
 * these shipped ones. Held back (too low to ship): `like`, `bad`, `happy`,
 * `thank you` — revisit with more clips/augmentation.
 */
export const SHIPPED_GLOSSES: readonly string[] = [
  'drink',
  'go',
  'help',
  'yes',
  'no',
  'good',
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
