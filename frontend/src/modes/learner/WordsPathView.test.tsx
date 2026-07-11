import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { UseDynamicSignRecognition } from '../../recognition/useDynamicSignRecognition'
import { mulberry32 } from '../../domain/rng'
import { RECALL_TARGET_REPS } from '../../domain/recall'

// Controllable stub for the dynamic recognition hook (camera/model not exercised).
const mocks = vi.hoisted(() => {
  const state: UseDynamicSignRecognition = {
    videoRef: () => {},
    canvasRef: { current: null },
    status: 'on',
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

import { WordsPathView } from './WordsPathView'
import { SignAppDB } from '../../data/db'
import { WordBankRepo } from '../../data/wordBankRepo'
import { CurriculumRepo } from '../../data/curriculumRepo'
import { SentenceRepo } from '../../data/sentenceRepo'

let counter = 0
let database: SignAppDB
let repo: WordBankRepo
let curriculumRepo: CurriculumRepo
let sentenceRepo: SentenceRepo

beforeEach(async () => {
  Object.assign(mocks.state, { target: null, accepted: false })
  mocks.state.setTarget = vi.fn((gloss: string | null) => {
    mocks.state.target = gloss
    mocks.state.accepted = false
  })
  database = new SignAppDB(`test-words-path-${++counter}`)
  await database.open()
  repo = new WordBankRepo(database)
  curriculumRepo = new CurriculumRepo(database)
  sentenceRepo = new SentenceRepo(database)
})

afterEach(async () => {
  cleanup()
  // Drain in-flight fire-and-forget writes (recordAttempt / markCompleted /
  // recordCompletion) before deleting: an empty rw transaction over the
  // written tables queues behind them (IndexedDB serializes overlapping
  // scopes in creation order). Deleting mid-write rejects them as unhandled
  // DatabaseClosedError — exactly what failed CI on PR #54.
  await database.transaction('rw', database.tables, async () => {})
  await database.delete()
})

function renderView() {
  return render(
    <WordsPathView
      repo={repo}
      curriculumRepo={curriculumRepo}
      sentenceRepo={sentenceRepo}
      rng={mulberry32(1)}
    />,
  )
}

/** Drive the current set's teach cards into the recall phase. */
async function startFirstSet() {
  fireEvent.click(await screen.findByTestId('set-start'))
  while (screen.queryByTestId('teach-card')) {
    fireEvent.click(screen.getByTestId('teach-next'))
  }
}

describe('the path list', () => {
  it('renders the route with exactly one current set (the first)', async () => {
    renderView()
    const sets = await screen.findAllByTestId('path-set')
    expect(sets.length).toBeGreaterThan(50) // the 62-set route
    expect(sets[0]?.dataset.state).toBe('current')
    expect(sets.filter((s) => s.dataset.state === 'current')).toHaveLength(1)
    expect(sets[1]?.dataset.state).toBe('locked')
    expect(screen.getAllByTestId('set-start')).toHaveLength(1)
  })

  it('renders placeholder-only sets as "coming soon" with no start button', async () => {
    renderView()
    const sets = await screen.findAllByTestId('path-set')
    const placeholderSets = sets.filter(
      (s) => s.dataset.state === 'placeholder',
    )
    expect(placeholderSets.length).toBeGreaterThan(0)
    expect(placeholderSets[0]).toHaveTextContent(/coming soon/i)
    for (const set of placeholderSets) {
      expect(set.querySelector('button')).toBeNull()
    }
  })

  it('shows completed sets as reviewable and counts progress', async () => {
    await curriculumRepo.markCompleted('want eat')
    renderView()
    expect(await screen.findByTestId('words-path-progress')).toHaveTextContent(
      /^1 of \d+ sets completed$/,
    )
    const sets = screen.getAllByTestId('path-set')
    expect(sets[0]?.dataset.state).toBe('completed')
    expect(screen.getByTestId('set-review')).toBeInTheDocument()
    // The current set moved to the next teachable one.
    expect(sets[1]?.dataset.state).toBe('current')
  })
})

describe('the teach phase', () => {
  it('teaches each new word with its reference, then enters recall', async () => {
    renderView()
    fireEvent.click(await screen.findByTestId('set-start'))

    expect(screen.getByTestId('teach-word')).toHaveTextContent('want')
    expect(mocks.state.setTarget).toHaveBeenLastCalledWith('want')
    fireEvent.click(screen.getByTestId('teach-next'))

    expect(screen.getByTestId('teach-word')).toHaveTextContent('eat')
    fireEvent.click(screen.getByTestId('teach-next'))

    expect(screen.queryByTestId('teach-card')).toBeNull()
    expect(screen.getByTestId('recall-prompt')).toBeInTheDocument()
  })
})

describe('the recall phase', () => {
  it('targets the prompted word and advances on the valve', async () => {
    renderView()
    await startFirstSet()

    const prompted = screen.getByTestId('recall-prompt').textContent as string
    expect(mocks.state.setTarget).toHaveBeenLastCalledWith(prompted)
    expect(screen.getByTestId('recall-progress')).toHaveTextContent(
      `0 of ${2 * RECALL_TARGET_REPS} recalls`,
    )

    fireEvent.click(screen.getByTestId('recall-valve'))
    expect(screen.getByTestId('recall-progress')).toHaveTextContent(
      `1 of ${2 * RECALL_TARGET_REPS} recalls`,
    )
    // The valve records a correct attempt against the word bank (ADR-008) —
    // the write is fire-and-forget, so poll for it.
    await vi.waitFor(async () => {
      const progress = await repo.getProgress(prompted)
      expect(progress?.timesSeen).toBe(1)
      expect(progress?.needPracticeStreak).toBe(1)
    })
  })

  it('"I forgot" records a wrong, reveals the reference, and continues', async () => {
    renderView()
    await startFirstSet()

    const prompted = screen.getByTestId('recall-prompt').textContent as string
    fireEvent.click(screen.getByTestId('recall-forgot'))

    const reveal = screen.getByTestId('recall-reveal')
    expect(reveal).toHaveTextContent(prompted)
    // Wrong already committed (forgot alone = wrong, ADR-008); fire-and-forget
    // write, so poll for it.
    await vi.waitFor(async () => {
      const progress = await repo.getProgress(prompted)
      expect(progress?.timesSeen).toBe(1)
      expect(progress?.needPracticeStreak).toBe(0)
    })
    // Progress did not advance.
    expect(screen.getByTestId('recall-progress')).toHaveTextContent(
      /^0 of \d+ recalls$/,
    )

    fireEvent.click(screen.getByTestId('recall-continue'))
    expect(screen.queryByTestId('recall-reveal')).toBeNull()
    expect(screen.getByTestId('recall-prompt')).toBeInTheDocument()
  })

  it('completes the set after every word reaches its target, and persists', async () => {
    renderView()
    await startFirstSet()

    // Fresh DB → empty learned pool → no review interleave: exactly
    // 2 words × target reps valve clicks complete the set.
    for (let i = 0; i < 2 * RECALL_TARGET_REPS; i++) {
      fireEvent.click(screen.getByTestId('recall-valve'))
    }
    await vi.waitFor(async () => {
      expect(await curriculumRepo.completedIds()).toEqual(new Set(['want eat']))
    })

    // The sentence stage comes first (P6M5); skip it here.
    expect(screen.getByTestId('sentence-stage')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('stage-skip'))

    expect(await screen.findByTestId('set-complete')).toHaveTextContent(
      /set complete/i,
    )
    fireEvent.click(screen.getByTestId('back-to-path'))
    expect(await screen.findByTestId('words-path-progress')).toHaveTextContent(
      /^1 of \d+ sets completed$/,
    )
    const sets = screen.getAllByTestId('path-set')
    expect(sets[0]?.dataset.state).toBe('completed')
    expect(sets[1]?.dataset.state).toBe('current')
  })
})

describe('the sentence stage (P6M5)', () => {
  /** Complete the first set's recall via the valve, landing on the stage. */
  async function completeFirstSet() {
    renderView()
    await startFirstSet()
    for (let i = 0; i < 2 * RECALL_TARGET_REPS; i++) {
      fireEvent.click(screen.getByTestId('recall-valve'))
    }
  }

  it('stages a sentence built from the new words after the set completes', async () => {
    await completeFirstSet()

    // Pool = {want, eat} → the only buildable sentence is "want eat".
    const stage = screen.getByTestId('sentence-stage')
    expect(stage).toBeInTheDocument()
    const words = screen.getAllByTestId('sentence-word')
    expect(words.map((w) => w.textContent)).toEqual(['want', 'eat'])
    expect(words[0]).toHaveClass('current')
    expect(mocks.state.setTarget).toHaveBeenLastCalledWith('want')
  })

  it('drilling the sentence records it and lands on set-complete', async () => {
    await completeFirstSet()

    fireEvent.click(screen.getByTestId('sentence-got-it')) // want
    fireEvent.click(screen.getByTestId('sentence-got-it')) // eat → complete

    expect(await screen.findByTestId('set-complete')).toBeInTheDocument()
    await vi.waitFor(async () => {
      expect(await sentenceRepo.getProgress('want eat')).toMatchObject({
        timesCompleted: 1,
      })
    })
  })

  it('skipping the stage records nothing', async () => {
    await completeFirstSet()

    fireEvent.click(screen.getByTestId('stage-skip'))
    expect(await screen.findByTestId('set-complete')).toBeInTheDocument()
    expect(await sentenceRepo.getProgress('want eat')).toBeUndefined()
  })
})
