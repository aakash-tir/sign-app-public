import Dexie, { type Table } from 'dexie'
import type { Word, WordProgress } from '../domain/types'

/**
 * Local-first IndexedDB store (ADR-005). Tables use `declare` (not class fields)
 * so that, with `useDefineForClassFields`, Dexie's runtime table assignment is
 * not clobbered by an `undefined` field initializer.
 */
export class SignAppDB extends Dexie {
  declare words: Table<Word, string>
  declare progress: Table<WordProgress, string>

  constructor(name = 'sign-app') {
    super(name)
    this.version(1).stores({
      words: 'id, level',
      progress: 'wordId, bucket',
    })
  }
}

export const db = new SignAppDB()
