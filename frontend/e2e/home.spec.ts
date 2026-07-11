import { test, expect } from '@playwright/test'

// The learner shell (Phase 6 / P6M7, ADR-029): the home view is the default,
// the developer tabs hide behind the Settings dev-mode toggle (Q2), and a
// lesson can be exited at any time (owner feedback).

test('the app opens on the learner home with no developer tabs', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('home-continue')).toHaveText(/start learning/i)
  await expect(page.getByTestId('home-words-card')).toContainText(
    /0 of \d+ sets/,
  )
  // Scope to the nav — the home cards are links with overlapping names.
  const nav = page.getByRole('navigation', { name: 'Main' })
  for (const name of ['Home', 'Course', 'Sentences', 'Search', 'Settings']) {
    await expect(nav.getByRole('link', { name })).toBeVisible()
  }
  for (const name of ['Practice', 'Learn', 'Signs', 'Camera']) {
    await expect(nav.getByRole('link', { name })).toHaveCount(0)
  }
})

test('dev mode reveals the developer tabs and persists', async ({ page }) => {
  await page.goto('/settings')
  await page.getByTestId('dev-mode-on').click()
  await expect(page.getByRole('link', { name: 'Practice' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('link', { name: 'Practice' })).toBeVisible()

  await page.getByTestId('dev-mode-off').click()
  await expect(page.getByRole('link', { name: 'Practice' })).toHaveCount(0)
})

test('a lesson can be exited at any time (owner feedback)', async ({
  page,
}) => {
  await page.goto('/course')
  await page.getByTestId('set-start').click()
  await expect(page.getByTestId('teach-card')).toBeVisible()
  await page.getByTestId('exit-lesson').click()
  await expect(page.getByTestId('words-path-progress')).toContainText(
    /0 of \d+ sets completed/,
  )
  await expect(page.getByTestId('set-start')).toBeVisible()
})
