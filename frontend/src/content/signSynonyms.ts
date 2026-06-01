/**
 * Everyday synonyms mapping a learner's typed term onto a **shipped** dynamic gloss
 * (see `dynamicVocab.ts`). Mirrors the ML ingest layer's `canonical_label` synonym
 * idea (`ml/src/sign_ml/ingest.py`) so the frontend search speaks the same
 * vocabulary as training.
 *
 * **Invariant:** every value here must be a member of `SHIPPED_GLOSSES`. The
 * `signSearch` test enforces this — if a target is ever un-shipped, drop its
 * synonyms rather than point at a sign the app can't teach.
 *
 * Keys are already normalized (lowercase, single-spaced) to match
 * `normalizeQuery`.
 */
export const SIGN_SYNONYMS: Record<string, string> = {
  // greetings & politeness
  hi: 'hello',
  hey: 'hello',
  thanks: 'thank you',
  thank: 'thank you',
  ok: 'fine',
  okay: 'fine',
  // affirm / negate
  yeah: 'yes',
  yep: 'yes',
  yup: 'yes',
  nope: 'no',
  nah: 'no',
  // family & people
  dad: 'father',
  daddy: 'father',
  papa: 'father',
  bro: 'brother',
  sis: 'sister',
  pal: 'friend',
  buddy: 'friend',
  infant: 'baby',
  physician: 'doctor',
  educator: 'teacher',
  pupil: 'student',
  // verbs & states
  assist: 'help',
  comprehend: 'understand',
  beverage: 'drink',
  glad: 'happy',
  joyful: 'happy',
  upset: 'sad',
  repeat: 'again',
  // places & things
  home: 'house',
  pc: 'computer',
  restroom: 'bathroom',
  washroom: 'bathroom',
  toilet: 'bathroom',
  // descriptors
  huge: 'big',
  large: 'big',
}
