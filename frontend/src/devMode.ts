import { useSyncExternalStore } from 'react'
import { db } from './data/db'
import { WordBankRepo } from './data/wordBankRepo'

/**
 * Tiny module-level store for developer mode (Phase 6 Q2, ADR-029), mirroring
 * `overlayColorMode`. Off by default: the learner app is the app; turning dev
 * mode on (Settings) reveals the developer surfaces (Practice / Learn / Signs /
 * Camera) in the nav. Hydrated once at startup from the persisted profile;
 * persistence goes through the repository boundary.
 */
const defaultRepo = new WordBankRepo(db)

let devMode = false
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function getDevMode(): boolean {
  return devMode
}

/** Set + persist dev mode and notify subscribers. */
export function setDevMode(
  next: boolean,
  repo: WordBankRepo = defaultRepo,
): void {
  if (next !== devMode) {
    devMode = next
    emit()
  }
  // Persisting a UI preference is best-effort; never let a storage error surface.
  void repo.setDevMode(next).catch(() => {})
}

/** Hydrate the in-memory flag from the persisted profile (call once at startup). */
export async function loadDevMode(
  repo: WordBankRepo = defaultRepo,
): Promise<void> {
  const profile = await repo.getProfile()
  if (profile.devMode !== devMode) {
    devMode = profile.devMode
    emit()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** React hook: current dev-mode flag, re-rendering on change. */
export function useDevMode(): boolean {
  return useSyncExternalStore(subscribe, getDevMode, getDevMode)
}
