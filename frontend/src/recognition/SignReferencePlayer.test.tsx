import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { SignReferencePlayer } from './SignReferencePlayer'
import { loadSignReference } from './signReferenceData'

const clip = {
  gloss: 'yes',
  frames: [
    { pose: [[0.5, 0.4]], leftHand: null, rightHand: [[0.6, 0.6]] },
    { pose: [[0.5, 0.42]], leftHand: null, rightHand: [[0.61, 0.62]] },
  ],
}

function mockFetch(value: unknown, ok = true) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    json: async () => value,
  } as Response)
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('loadSignReference', () => {
  it('maps raw frames to drawable holistic observations', async () => {
    mockFetch(clip)
    const frames = await loadSignReference('yes')
    expect(frames).toHaveLength(2)
    expect(frames[0]?.pose).toEqual([{ x: 0.5, y: 0.4, z: 0 }])
    expect(frames[0]?.leftHand).toBeNull()
    expect(frames[0]?.rightHand).toEqual([{ x: 0.6, y: 0.6, z: 0 }])
  })

  it('throws when the clip is missing', async () => {
    mockFetch({}, false)
    await expect(loadSignReference('nope')).rejects.toThrow()
  })
})

describe('SignReferencePlayer', () => {
  it('shows the sign caption once the clip loads', async () => {
    mockFetch(clip)
    render(<SignReferencePlayer gloss="yes" />)
    expect(screen.getByTestId('sign-reference')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByText(/how to sign/i)).toBeInTheDocument(),
    )
  })

  it('shows a fallback message when the clip is unavailable', async () => {
    mockFetch({}, false)
    render(<SignReferencePlayer gloss="nope" />)
    await waitFor(() =>
      expect(screen.getByText(/isn.t available/i)).toBeInTheDocument(),
    )
  })
})
