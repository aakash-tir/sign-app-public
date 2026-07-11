import { test, expect } from '@playwright/test'

// The Sentences section (Phase 5, FR-20, ADR-028). The drill itself is covered
// by component tests with a stubbed recognizer; e2e proves the route, the
// ADR-009 gating, and the empty state — no camera needed.

test('a fresh beginner sees the sentence unlock explainer', async ({
  page,
}) => {
  await page.goto('/sentences')

  const locked = page.getByTestId('sentences-locked')
  await expect(locked).toBeVisible()
  await expect(locked).toContainText(/unlock once you know 20 signs/i)
})

test('intermediate level turns sentences on; no confident signs → empty state', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByTestId('level-intermediate').click()
  await expect(page.getByTestId('level-current')).toContainText(/intermediate/i)

  await page.getByRole('link', { name: 'Sentences' }).click()
  await expect(page.getByTestId('sentences-empty')).toBeVisible()
})
