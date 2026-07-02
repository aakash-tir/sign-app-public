import { sentenceOf, type SignSentence } from '../domain/sentences'

/**
 * The sentence bank for the Sentences section (Phase 5, ADR-028; grew out of
 * the P2M7 Learn drill, ADR-012). Short, conservative gloss-order sequences —
 * a **production/sequencing exercise** ("sign these words in order"), not a
 * claim of full ASL grammar. Every sequence uses only shipped dynamic glosses
 * (`dynamicVocab.ts`, enforced by test) so the recognizer can verify each sign;
 * eligibility additionally requires every sign to be `confident` (ADR-009).
 *
 * Lengths 2–4 signs; per-level bands are in `domain/sentences.ts`. Owner-reviewed
 * content — adjust freely (ids are the joined glosses, so editing a sentence's
 * signs resets its saved progress; that's fine).
 */
export const SIGN_SENTENCES: readonly SignSentence[] = [
  // --- 2 signs: first wins (needs, courtesy, orientation) ---
  sentenceOf(['want', 'eat']),
  sentenceOf(['want', 'drink']),
  sentenceOf(['want', 'water']),
  sentenceOf(['help', 'please']),
  sentenceOf(['more', 'please']),
  sentenceOf(['yes', 'please']),
  sentenceOf(['eat', 'more']),
  sentenceOf(['learn', 'more']),
  sentenceOf(['love', 'family']),
  sentenceOf(['drink', 'milk']),
  sentenceOf(['read', 'book']),
  sentenceOf(['go', 'school']),
  sentenceOf(['where', 'bathroom']),
  sentenceOf(['where', 'bus']),
  sentenceOf(['what', 'name']),
  sentenceOf(['hello', 'friend']),
  sentenceOf(['sorry', 'forget']),

  // --- 3 signs: everyday statements ---
  sentenceOf(['hungry', 'want', 'eat']),
  sentenceOf(['tired', 'want', 'sleep']),
  sentenceOf(['sick', 'need', 'doctor']),
  sentenceOf(['doctor', 'help', 'please']),
  sentenceOf(['mother', 'love', 'baby']),
  sentenceOf(['father', 'work', 'now']),
  sentenceOf(['sister', 'read', 'book']),
  sentenceOf(['brother', 'like', 'run']),
  sentenceOf(['grandmother', 'love', 'family']),
  sentenceOf(['grandfather', 'tired', 'now']),
  sentenceOf(['teacher', 'help', 'student']),
  sentenceOf(['baby', 'sleep', 'now']),
  sentenceOf(['friend', 'come', 'now']),
  sentenceOf(['family', 'eat', 'now']),
  sentenceOf(['woman', 'drink', 'water']),
  sentenceOf(['man', 'want', 'car']),
  sentenceOf(['girl', 'like', 'blue']),
  sentenceOf(['boy', 'play', 'now']),
  sentenceOf(['want', 'eat', 'apple']),
  sentenceOf(['want', 'eat', 'sandwich']),
  sentenceOf(['drink', 'water', 'please']),
  sentenceOf(['write', 'name', 'please']),
  sentenceOf(['go', 'home', 'now']),
  sentenceOf(['need', 'more', 'money']),
  sentenceOf(['what', 'time', 'now']),
  sentenceOf(['nice', 'meet', 'friend']),
  sentenceOf(['see', 'big', 'house']),
  sentenceOf(['see', 'small', 'fish']),
  sentenceOf(['see', 'black', 'car']),

  // --- 4 signs: longer sequences (intermediate/expert) ---
  sentenceOf(['want', 'eat', 'more', 'please']),
  sentenceOf(['want', 'go', 'school', 'now']),
  sentenceOf(['want', 'learn', 'more', 'sign']),
  sentenceOf(['baby', 'want', 'drink', 'milk']),
  sentenceOf(['friend', 'want', 'play', 'now']),
  sentenceOf(['student', 'read', 'book', 'now']),
  sentenceOf(['sister', 'like', 'pink', 'shoes']),
  sentenceOf(['brother', 'like', 'blue', 'car']),
  sentenceOf(['tired', 'go', 'sleep', 'now']),
  sentenceOf(['hungry', 'want', 'eat', 'sandwich']),
  sentenceOf(['teacher', 'write', 'name', 'please']),
  sentenceOf(['mother', 'father', 'love', 'family']),
  sentenceOf(['go', 'home', 'sleep', 'now']),
]
