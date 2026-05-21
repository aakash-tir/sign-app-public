import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

// Controllable stub for the recognition hook (lets us simulate a camera match).
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

import { PracticeMode } from './PracticeMode'
import { SignAppDB } from '../../data/db'
import { WordBankRepo } from '../../data/wordBankRepo'

let counter = 0
let database: SignAppDB
let repo: WordBankRepo

beforeEach(async () => {
  mocks.prediction = null
  mocks.resetPrediction.mockClear()
  database = new SignAppDB(`test-practice-${++counter}`)
  await database.open()
  repo = new WordBankRepo(database)
})

afterEach(async () => {
  cleanup() // unmount before closing the db to avoid late db access
  await database.delete()
})

async function renderAndGetTarget() {
  const view = render(<PracticeMode repo={repo} />)
  const target =
    (await screen.findByTestId('practice-target')).textContent ?? ''
  return { view, target }
}

describe('PracticeMode', () => {
  it('seeds the bank and shows a target letter', async () => {
    const { target } = await renderAndGetTarget()
    expect(target.length).toBe(1)
    expect(await repo.getProgress(target)).toBeDefined()
  })

  it('"I forgot" reveals the sign without committing anything', async () => {
    const { target } = await renderAndGetTarget()
    fireEvent.click(screen.getByTestId('i-forgot'))
    expect(await screen.findByTestId('reveal')).toBeInTheDocument()
    // Nothing committed yet (deferred-commit): the word is untouched.
    expect((await repo.getProgress(target))?.timesSeen).toBe(0)
  })

  it('"That\'s what I did" commits a correct answer', async () => {
    const { target } = await renderAndGetTarget()
    fireEvent.click(screen.getByTestId('i-forgot'))
    fireEvent.click(await screen.findByTestId('thats-what-i-did'))
    expect(await screen.findByTestId('correct-feedback')).toBeInTheDocument()
    const progress = await repo.getProgress(target)
    expect(progress?.needPracticeStreak).toBe(1)
    expect(progress?.timesSeen).toBe(1)
  })

  it('"Next" after "I forgot" commits a wrong answer (no incorrect screen)', async () => {
    const { target } = await renderAndGetTarget()
    fireEvent.click(screen.getByTestId('i-forgot'))
    fireEvent.click(await screen.findByTestId('reveal-next'))
    // Advances straight to the next signing prompt — no error/incorrect screen.
    expect(await screen.findByTestId('practice-target')).toBeInTheDocument()
    expect(screen.queryByTestId('correct-feedback')).toBeNull()
    const progress = await repo.getProgress(target)
    expect(progress?.bucket).toBe('need-practice')
    expect(progress?.needPracticeStreak).toBe(0)
    expect(progress?.timesSeen).toBe(1)
  })

  it('a camera-recognized target letter commits a correct answer', async () => {
    const { view, target } = await renderAndGetTarget()
    mocks.prediction = { label: target, confidence: 0.99 }
    view.rerender(<PracticeMode repo={repo} />)
    expect(await screen.findByTestId('correct-feedback')).toBeInTheDocument()
    expect((await repo.getProgress(target))?.timesSeen).toBe(1)
  })
})
