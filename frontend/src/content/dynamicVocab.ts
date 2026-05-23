/**
 * Dynamic-sign glosses the app **prompts** (see `.claude/docs/recognition.md` §6.1).
 *
 * The model is trained on 24 glosses (the curated 20 + the P2M5b additions
 * `before`/`cold`/`tall`/`walk`, which cleared the ≥ 0.50 per-gloss top-1 gate in
 * 5-fold CV with margin). The original 16 shipped signs are retained; the four
 * curated glosses still held back (too low to ship) are `like`, `bad`, `happy`,
 * `thank you`. Recognition misses are absorbed by the "That's what I did" valve
 * (ADR-007).
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
  // P2M5b additions (WLASL, gate-cleared with margin)
  'before',
  'cold',
  'tall',
  'walk',
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
