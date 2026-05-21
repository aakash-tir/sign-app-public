import { applyOutcome, newWordProgress } from '../domain/buckets'
import type { AttemptOutcome, Word, WordProgress } from '../domain/types'
import type { SignAppDB } from './db'

/**
 * Persistence boundary for the word bank. Components never touch IndexedDB
 * directly — they go through this repository (see rules/frontend/react.md).
 */
export class WordBankRepo {
  private readonly db: SignAppDB

  constructor(db: SignAppDB) {
    this.db = db
  }

  /** Add/update a word; create default (need-practice) progress if it's new. */
  async putWord(word: Word): Promise<void> {
    await this.db.words.put(word)
    const existing = await this.db.progress.get(word.id)
    if (!existing) {
      await this.db.progress.put(newWordProgress(word.id))
    }
  }

  async getProgress(wordId: string): Promise<WordProgress | undefined> {
    return this.db.progress.get(wordId)
  }

  async allProgress(): Promise<WordProgress[]> {
    return this.db.progress.toArray()
  }

  /**
   * Commit one attempt outcome: load progress (creating a default if unseen),
   * apply the bucket transition, persist, and return the new progress.
   */
  async recordAttempt(
    wordId: string,
    outcome: AttemptOutcome,
    now: number = Date.now(),
  ): Promise<WordProgress> {
    const current =
      (await this.db.progress.get(wordId)) ?? newWordProgress(wordId)
    const updated = applyOutcome(current, outcome, now)
    await this.db.progress.put(updated)
    return updated
  }
}
