import { test, expect } from '@playwright/test'

// The camera demo lives behind the "Camera" tab (Practice is the default mode).
async function openCameraTab(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Camera', exact: true }).click()
}

test('camera view mounts with an enable button', async ({ page }) => {
  await openCameraTab(page)
  await expect(
    page.getByRole('button', { name: /enable camera/i }),
  ).toBeVisible()
})

test('enabling the camera turns it on (fake media stream)', async ({
  page,
}) => {
  await openCameraTab(page)
  await page.getByRole('button', { name: /enable camera/i }).click()
  await expect(page.getByTestId('camera-status')).toContainText(/camera on/i, {
    timeout: 15_000,
  })
  await expect(page.getByTestId('prediction')).toBeVisible()
})
