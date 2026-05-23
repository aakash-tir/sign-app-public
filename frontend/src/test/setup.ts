import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Reference clips (/reference/*.json) aren't served in unit tests. Default fetch
// to "not found" so SignReferencePlayer renders its graceful fallback instead of
// hitting the network; its own test overrides fetch per-case.
globalThis.fetch = (async () => ({
  ok: false,
  json: async () => ({}),
})) as unknown as typeof fetch

// Unmount React trees between tests so their effects (camera, db) tear down.
afterEach(() => {
  cleanup()
})
