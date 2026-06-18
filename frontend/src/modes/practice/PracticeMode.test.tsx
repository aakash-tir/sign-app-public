import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'

// Controllable stub for the unified recognition hook (simulates a camera match).
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

import { PracticeMode } from './PracticeMode'
import { SignAppDB } from '../../data/db'
import { WordBankRepo } from '../../data/wordBankRepo'

let counter = 0
let database: SignAppDB
let repo: WordBankRepo

beforeEach(async () => {
  mocks.recognized = null
  mocks.reset.mockClear()
  mocks.setMode.mockClear()
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
  it('seeds the bank (letters + dynamic signs) and shows a target', async () => {
    const { target } = await renderAndGetTarget()
    expect(target.length).toBeGreaterThan(0)
    expect(await repo.getProgress(target)).toBeDefined()
    // bank holds 24 letters + 103 shipped dynamic glosses (P4M17 dropped 3 confusers)
    expect(await repo.allProgress()).toHaveLength(127)
  })

  it('points the recognizer at the right model for the prompt', async () => {
    await renderAndGetTarget()
    await waitFor(() =>
      expect(mocks.setMode).toHaveBeenCalledWith(
        expect.stringMatching(/letter|sign/),
      ),
    )
  })

  it('"I forgot" reveals the sign without committing anything', async () => {
    const { target } = await renderAndGetTarget()
    fireEvent.click(screen.getByTestId('i-forgot'))
    expect(await screen.findByTestId('reveal')).toBeInTheDocument()
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
    expect(await screen.findByTestId('practice-target')).toBeInTheDocument()
    expect(screen.queryByTestId('correct-feedback')).toBeNull()
    const progress = await repo.getProgress(target)
    expect(progress?.bucket).toBe('need-practice')
    expect(progress?.needPracticeStreak).toBe(0)
    expect(progress?.timesSeen).toBe(1)
  })

  it('a camera-recognized target commits a correct answer', async () => {
    const { view, target } = await renderAndGetTarget()
    mocks.recognized = { label: target, confidence: 0.99 }
    view.rerender(<PracticeMode repo={repo} />)
    expect(await screen.findByTestId('correct-feedback')).toBeInTheDocument()
    expect((await repo.getProgress(target))?.timesSeen).toBe(1)
  })
})
