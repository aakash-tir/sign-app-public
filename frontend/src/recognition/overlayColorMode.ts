import { useSyncExternalStore } from 'react'
import { db } from '../data/db'
import { WordBankRepo } from '../data/wordBankRepo'
import type { OverlayColorMode } from '../domain/types'

/**
 * Tiny module-level store for the hand-overlay color mode (FR-14, P2M1).
 *
 * The recognition draw loops read {@link getOverlayColorMode} every frame, so a
 * change takes effect immediately without re-rendering them. The Settings UI uses
 * {@link useOverlayColorMode} to react to changes, and {@link setOverlayColorMode}
 * to change + persist the choice. The value is hydrated once at startup from the
 * persisted profile via {@link loadOverlayColorMode}. Persistence still goes
 * through the repository boundary (never raw IndexedDB).
 */
const defaultRepo = new WordBankRepo(db)

let mode: OverlayColorMode = 'classic'
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

/** Current overlay color mode (read every frame by the draw loops). */
export function getOverlayColorMode(): OverlayColorMode {
  return mode
}

/** Set + persist the overlay color mode and notify subscribers. */
export function setOverlayColorMode(
  next: OverlayColorMode,
  repo: WordBankRepo = defaultRepo,
): void {
  if (next !== mode) {
    mode = next
    emit()
  }
  // Persisting a UI preference is best-effort; never let a storage error surface.
  void repo.setOverlayColorMode(next).catch(() => {})
}

/** Hydrate the in-memory mode from the persisted profile (call once at startup). */
export async function loadOverlayColorMode(
  repo: WordBankRepo = defaultRepo,
): Promise<void> {
  const profile = await repo.getProfile()
  if (profile.overlayColorMode !== mode) {
    mode = profile.overlayColorMode
    emit()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** React hook: current overlay color mode, re-rendering on change. */
export function useOverlayColorMode(): OverlayColorMode {
  return useSyncExternalStore(
    subscribe,
    getOverlayColorMode,
    getOverlayColorMode,
  )
}
