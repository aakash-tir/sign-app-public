/**
 * Dynamic-sign glosses the app **prompts** (see `.claude/docs/recognition.md` §6.6).
 *
 * The model is trained on **81 glosses** (MS-ASL ∪ WLASL, P3M2c vocab50 push:
 * 3583 samples / 163 signers) with the P3M3 landmark-space augmentation.
 * Membership here is decided by the **honest signer-disjoint** gate (per-gloss
 * top-1 ≥ 0.50, ADR-019) on that combined data: **63 glosses clear it**. All 20
 * from P3M2 still pass (no demotions); `thank you` (0.63) finally clears after
 * being held back since M6; 18 hard/confusable glosses stay known-but-unshipped
 * and serve as negatives. Recognition misses are absorbed by the "That's what I
 * did" valve (ADR-007).
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
  // P3M2c (vocab50 push): 43 new signs cleared the honest >=0.50 gate on the
  // 81-gloss model trained with P3M3 augmentation (CV top-1 0.615). All 20 above
  // still pass; `thank you` finally clears (held back since M6). recognition.md §6.6.
  'thank you',
  'hello',
  'name',
  'fine',
  'friend',
  'father',
  'sister',
  'brother',
  'boy',
  'baby',
  'teacher',
  'student',
  'doctor',
  'sit',
  'stand',
  'see',
  'know',
  'think',
  'understand',
  'need',
  'write',
  'read',
  'play',
  'work',
  'forget',
  'water',
  'milk',
  'book',
  'school',
  'house',
  'computer',
  'bathroom',
  'what',
  'where',
  'how',
  'again',
  'now',
  'day',
  'big',
  'hot',
  'tired',
  'black',
  // P4M5 (temporal model): a bidirectional GRU + attention pooling lifted the honest
  // signer-disjoint CV 0.615 → 0.687. Re-gated at ≥ 0.50: 9 new signs clear it; `hungry`
  // is demoted (0.33 on the stronger model). recognition.md §6.9.
  'money',
  'woman',
  'girl',
  'man',
  'car',
  'good',
  'run',
  'nice',
  'who',
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
