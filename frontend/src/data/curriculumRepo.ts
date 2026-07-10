import type { CurriculumSetProgress } from '../domain/types'
import type { SignAppDB } from './db'

/**
 * Persistence boundary for learner-route progress (Phase 6, ADR-029).
 * Components never touch IndexedDB directly — they go through this repository.
 * Keys are the curriculum set's stable id (its joined signs,
 * `domain/curriculum.ts`); a curriculum edit that changes a set's signs simply
 * starts that set fresh — same convention as the sentence bank.
 */
export class CurriculumRepo {
  private readonly db: SignAppDB

  constructor(db: SignAppDB) {
    this.db = db
  }

  /** Mark a set completed (idempotent — the first completion's time wins). */
  async markCompleted(
    setId: string,
    now: number = Date.now(),
  ): Promise<CurriculumSetProgress> {
    const existing = await this.db.curriculumSets.get(setId)
    if (existing) return existing
    const record: CurriculumSetProgress = { setId, completedAt: now }
    await this.db.curriculumSets.put(record)
    return record
  }

  /** Ids of every completed set — feeds `routeAccess` (Q3). */
  async completedIds(): Promise<Set<string>> {
    return new Set(await this.db.curriculumSets.toCollection().primaryKeys())
  }
}
