import { test, expect } from '@playwright/test'

test('app shell loads and shows the app name', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /sign app/i })).toBeVisible()
})

test('registers a service worker (installable PWA)', async ({ page }) => {
  await page.goto('/')
  const hasServiceWorker = await page.evaluate(
    () => 'serviceWorker' in navigator,
  )
  expect(hasServiceWorker).toBe(true)
})
