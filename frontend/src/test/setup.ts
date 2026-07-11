import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'

// Under full-parallel runs (39 suites) a view's initial IndexedDB load can
// take just over testing-library's 1 s default `findBy` timeout, flaking
// whichever DB-backed suite drew the slow worker. 5 s absorbs the contention
// without slowing passing tests (findBy returns as soon as the element lands).
configure({ asyncUtilTimeout: 5000 })

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
