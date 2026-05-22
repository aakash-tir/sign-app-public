import { test, expect } from '@playwright/test'

// The camera demo lives behind the "Camera" tab (Practice is the default mode).
async function openCameraTab(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('link', { name: 'Camera' }).click()
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
  // One-time privacy explainer before the first acquire (FR-15).
  await page.getByTestId('camera-explainer-continue').click()
  await expect(page.getByTestId('camera-status')).toContainText(/camera on/i, {
    timeout: 15_000,
  })
  await expect(page.getByTestId('prediction')).toBeVisible()
})

test('camera stays on across tab switches — no re-enable (FR-15)', async ({
  page,
}) => {
  await openCameraTab(page)
  await page.getByRole('button', { name: /enable camera/i }).click()
  await page.getByTestId('camera-explainer-continue').click()
  await expect(page.getByTestId('camera-status')).toContainText(/camera on/i, {
    timeout: 15_000,
  })

  // Switch to the Signs tab: the shared camera is already on, with no prompt.
  await page.getByRole('link', { name: 'Signs' }).click()
  await expect(page.getByTestId('camera-status')).toContainText(/camera on/i, {
    timeout: 15_000,
  })
  await expect(
    page.getByRole('button', { name: /enable camera/i }),
  ).toHaveCount(0)
})

test('camera works on the Learn tab (late-mounted video gets the stream)', async ({
  page,
}) => {
  await openCameraTab(page)
  await page.getByRole('button', { name: /enable camera/i }).click()
  await page.getByTestId('camera-explainer-continue').click()
  await expect(page.getByTestId('camera-status')).toContainText(/camera on/i, {
    timeout: 15_000,
  })

  // Learn renders a "Loading…" gate before its <video> mounts; the shared stream
  // must still attach (callback ref), with no re-enable prompt.
  await page.getByRole('link', { name: 'Learn' }).click()
  await expect(page.getByTestId('learn-target')).toBeVisible()
  await expect(
    page.getByRole('button', { name: /enable camera/i }),
  ).toHaveCount(0)
  const videoHasStream = await page
    .locator('video')
    .first()
    .evaluate((el) => (el as HTMLVideoElement).srcObject !== null)
  expect(videoHasStream).toBe(true)
})
