import {
  curriculumSetOf,
  priorityWords,
  type CurriculumSet,
  type CurriculumUnit,
} from '../domain/curriculum'
import { SHIPPED_GLOSSES } from './dynamicVocab'

/**
 * The learner-app syllabus (Phase 6 / P6M1, ADR-029) — **owner-reviewable
 * content**, like the sentence bank. Designed **ideal-first** (plan.md §2.1):
 * the route is what a good beginner course should teach, in order, regardless
 * of today's recognizer vocabulary. Words the recognizer can't verify yet are
 * marked `(placeholder)` below; they render as "coming soon" slots (Q6), are
 * excluded from teaching/recall, and form `PRIORITY_WORDS` — the queue for the
 * next model-vocabulary expansion.
 *
 * Ordering rule (test-enforced): after every set, the recognized words learned
 * so far can build at least one sentence from the Phase-5 bank — sentences
 * arrive from the very first set.
 */
const unit = (
  id: string,
  title: string,
  sets: readonly (readonly string[])[],
): CurriculumUnit => ({ id, title, sets: sets.map(curriculumSetOf) })

export const WORD_UNITS: readonly CurriculumUnit[] = [
  unit('first-needs', 'First needs', [
    ['want', 'eat'], // completes "want eat" immediately
    ['drink', 'water'],
    ['more', 'please'],
    ['help', 'milk'],
    ['yes', 'no'],
  ]),
  unit('saying-hello', 'Saying hello', [
    ['hello', 'friend'],
    ['goodbye', 'you'], // (placeholder, placeholder)
    ['what', 'name'],
    ['me', 'my'], // (placeholder, placeholder)
    ['your'], // (placeholder)
    ['thank you', 'sorry'],
    ['nice', 'meet'],
    ['now', 'come'],
  ]),
  unit('feelings', 'Feelings', [
    ['like', 'happy'],
    ['hungry', 'tired'],
    ['sleep', 'sick'],
    ['need', 'doctor'],
    ['sad', 'hurt'],
    ['feel'], // (placeholder)
    ['fine', 'good'],
    ['bad', 'beautiful'],
  ]),
  unit('family', 'Family', [
    ['mother', 'father'],
    ['love', 'family'],
    ['baby', 'sister'],
    ['brother', 'boy'],
    ['girl', 'woman'],
    ['man', 'grandmother'],
    ['grandfather'],
  ]),
  unit('school-and-signing', 'School & signing', [
    ['go', 'school'],
    ['read', 'book'],
    ['teacher', 'student'],
    ['learn', 'sign'],
    ['deaf'], // (placeholder)
    ['write'],
    ['know', 'understand'],
    ['think', 'forget'],
    ['again', 'wrong'],
  ]),
  unit('around-town', 'Around town', [
    ['home', 'house'],
    ['where', 'bathroom'],
    ['bus', 'car'],
    ['work', 'day'],
    ['time', 'before'],
    ['money', 'shoes'],
    ['computer'],
  ]),
  unit('asking-questions', 'Asking questions', [
    ['who', 'how'],
    ['when', 'why'], // (placeholder, placeholder)
  ]),
  unit('everyday-actions', 'Everyday actions', [
    ['see', 'play'],
    ['sit', 'stand'],
    ['walk', 'run'],
    ['live', 'finish'],
  ]),
  unit('food', 'Food', [['apple', 'sandwich'], ['fish', 'hot'], ['cold']]),
  unit('colors-and-describing', 'Colors & describing', [
    ['black', 'white'],
    ['red', 'blue'],
    ['yellow', 'orange'],
    ['pink', 'purple'],
    ['brown', 'big'],
    ['small', 'tall'],
  ]),
  unit('times-of-day', 'Times of day', [
    ['today', 'tomorrow'], // (placeholder, placeholder)
    ['morning', 'night'], // (placeholder, placeholder)
    ['spring'],
  ]),
]

/**
 * The alphabet route (Q5): the 24 statically verifiable letters in
 * alphabetical batches of 3. J and Z are motion letters the static recognizer
 * can't check — they are left out entirely (not placeholders) and join once
 * the recognizer can verify them.
 */
export const LETTER_BATCHES: readonly CurriculumSet[] = [
  ['A', 'B', 'C'],
  ['D', 'E', 'F'],
  ['G', 'H', 'I'],
  ['K', 'L', 'M'],
  ['N', 'O', 'P'],
  ['Q', 'R', 'S'],
  ['T', 'U', 'V'],
  ['W', 'X', 'Y'],
].map(curriculumSetOf)

/**
 * The not-yet-recognized route words, in teaching order — the priority queue
 * for the next model-vocabulary expansion (plan.md §2.1). Derived, so it can
 * never drift from `SHIPPED_GLOSSES`.
 */
export const PRIORITY_WORDS: readonly string[] = priorityWords(
  WORD_UNITS,
  new Set(SHIPPED_GLOSSES),
)
