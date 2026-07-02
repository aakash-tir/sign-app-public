import type { SentenceProgress } from '../domain/types'
import type { SignAppDB } from './db'

/**
 * Persistence boundary for sentence completion progress (FR-20, ADR-028).
 * Components never touch IndexedDB directly — they go through this repository.
 * Keys are the sentence's stable id (its joined glosses, `domain/sentences.ts`);
 * a bank edit that changes a sentence's signs simply starts that sentence fresh.
 */
export class SentenceRepo {
  private readonly db: SignAppDB

  constructor(db: SignAppDB) {
    this.db = db
  }

  /** Record one completion (increments the count; upserts on first completion). */
  async recordCompletion(
    sentenceId: string,
    now: number = Date.now(),
  ): Promise<SentenceProgress> {
    const current = await this.db.sentences.get(sentenceId)
    const updated: SentenceProgress = {
      sentenceId,
      timesCompleted: (current?.timesCompleted ?? 0) + 1,
      lastCompletedAt: now,
    }
    await this.db.sentences.put(updated)
    return updated
  }

  async getProgress(sentenceId: string): Promise<SentenceProgress | undefined> {
    return this.db.sentences.get(sentenceId)
  }

  async allProgress(): Promise<SentenceProgress[]> {
    return this.db.sentences.toArray()
  }

  /** Ids of every completed sentence — feeds `pickSentence`'s freshness bias. */
  async completedIds(): Promise<Set<string>> {
    return new Set(await this.db.sentences.toCollection().primaryKeys())
  }
}
