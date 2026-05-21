import { test, expect } from '@playwright/test'

test('camera view mounts with an enable button', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('button', { name: /enable camera/i }),
  ).toBeVisible()
})

test('enabling the camera turns it on (fake media stream)', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: /enable camera/i }).click()
  await expect(page.getByTestId('camera-status')).toContainText(/camera on/i, {
    timeout: 15_000,
  })
})
