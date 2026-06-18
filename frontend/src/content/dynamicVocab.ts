/**
 * Dynamic-sign glosses the app **prompts** (see `.claude/docs/recognition.md` §6.6).
 *
 * The model is trained on **114 glosses** (vocab50 ∪ a 36-gloss MS-ASL download,
 * minus the 3 P4M17 confusers; 4680 samples) with the P3M3 landmark-space augmentation, a bidirectional
 * GRU + attention pooling (P4M5), and a label-smoothing loss 0.15 (P4M10).
 * Membership here is decided by the **honest signer-disjoint** gate (per-gloss
 * top-1 ≥ 0.50, ADR-019): **103 glosses ship** — the 79 from P4M10 (all kept) plus
 * 24 new download glosses. (P4M17 dropped 3 new glosses — `dance`/`paper`/`slow` —
 * that were confusing the existing `stand`/`school`; removing them as trained classes
 * restores those originals. §6.15.) Recognition misses are absorbed by the "That's
 * what I did" valve (ADR-007).
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
  // P4M10 (label smoothing): a label-smoothing loss (factor 0.15) lifted the honest
  // signer-disjoint CV 0.687 → 0.732. Re-gated at ≥ 0.50: 8 new signs clear it
  // (`hungry` recovers, 0.33 → ≥ 0.50). No sign is demoted (incumbents `need`/`thank
  // you` dip within noise and are retained, per the no-demote-on-noise precedent).
  // recognition.md §6.12.
  'hungry',
  'sleep',
  'mother',
  'before',
  'come',
  'tall',
  'small',
  'white',
  // P4M16 (MS-ASL download → 100+ signs): 36 high-coverage everyday glosses were
  // fetched and trained into a 117-gloss model; the honest signer-disjoint gate
  // (≥ 0.50, label smoothing 0.15) cleared 27 of them. No current sign is demoted
  // (6 dip within noise and are retained). Aggregate over the 117 is 0.696; the
  // original 79 hold at 0.718. recognition.md §6.14.
  'live',
  'shoes',
  'home',
  'apple',
  'sick',
  'spring',
  'fish',
  'yellow',
  'time',
  'orange',
  'sandwich',
  'meet',
  'blue',
  'hurt',
  'brown',
  'wrong',
  'red',
  'sign',
  'grandfather',
  'grandmother',
  'pink',
  'bus',
  'beautiful',
  'purple',
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
