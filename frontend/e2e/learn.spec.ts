import { test, expect } from '@playwright/test'

test('Learn mode teaches a letter and advances on "That\'s what I did"', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Learn' }).click()
  await expect(page.getByTestId('learn-target')).toBeVisible()
  await page.getByTestId('learn-got-it').click()
  await expect(page.getByTestId('learn-good')).toBeVisible()
  await page.getByTestId('learn-next').click()
  await expect(page.getByTestId('learn-target')).toBeVisible()
})
