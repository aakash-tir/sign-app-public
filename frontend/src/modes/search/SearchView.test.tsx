import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { UseDynamicSignRecognition } from '../../recognition/useDynamicSignRecognition'

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
  return { state }
})

vi.mock('../../recognition/useDynamicSignRecognition', () => ({
  useDynamicSignRecognition: () => mocks.state,
}))

import { SearchView } from './SearchView'

function search(term: string) {
  fireEvent.change(screen.getByTestId('sign-search-input'), {
    target: { value: term },
  })
  fireEvent.click(screen.getByRole('button', { name: /search/i }))
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

  it('reports an unknown term as not in the system and sets no target', () => {
    render(<SearchView />)
    search('xyzzy')
    expect(screen.getByTestId('sign-search-missing')).toHaveTextContent(
      /isn.t in the system yet/i,
    )
    expect(screen.queryByTestId('sign-reference')).not.toBeInTheDocument()
    expect(mocks.state.setTarget).not.toHaveBeenCalledWith('xyzzy')
  })
})
