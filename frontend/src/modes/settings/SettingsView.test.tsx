import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { SettingsView } from './SettingsView'
import { SignAppDB } from '../../data/db'
import { WordBankRepo } from '../../data/wordBankRepo'

let counter = 0
let database: SignAppDB
let repo: WordBankRepo

beforeEach(async () => {
  database = new SignAppDB(`test-settings-${++counter}`)
  await database.open()
  repo = new WordBankRepo(database)
})

afterEach(async () => {
  cleanup()
  await database.delete()
})

describe('SettingsView', () => {
  it('defaults to beginner with sentences locked', async () => {
    render(<SettingsView repo={repo} />)
    expect(await screen.findByTestId('level-current')).toHaveTextContent(
      /beginner/i,
    )
    expect(screen.getByTestId('sentence-status')).toHaveTextContent(
      /unlock at 20/i,
    )
  })

  it('reassigning to intermediate turns sentences on (and persists)', async () => {
    render(<SettingsView repo={repo} />)
    await screen.findByTestId('level-current')
    fireEvent.click(screen.getByTestId('level-intermediate'))
    await waitFor(() =>
      expect(screen.getByTestId('level-current')).toHaveTextContent(
        /intermediate/i,
      ),
    )
    expect(screen.getByTestId('sentence-status')).toHaveTextContent(
      /sentences are on/i,
    )
    expect((await repo.getProfile()).level).toBe('intermediate')
  })

  it('marking a letter known adds it as confident', async () => {
    render(<SettingsView repo={repo} />)
    await screen.findByTestId('level-current')
    fireEvent.click(screen.getByTestId('known-A'))
    await waitFor(() => expect(screen.getByTestId('known-A')).toBeDisabled())
    expect((await repo.getProgress('A'))?.bucket).toBe('confident')
  })
})
