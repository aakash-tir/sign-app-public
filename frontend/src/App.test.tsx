import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import App from './App'
import { setDevMode } from './devMode'

afterEach(() => {
  cleanup()
  setDevMode(false)
})

describe('App', () => {
  it('renders the app name', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: /sign app/i }),
    ).toBeInTheDocument()
  })

  it('shows the learner nav by default — no developer tabs (Q2)', () => {
    render(<App />)
    for (const name of ['Home', 'Course', 'Sentences', 'Search', 'Settings']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument()
    }
    for (const name of ['Practice', 'Learn', 'Signs', 'Camera']) {
      expect(screen.queryByRole('link', { name })).toBeNull()
    }
  })

  it('dev mode reveals the developer tabs', () => {
    setDevMode(true)
    render(<App />)
    for (const name of ['Practice', 'Learn', 'Signs', 'Camera']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument()
    }
  })
})
