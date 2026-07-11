import { test, expect } from '@playwright/test'

// The learner words path (Phase 6 / P6M4, ADR-029). The recall engine and the
// forgot/reveal flow are covered by component tests with a stubbed recognizer;
// e2e proves the route, the teach → recall → complete walk (via the "That's
// what I did" valve — no camera needed), and that progress persists.

test('the course path lists units with one startable set', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Course' }).click()

  await expect(page.getByTestId('words-path-progress')).toContainText(
    /0 of \d+ sets completed/,
  )
  await expect(page.getByTestId('set-start')).toHaveCount(1)
  // Placeholder slots read as intentional, not broken.
  await expect(
    page.locator('[data-testid="path-set"][data-state="placeholder"]').first(),
  ).toContainText(/coming soon/i)
})

test('teach → recall → set complete via the valve; progress survives reload', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Course' }).click()

  await page.getByTestId('set-start').click()

  // Teach both words of the first set (want, eat).
  await expect(page.getByTestId('teach-word')).toHaveText('want')
  await page.getByTestId('teach-next').click()
  await expect(page.getByTestId('teach-word')).toHaveText('eat')
  await page.getByTestId('teach-next').click()

  // Recall: an empty learned pool means no review interleave — exactly
  // 2 words × 3 reps valve confirmations complete the set.
  await expect(page.getByTestId('recall-prompt')).toBeVisible()
  for (let i = 0; i < 6; i++) {
    await page.getByTestId('recall-valve').click()
  }

  // The sentence stage follows (P6M5): use the new words in "want eat".
  await expect(page.getByTestId('sentence-stage')).toBeVisible()
  await expect(page.getByTestId('sentence-words')).toContainText('want')
  await page.getByTestId('sentence-got-it').click() // want
  await page.getByTestId('sentence-got-it').click() // eat → complete

  await expect(page.getByTestId('set-complete')).toBeVisible()
  await page.getByTestId('back-to-path').click()
  await expect(page.getByTestId('words-path-progress')).toContainText(
    /1 of \d+ sets completed/,
  )

  // Persistence: the completed set survives a full reload (Dexie v4).
  await page.reload()
  await page.getByRole('link', { name: 'Course' }).click()
  await expect(page.getByTestId('words-path-progress')).toContainText(
    /1 of \d+ sets completed/,
  )
  await expect(
    page.locator('[data-testid="path-set"][data-state="completed"]'),
  ).toHaveCount(1)
})
