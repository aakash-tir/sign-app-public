import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  prediction: null as { label: string; confidence: number } | null,
  resetPrediction: vi.fn(),
}))

vi.mock('../../recognition/useSignRecognition', () => ({
  useSignRecognition: () => ({
    videoRef: { current: null },
    canvasRef: { current: null },
    status: 'on',
    error: null,
    trackerError: null,
    handCount: 0,
    prediction: mocks.prediction,
    start: vi.fn(),
    stop: vi.fn(),
    resetPrediction: mocks.resetPrediction,
  }),
}))

import { LearnMode } from './LearnMode'
import { SignAppDB } from '../../data/db'
import { WordBankRepo } from '../../data/wordBankRepo'

let counter = 0
let database: SignAppDB
let repo: WordBankRepo

beforeEach(async () => {
  mocks.prediction = null
  database = new SignAppDB(`test-learn-${++counter}`)
  await database.open()
  repo = new WordBankRepo(database)
})

afterEach(async () => {
  cleanup()
  await database.delete()
})

describe('LearnMode teaching', () => {
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
    mocks.prediction = { label: 'A', confidence: 0.99 }
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

describe('LearnMode spelling (gated)', () => {
  it('spells a word from confident letters via the camera', async () => {
    // Make CAT spellable and enable sentences.
    for (const letter of ['C', 'A', 'T']) await repo.markKnown(letter)
    await repo.setLevel('intermediate')

    const view = render(<LearnMode repo={repo} />)
    fireEvent.click(await screen.findByTestId('spell-tab'))
    expect(await screen.findByTestId('spell-word')).toHaveTextContent('CAT')

    for (const letter of ['C', 'A', 'T']) {
      mocks.prediction = { label: letter, confidence: 0.99 }
      view.rerender(<LearnMode repo={repo} />)
    }
    expect(await screen.findByTestId('spell-done')).toBeInTheDocument()
  })
})
