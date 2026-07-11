import { applyOutcome, newWordProgress } from '../domain/buckets'
import { nextSentencesUnlocked } from '../domain/levels'
import {
  defaultProfile,
  type AttemptOutcome,
  type Level,
  type OverlayColorMode,
  type UserProfile,
  type Word,
  type WordProgress,
} from '../domain/types'
import { PROFILE_ID, type SignAppDB } from './db'

/**
 * Persistence boundary for the word bank and user profile. Components never
 * touch IndexedDB directly — they go through this repository.
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

  /** Seed the bank with the given ids (as need-practice) if it is empty. */
  async ensureSeeded(ids: string[]): Promise<void> {
    if ((await this.db.progress.count()) > 0) return
    // Batched: two bulk writes instead of a round-trip per id (mount-path perf).
    await this.db.words.bulkPut(ids.map((id) => ({ id, gloss: id })))
    await this.db.progress.bulkPut(ids.map((id) => newWordProgress(id)))
  }

  /**
   * Ensure each id exists in the bank (adding any missing as need-practice),
   * without the empty-bank guard — used to add the dynamic-sign vocabulary to
   * banks that were already seeded with letters. Batched (one bulk read + one
   * bulk write of only the missing ids) so a large vocabulary doesn't stall the
   * Learn/Practice mount with a round-trip per id.
   */
  async ensurePresent(ids: string[]): Promise<void> {
    const existing = await this.db.progress.bulkGet(ids)
    const missing = ids.filter((_, i) => existing[i] === undefined)
    if (missing.length === 0) return
    await this.db.words.bulkPut(missing.map((id) => ({ id, gloss: id })))
    await this.db.progress.bulkPut(missing.map((id) => newWordProgress(id)))
  }

  async getProgress(wordId: string): Promise<WordProgress | undefined> {
    return this.db.progress.get(wordId)
  }

  async allProgress(): Promise<WordProgress[]> {
    return this.db.progress.toArray()
  }

  async confidentCount(): Promise<number> {
    return this.db.progress.where('bucket').equals('confident').count()
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

  /** Mark a word as already known (placement): straight to confident. */
  async markKnown(wordId: string): Promise<void> {
    const current =
      (await this.db.progress.get(wordId)) ?? newWordProgress(wordId)
    await this.db.progress.put({
      ...current,
      bucket: 'confident',
      needPracticeStreak: 0,
    })
  }

  async getProfile(): Promise<UserProfile> {
    const record = await this.db.profile.get(PROFILE_ID)
    return record
      ? {
          level: record.level,
          sentencesUnlocked: record.sentencesUnlocked,
          // Legacy profiles predate these fields — fall back to safe defaults.
          overlayColorMode: record.overlayColorMode ?? 'classic',
          cameraExplainerSeen: record.cameraExplainerSeen ?? false,
          devMode: record.devMode ?? false,
        }
      : defaultProfile()
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    await this.db.profile.put({ id: PROFILE_ID, ...profile })
  }

  /** Reassign the level (non-destructive — word progress is untouched). */
  async setLevel(level: Level): Promise<UserProfile> {
    const updated = { ...(await this.getProfile()), level }
    await this.saveProfile(updated)
    return updated
  }

  /** Persist the hand-overlay color mode (FR-14). */
  async setOverlayColorMode(mode: OverlayColorMode): Promise<UserProfile> {
    const updated = { ...(await this.getProfile()), overlayColorMode: mode }
    await this.saveProfile(updated)
    return updated
  }

  /** Toggle developer mode (Phase 6 Q2: dev surfaces alongside the learner app). */
  async setDevMode(devMode: boolean): Promise<UserProfile> {
    const updated = { ...(await this.getProfile()), devMode }
    await this.saveProfile(updated)
    return updated
  }

  /** Remember that the one-time camera privacy explainer was acknowledged (FR-15). */
  async setCameraExplainerSeen(seen: boolean): Promise<UserProfile> {
    const updated = { ...(await this.getProfile()), cameraExplainerSeen: seen }
    await this.saveProfile(updated)
    return updated
  }

  /** Recompute + persist the beginner sentence-unlock latch (ADR-009/010). */
  async refreshSentenceUnlock(): Promise<UserProfile> {
    const profile = await this.getProfile()
    if (profile.sentencesUnlocked) return profile
    if (!nextSentencesUnlocked(false, await this.confidentCount()))
      return profile
    const updated = { ...profile, sentencesUnlocked: true }
    await this.saveProfile(updated)
    return updated
  }
}
