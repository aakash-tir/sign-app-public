import { test, expect } from '@playwright/test'

test('level can be changed and turns sentences on', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByTestId('level-current')).toContainText(/beginner/i)
  await page.getByTestId('level-intermediate').click()
  await expect(page.getByTestId('level-current')).toContainText(/intermediate/i)
  await expect(page.getByTestId('sentence-status')).toContainText(
    /sentences are on/i,
  )
})

test('marking a letter known persists', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByTestId('known-A').click()
  await expect(page.getByTestId('known-A')).toBeDisabled()
})
