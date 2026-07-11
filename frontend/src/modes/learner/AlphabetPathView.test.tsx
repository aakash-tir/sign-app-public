import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { mulberry32 } from '../../domain/rng'
import { RECALL_TARGET_REPS } from '../../domain/recall'
import { LETTER_BATCHES } from '../../content/curriculum'
import { SHORT_WORDS } from '../../content/words'

// Controllable stub for the unified recognition hook (camera/model not
// exercised); FingerspellStage uses the same hook, so this covers the spell
// screen too. `reset` clears the debounced match like the real hook.
const mocks = vi.hoisted(() => {
  const state = {
    recognized: null as { label: string; confidence: number } | null,
  }
  return { state }
})

vi.mock('../../recognition/useUnifiedSignRecognition', () => ({
  useUnifiedSignRecognition: () => ({
    videoRef: { current: null },
    canvasRef: { current: null },
    status: 'on',
    error: null,
    trackerError: null,
    ready: true,
    recognized: mocks.state.recognized,
    start: vi.fn(),
    stop: vi.fn(),
    setMode: vi.fn(),
    reset: vi.fn(() => {
      mocks.state.recognized = null
    }),
  }),
}))

import { AlphabetPathView } from './AlphabetPathView'
import { SignAppDB } from '../../data/db'
import { WordBankRepo } from '../../data/wordBankRepo'
import { CurriculumRepo } from '../../data/curriculumRepo'

let counter = 0
let database: SignAppDB
let repo: WordBankRepo
let curriculumRepo: CurriculumRepo

beforeEach(async () => {
  mocks.state.recognized = null
  database = new SignAppDB(`test-alphabet-${++counter}`)
  await database.open()
  repo = new WordBankRepo(database)
  curriculumRepo = new CurriculumRepo(database)
})

afterEach(async () => {
  cleanup()
  // Drain in-flight fire-and-forget writes before deleting (see the other
  // DB-backed suites — deleting mid-write rejects as DatabaseClosedError).
  await database.transaction('rw', database.tables, async () => {})
  await database.delete()
})

const viewTree = () => (
  <MemoryRouter>
    <AlphabetPathView
      repo={repo}
      curriculumRepo={curriculumRepo}
      rng={mulberry32(1)}
    />
  </MemoryRouter>
)

function renderView() {
  return render(viewTree())
}

/** Drive the current batch's teach cards into the recall phase. */
async function startFirstBatch() {
  fireEvent.click(await screen.findByTestId('batch-start'))
  while (screen.queryByTestId('letter-teach-card')) {
    fireEvent.click(screen.getByTestId('letter-teach-next'))
  }
}

describe('the alphabet path list', () => {
  it('renders 8 batches with the first current and the spell card locked', async () => {
    renderView()
    const batches = await screen.findAllByTestId('letter-batch')
    expect(batches).toHaveLength(8)
    expect(batches[0]?.dataset.state).toBe('current')
    expect(batches[1]?.dataset.state).toBe('locked')
    expect(screen.getAllByTestId('batch-start')).toHaveLength(1)
    expect(screen.getByTestId('spell-card')).toHaveTextContent(
      /finish the alphabet to unlock/i,
    )
    expect(screen.queryByTestId('spell-start')).toBeNull()
  })
})

describe('a letter batch session', () => {
  it('teaches each letter with its handshape hint, then enters recall', async () => {
    renderView()
    fireEvent.click(await screen.findByTestId('batch-start'))

    expect(screen.getByTestId('letter-teach')).toHaveTextContent('A')
    expect(screen.getByTestId('letter-hint')).toHaveTextContent(/closed fist/i)
    fireEvent.click(screen.getByTestId('letter-teach-next'))
    expect(screen.getByTestId('letter-teach')).toHaveTextContent('B')
    fireEvent.click(screen.getByTestId('letter-teach-next'))
    expect(screen.getByTestId('letter-teach')).toHaveTextContent('C')
    fireEvent.click(screen.getByTestId('letter-teach-next'))

    expect(screen.queryByTestId('letter-teach-card')).toBeNull()
    expect(screen.getByTestId('letter-recall-prompt')).toBeInTheDocument()
  })

  it('a recognized letter counts as a correct recall (committing-guarded)', async () => {
    const view = renderView()
    await startFirstBatch()

    const prompted = screen.getByTestId('letter-recall-prompt')
      .textContent as string
    mocks.state.recognized = { label: prompted, confidence: 0.99 }
    // Re-render so the effect sees the new recognition (stub isn't reactive).
    view.rerender(viewTree())
    expect(screen.getByTestId('letter-recall-progress')).toHaveTextContent(
      /^1 of \d+ recalls$/,
    )
  })

  it('"I forgot" records a wrong, reveals the hint, and continues', async () => {
    renderView()
    await startFirstBatch()

    const prompted = screen.getByTestId('letter-recall-prompt')
      .textContent as string
    fireEvent.click(screen.getByTestId('letter-forgot'))

    expect(screen.getByTestId('letter-reveal')).toHaveTextContent(prompted)
    await vi.waitFor(async () => {
      const progress = await repo.getProgress(prompted)
      expect(progress?.timesSeen).toBe(1)
      expect(progress?.needPracticeStreak).toBe(0)
    })

    fireEvent.click(screen.getByTestId('letter-continue'))
    expect(screen.queryByTestId('letter-reveal')).toBeNull()
    expect(screen.getByTestId('letter-recall-prompt')).toBeInTheDocument()
  })

  it('completing the batch persists it and unlocks the next', async () => {
    renderView()
    await startFirstBatch()

    // Empty learned pool → no review interleave: 3 letters × target reps.
    for (let i = 0; i < 3 * RECALL_TARGET_REPS; i++) {
      fireEvent.click(screen.getByTestId('letter-valve'))
    }

    expect(await screen.findByTestId('batch-complete')).toHaveTextContent(
      /A \+ B \+ C/,
    )
    await vi.waitFor(async () => {
      expect(await curriculumRepo.completedIds()).toEqual(new Set(['A B C']))
    })

    fireEvent.click(screen.getByTestId('back-to-alphabet'))
    expect(await screen.findByTestId('alphabet-progress')).toHaveTextContent(
      '1 of 8 batches completed',
    )
    const batches = screen.getAllByTestId('letter-batch')
    expect(batches[0]?.dataset.state).toBe('completed')
    expect(batches[1]?.dataset.state).toBe('current')
  })
})

describe('the spell-words stage', () => {
  beforeEach(async () => {
    for (const batch of LETTER_BATCHES) {
      await curriculumRepo.markCompleted(batch.id)
    }
  })

  it('unlocks once every batch is complete', async () => {
    renderView()
    expect(await screen.findByTestId('alphabet-progress')).toHaveTextContent(
      '8 of 8 batches completed',
    )
    expect(screen.getByTestId('spell-card')).toHaveTextContent(
      `${SHORT_WORDS.length} short words`,
    )
    expect(screen.getByTestId('spell-start')).toBeInTheDocument()
  })

  it('spells a short word and can pick another', async () => {
    renderView()
    fireEvent.click(await screen.findByTestId('spell-start'))

    expect(screen.getByTestId('spell-screen')).toBeInTheDocument()
    const first = screen.getByTestId('fingerspell-word').textContent as string
    expect(SHORT_WORDS).toContain(first)

    fireEvent.click(screen.getByTestId('spell-another'))
    const second = screen.getByTestId('fingerspell-word').textContent as string
    expect(SHORT_WORDS).toContain(second)
    expect(second).not.toBe(first)

    fireEvent.click(screen.getByTestId('spell-back'))
    expect(await screen.findByTestId('alphabet-progress')).toBeInTheDocument()
  })
})
