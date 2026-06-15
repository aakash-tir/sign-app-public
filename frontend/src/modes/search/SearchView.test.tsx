import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { UseDynamicSignRecognition } from '../../recognition/useDynamicSignRecognition'
import type { UseUnifiedSignRecognition } from '../../recognition/useUnifiedSignRecognition'

// Controllable stub for the dynamic recognition hook (camera/model not exercised).
const mocks = vi.hoisted(() => {
  const state: UseDynamicSignRecognition = {
    videoRef: () => {},
    canvasRef: { current: null },
    status: 'idle',
    error: null,
    trackerError: null,
    ready: true,
    labels: [],
    prediction: null,
    target: null,
    setTarget: vi.fn(),
    accepted: false,
    start: vi.fn(),
    stop: vi.fn(),
  }
  // Stub for the unified hook used by the fingerspell fallback.
  const unified: UseUnifiedSignRecognition = {
    videoRef: () => {},
    canvasRef: { current: null },
    status: 'idle',
    error: null,
    trackerError: null,
    ready: true,
    recognized: null,
    start: vi.fn(),
    stop: vi.fn(),
    setMode: vi.fn(),
    reset: vi.fn(),
  }
  return { state, unified }
})

vi.mock('../../recognition/useDynamicSignRecognition', () => ({
  useDynamicSignRecognition: () => mocks.state,
}))

vi.mock('../../recognition/useUnifiedSignRecognition', () => ({
  useUnifiedSignRecognition: () => mocks.unified,
}))

import { SearchView } from './SearchView'

function search(term: string) {
  fireEvent.change(screen.getByTestId('sign-search-input'), {
    target: { value: term },
  })
  fireEvent.click(screen.getByRole('button', { name: /^search$/i }))
}

beforeEach(() => {
  Object.assign(mocks.state, { status: 'idle', target: null })
  mocks.state.setTarget = vi.fn()
})

describe('SearchView', () => {
  it('shows the reference and locks the target for a shipped sign', () => {
    render(<SearchView />)
    search('father')
    expect(screen.getByTestId('sign-search-found')).toHaveTextContent(/father/i)
    expect(screen.getByTestId('sign-reference')).toBeInTheDocument()
    expect(mocks.state.setTarget).toHaveBeenLastCalledWith('father')
  })

  it('resolves a synonym onto the canonical gloss', () => {
    render(<SearchView />)
    search('thanks')
    expect(screen.getByTestId('sign-search-found')).toHaveTextContent(
      /thank you/i,
    )
    expect(mocks.state.setTarget).toHaveBeenLastCalledWith('thank you')
  })

  it('offers "did you mean" suggestions on a near miss and resolves on click', () => {
    render(<SearchView />)
    search('fathr')
    const chips = screen.getAllByTestId('suggestion-chip')
    expect(chips.length).toBeGreaterThan(0)
    expect(chips.map((c) => c.textContent)).toContain('father')
    fireEvent.click(screen.getByRole('button', { name: 'father' }))
    expect(screen.getByTestId('sign-search-found')).toHaveTextContent(/father/i)
    expect(mocks.state.setTarget).toHaveBeenLastCalledWith('father')
  })

  it('reports an unknown term as not in the system and sets no target', () => {
    render(<SearchView />)
    search('xyzzy')
    expect(screen.getByTestId('sign-search-missing')).toHaveTextContent(
      /isn.t in the system yet/i,
    )
    expect(screen.queryByTestId('sign-reference')).not.toBeInTheDocument()
    expect(mocks.state.setTarget).not.toHaveBeenCalledWith('xyzzy')
  })

  it('offers a fingerspelling fallback for a spellable miss', () => {
    render(<SearchView />)
    search('frog') // not a sign, no near match, but all letters are static
    expect(screen.getByTestId('sign-search-missing')).toBeInTheDocument()
    const offer = screen.getByTestId('fingerspell-offer')
    expect(offer).toHaveTextContent(/fingerspell/i)
    fireEvent.click(offer)
    expect(screen.getByTestId('fingerspell-stage')).toBeInTheDocument()
    expect(screen.getByTestId('fingerspell-word')).toHaveTextContent('FROG')
  })
})
