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

test('app shell loads offline once the service worker is active (FR-12)', async ({
  page,
  context,
}) => {
  await page.goto('/')
  // Wait for the SW to activate, then reload so it controls the page.
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, {
    timeout: 20_000,
  })

  // Cut the network: the precached shell must still render.
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: /sign app/i })).toBeVisible()
  await context.setOffline(false)
})
