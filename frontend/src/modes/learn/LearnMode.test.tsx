import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  recognized: null as { label: string; confidence: number } | null,
  reset: vi.fn(),
  setMode: vi.fn(),
}))

vi.mock('../../recognition/useUnifiedSignRecognition', () => ({
  useUnifiedSignRecognition: () => ({
    videoRef: { current: null },
    canvasRef: { current: null },
    status: 'on',
    error: null,
    trackerError: null,
    ready: true,
    recognized: mocks.recognized,
    start: vi.fn(),
    stop: vi.fn(),
    setMode: mocks.setMode,
    reset: mocks.reset,
  }),
}))

import { LearnMode } from './LearnMode'
import { SignAppDB } from '../../data/db'
import { WordBankRepo } from '../../data/wordBankRepo'

let counter = 0
let database: SignAppDB
let repo: WordBankRepo

beforeEach(async () => {
  mocks.recognized = null
  mocks.setMode.mockClear()
  database = new SignAppDB(`test-learn-${++counter}`)
  await database.open()
  repo = new WordBankRepo(database)
})

afterEach(async () => {
  cleanup()
  await database.delete()
})

describe('LearnMode teaching letters', () => {
  it('shows the first un-learned letter with a hint', async () => {
    render(<LearnMode repo={repo} />)
    expect((await screen.findByTestId('learn-target')).textContent).toBe('A')
  })

  it('"That\'s what I did" records a correct answer', async () => {
    render(<LearnMode repo={repo} />)
    await screen.findByTestId('learn-target')
    fireEvent.click(screen.getByTestId('learn-got-it'))
    expect(await screen.findByTestId('learn-good')).toBeInTheDocument()
    expect((await repo.getProgress('A'))?.needPracticeStreak).toBe(1)
  })

  it('a camera-recognized letter records correct', async () => {
    const view = render(<LearnMode repo={repo} />)
    await screen.findByTestId('learn-target')
    mocks.recognized = { label: 'A', confidence: 0.99 }
    view.rerender(<LearnMode repo={repo} />)
    expect(await screen.findByTestId('learn-good')).toBeInTheDocument()
    expect((await repo.getProgress('A'))?.timesSeen).toBe(1)
  })

  it('"Skip" advances without recording anything', async () => {
    render(<LearnMode repo={repo} />)
    await screen.findByTestId('learn-target')
    fireEvent.click(screen.getByTestId('learn-skip'))
    expect((await screen.findByTestId('learn-target')).textContent).not.toBe(
      'A',
    )
    expect((await repo.getProgress('A'))?.timesSeen).toBe(0)
  })
})

describe('LearnMode teaching dynamic signs', () => {
  it('teaches a sign with a reference link and records correct', async () => {
    render(<LearnMode repo={repo} />)
    fireEvent.click(await screen.findByTestId('signs-tab'))
    expect((await screen.findByTestId('sign-target')).textContent).toBe('drink')
    // In-app landmark reference (P2M4) replaces the old external link.
    expect(screen.getByTestId('sign-reference')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('sign-got-it'))
    expect(await screen.findByTestId('sign-good')).toBeInTheDocument()
    expect((await repo.getProgress('drink'))?.needPracticeStreak).toBe(1)
  })

  it('a camera-recognized sign records correct', async () => {
    const view = render(<LearnMode repo={repo} />)
    fireEvent.click(await screen.findByTestId('signs-tab'))
    await screen.findByTestId('sign-target')
    mocks.recognized = { label: 'drink', confidence: 0.99 }
    view.rerender(<LearnMode repo={repo} />)
    expect(await screen.findByTestId('sign-good')).toBeInTheDocument()
    expect((await repo.getProgress('drink'))?.timesSeen).toBe(1)
  })
})

describe('LearnMode spelling (gated)', () => {
  it('spells a word from confident letters via the camera', async () => {
    for (const letter of ['C', 'A', 'T']) await repo.markKnown(letter)
    await repo.setLevel('intermediate')

    const view = render(<LearnMode repo={repo} />)
    fireEvent.click(await screen.findByTestId('spell-tab'))
    expect(await screen.findByTestId('spell-word')).toHaveTextContent('CAT')

    for (const letter of ['C', 'A', 'T']) {
      mocks.recognized = { label: letter, confidence: 0.99 }
      view.rerender(<LearnMode repo={repo} />)
    }
    expect(await screen.findByTestId('spell-done')).toBeInTheDocument()
  })
})
