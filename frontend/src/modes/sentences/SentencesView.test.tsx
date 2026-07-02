import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { UseDynamicSignRecognition } from '../../recognition/useDynamicSignRecognition'
import { mulberry32 } from '../../domain/rng'

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

import { SentencesView } from './SentencesView'
import { SignAppDB } from '../../data/db'
import { WordBankRepo } from '../../data/wordBankRepo'
import { SentenceRepo } from '../../data/sentenceRepo'

let counter = 0
let database: SignAppDB
let repo: WordBankRepo
let sentenceRepo: SentenceRepo

beforeEach(async () => {
  Object.assign(mocks.state, { target: null, accepted: false })
  mocks.state.setTarget = vi.fn((gloss: string | null) => {
    mocks.state.target = gloss
    mocks.state.accepted = false
  })
  database = new SignAppDB(`test-sentences-${++counter}`)
  await database.open()
  repo = new WordBankRepo(database)
  sentenceRepo = new SentenceRepo(database)
})

afterEach(async () => {
  cleanup()
  await database.delete()
})

function renderView() {
  return render(
    <SentencesView
      repo={repo}
      sentenceRepo={sentenceRepo}
      rng={mulberry32(1)}
    />,
  )
}

/** Confident enough for exactly the 'want eat' sentence. */
async function makeSignable() {
  for (const sign of ['want', 'eat']) await repo.markKnown(sign)
  await repo.setLevel('intermediate')
}

describe('SentencesView gating', () => {
  it('shows the unlock explainer for a fresh beginner profile', async () => {
    renderView()
    const locked = await screen.findByTestId('sentences-locked')
    expect(locked).toHaveTextContent(/unlock once you know 20 signs/i)
    expect(locked).toHaveTextContent(/you.re at 0/i)
  })

  it('shows the empty state when unlocked but nothing is signable', async () => {
    await repo.setLevel('intermediate') // on from the start, but 0 confident
    renderView()
    expect(await screen.findByTestId('sentences-empty')).toBeInTheDocument()
  })
})

describe('SentencesView drilling', () => {
  it('shows the sentence with the current word highlighted and targeted', async () => {
    await makeSignable()
    renderView()
    const words = await screen.findAllByTestId('sentence-word')
    expect(words.map((w) => w.textContent)).toEqual(['want', 'eat'])
    expect(words[0]).toHaveClass('current')
    expect(mocks.state.setTarget).toHaveBeenLastCalledWith('want')
    // The current word's reference animation renders.
    expect(screen.getByTestId('sign-reference')).toBeInTheDocument()
  })

  it('advances through the words as the recognizer accepts them', async () => {
    await makeSignable()
    const view = renderView()
    await screen.findAllByTestId('sentence-word')

    const rerender = () =>
      view.rerender(
        <SentencesView
          repo={repo}
          sentenceRepo={sentenceRepo}
          rng={mulberry32(1)}
        />,
      )
    // One acceptance = a rising edge: the advance retargets the recognizer,
    // which resets `accepted` (the stub mirrors that); flush the false render
    // first so the component observes the falling edge, as the real hook would.
    const accept = () => {
      rerender()
      mocks.state.accepted = true
      rerender()
    }

    accept() // recognizer accepts "want" (per-sign bar)
    expect(mocks.state.setTarget).toHaveBeenLastCalledWith('eat')

    accept() // recognizer accepts "eat" → completes and records
    expect(await screen.findByTestId('sentence-done')).toBeInTheDocument()
    expect((await sentenceRepo.getProgress('want eat'))?.timesCompleted).toBe(1)
  })

  it('the "That\'s what I did" valve advances without the recognizer', async () => {
    await makeSignable()
    renderView()
    await screen.findAllByTestId('sentence-word')
    fireEvent.click(screen.getByTestId('sentence-got-it'))
    fireEvent.click(screen.getByTestId('sentence-got-it'))
    expect(await screen.findByTestId('sentence-done')).toBeInTheDocument()
    expect((await sentenceRepo.getProgress('want eat'))?.timesCompleted).toBe(1)
  })

  it('updates the progress line after a completion', async () => {
    await makeSignable()
    renderView()
    expect(await screen.findByTestId('sentences-progress')).toHaveTextContent(
      '0 of 1 sentences completed',
    )
    fireEvent.click(screen.getByTestId('sentence-got-it'))
    fireEvent.click(screen.getByTestId('sentence-got-it'))
    await screen.findByTestId('sentence-done')
    expect(await screen.findByTestId('sentences-progress')).toHaveTextContent(
      '1 of 1 sentences completed',
    )
  })

  it('"Next sentence" starts a new drill after completing one', async () => {
    await makeSignable()
    renderView()
    await screen.findAllByTestId('sentence-word')
    fireEvent.click(screen.getByTestId('sentence-got-it'))
    fireEvent.click(screen.getByTestId('sentence-got-it'))
    fireEvent.click(await screen.findByTestId('sentence-next'))
    // Only one eligible sentence, so it recycles — back at word one.
    const words = await screen.findAllByTestId('sentence-word')
    expect(words[0]).toHaveClass('current')
    expect(screen.queryByTestId('sentence-done')).not.toBeInTheDocument()
  })

  it('"Skip sentence" abandons the current sentence without recording', async () => {
    await makeSignable()
    renderView()
    await screen.findAllByTestId('sentence-word')
    fireEvent.click(screen.getByTestId('sentence-got-it')) // mid-sentence
    fireEvent.click(screen.getByTestId('sentence-skip'))
    const words = await screen.findAllByTestId('sentence-word')
    expect(words[0]).toHaveClass('current') // restarted
    expect(await sentenceRepo.getProgress('want eat')).toBeUndefined()
  })
})
