import { test, expect } from '@playwright/test'

// The learner alphabet path (Phase 6 / P6M6, ADR-029). Recall/forgot and the
// spell stage are covered by component tests with a stubbed recognizer; e2e
// proves the route, the teach → recall → complete walk via the valve, and
// persistence.

test('the alphabet path teaches a batch and persists completion', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Course' }).click()
  await page.getByRole('link', { name: 'Alphabet' }).click()

  await expect(page.getByTestId('alphabet-progress')).toContainText(
    '0 of 8 batches completed',
  )
  await expect(page.getByTestId('spell-card')).toContainText(
    /finish the alphabet to unlock/i,
  )

  // Teach A, B, C.
  await page.getByTestId('batch-start').click()
  for (const letter of ['A', 'B', 'C']) {
    await expect(page.getByTestId('letter-teach')).toHaveText(letter)
    await page.getByTestId('letter-teach-next').click()
  }

  // Recall: empty pool → no reviews; 3 letters × 3 reps via the valve.
  await expect(page.getByTestId('letter-recall-prompt')).toBeVisible()
  for (let i = 0; i < 9; i++) {
    await page.getByTestId('letter-valve').click()
  }

  await expect(page.getByTestId('batch-complete')).toBeVisible()
  await page.getByTestId('back-to-alphabet').click()
  await expect(page.getByTestId('alphabet-progress')).toContainText(
    '1 of 8 batches completed',
  )

  // Persistence: survives a reload (same curriculumSets table as words).
  await page.reload()
  await page.getByRole('link', { name: 'Course' }).click()
  await page.getByRole('link', { name: 'Alphabet' }).click()
  await expect(page.getByTestId('alphabet-progress')).toContainText(
    '1 of 8 batches completed',
  )
})
