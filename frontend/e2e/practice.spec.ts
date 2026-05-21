import { test, expect } from '@playwright/test'

// Practice is the default mode. These cover the button-driven branches of the
// loop (which don't need a real camera sign).

test('shows a target letter to sign', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('practice-target')).toBeVisible()
  await expect(page.getByTestId('i-forgot')).toBeVisible()
})

test('"I forgot" -> "That\'s what I did" (correct) advances', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('practice-target')).toBeVisible()
  await page.getByTestId('i-forgot').click()
  await expect(page.getByTestId('reveal')).toBeVisible()
  await page.getByTestId('thats-what-i-did').click()
  await expect(page.getByTestId('correct-feedback')).toBeVisible()
  await page.getByTestId('next-word').click()
  await expect(page.getByTestId('practice-target')).toBeVisible()
})

test('"I forgot" -> "Next" (wrong) advances with no incorrect screen', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('practice-target')).toBeVisible()
  await page.getByTestId('i-forgot').click()
  await page.getByTestId('reveal-next').click()
  await expect(page.getByTestId('practice-target')).toBeVisible()
  await expect(page.getByTestId('correct-feedback')).toHaveCount(0)
})
