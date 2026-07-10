import Dexie, { type Table } from 'dexie'
import type {
  CurriculumSetProgress,
  SentenceProgress,
  UserProfile,
  Word,
  WordProgress,
} from '../domain/types'

export interface ProfileRecord extends UserProfile {
  id: string
}

/** Single-row key for the user profile. */
export const PROFILE_ID = 'me'

/**
 * Local-first IndexedDB store (ADR-005). Tables use `declare` (not class fields)
 * so that, with `useDefineForClassFields`, Dexie's runtime table assignment is
 * not clobbered by an `undefined` field initializer.
 */
export class SignAppDB extends Dexie {
  declare words: Table<Word, string>
  declare progress: Table<WordProgress, string>
  declare profile: Table<ProfileRecord, string>
  declare sentences: Table<SentenceProgress, string>
  declare curriculumSets: Table<CurriculumSetProgress, string>

  constructor(name = 'sign-app') {
    super(name)
    this.version(1).stores({
      words: 'id, level',
      progress: 'wordId, bucket',
    })
    this.version(2).stores({
      profile: 'id',
    })
    // Phase 5 (ADR-028): persisted per-sentence completion progress.
    this.version(3).stores({
      sentences: 'sentenceId',
    })
    // Phase 6 (ADR-029): persisted curriculum-set completion — drives the
    // learner route's linear-with-review unlock (Q3).
    this.version(4).stores({
      curriculumSets: 'setId',
    })
  }
}

export const db = new SignAppDB()
