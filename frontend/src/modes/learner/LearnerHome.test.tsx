import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LearnerHome } from './LearnerHome'
import { SignAppDB } from '../../data/db'
import { CurriculumRepo } from '../../data/curriculumRepo'
import { LETTER_BATCHES } from '../../content/curriculum'

let counter = 0
let database: SignAppDB
let curriculumRepo: CurriculumRepo

beforeEach(async () => {
  database = new SignAppDB(`test-home-${++counter}`)
  await database.open()
  curriculumRepo = new CurriculumRepo(database)
})

afterEach(async () => {
  cleanup()
  await database.transaction('rw', database.tables, async () => {})
  await database.delete()
})

function renderHome() {
  return render(
    <MemoryRouter>
      <LearnerHome curriculumRepo={curriculumRepo} />
    </MemoryRouter>,
  )
}

describe('LearnerHome', () => {
  it('greets a fresh learner with Start and zero progress', async () => {
    renderHome()
    expect(await screen.findByTestId('home-continue')).toHaveTextContent(
      /start learning/i,
    )
    expect(screen.getByTestId('home-words-card')).toHaveTextContent(
      /0 of \d+ sets/,
    )
    expect(screen.getByTestId('home-words-card')).toHaveTextContent(
      /next: want \+ eat/i,
    )
    expect(screen.getByTestId('home-units-progress')).toHaveTextContent(
      /^0 of \d+ units complete$/,
    )
    expect(screen.getByTestId('home-alphabet-card')).toHaveTextContent(
      /0 of 8 batches/,
    )
    expect(screen.getByTestId('home-alphabet-card')).toHaveTextContent(
      /next: a b c/i,
    )
  })

  it('welcomes back a learner with progress and the next set', async () => {
    await curriculumRepo.markCompleted('want eat')
    renderHome()
    expect(await screen.findByTestId('home-continue')).toHaveTextContent(
      /continue learning/i,
    )
    expect(screen.getByTestId('home-words-card')).toHaveTextContent(
      /1 of \d+ sets/,
    )
    expect(screen.getByTestId('home-words-card')).toHaveTextContent(
      /next: drink \+ water/i,
    )
  })

  it('counts a unit complete once its teachable sets are done (#60)', async () => {
    for (const id of [
      'want eat',
      'drink water',
      'more please',
      'help milk',
      'yes no',
    ])
      await curriculumRepo.markCompleted(id)
    renderHome()
    expect(await screen.findByTestId('home-units-progress')).toHaveTextContent(
      /^1 of \d+ units complete$/,
    )
    expect(screen.getByTestId('home-words-card')).toHaveTextContent(
      /5 of \d+ sets/,
    )
  })

  it('celebrates a finished alphabet with the spell unlock', async () => {
    for (const batch of LETTER_BATCHES) {
      await curriculumRepo.markCompleted(batch.id)
    }
    renderHome()
    expect(await screen.findByTestId('home-alphabet-card')).toHaveTextContent(
      /spell words unlocked/i,
    )
  })
})
