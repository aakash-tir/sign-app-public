import { test, expect } from '@playwright/test'

// The dynamic word-level sign demo lives behind the "Signs" tab.
async function openSignsTab(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('link', { name: 'Signs' }).click()
}

test('dynamic signs view mounts with an enable button', async ({ page }) => {
  await openSignsTab(page)
  await expect(
    page.getByRole('button', { name: /enable camera/i }),
  ).toBeVisible()
})

test('enabling the camera turns the dynamic view on (fake media stream)', async ({
  page,
}) => {
  await openSignsTab(page)
  await page.getByRole('button', { name: /enable camera/i }).click()
  // One-time privacy explainer before the first acquire (FR-15).
  await page.getByTestId('camera-explainer-continue').click()
  await expect(page.getByTestId('camera-status')).toContainText(/camera on/i, {
    timeout: 15_000,
  })
  await expect(page.getByTestId('prediction')).toBeVisible()
})
