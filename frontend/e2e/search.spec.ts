import { test, expect } from '@playwright/test'

// The sign search feature lives behind the "Search" tab (P4M1, FR-19).
async function openSearchTab(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('link', { name: 'Search' }).click()
}

test('searching a shipped sign shows its reference and a practice prompt', async ({
  page,
}) => {
  await openSearchTab(page)
  await page.getByTestId('sign-search-input').fill('father')
  await page.getByRole('button', { name: /search/i }).click()

  await expect(page.getByTestId('sign-search-found')).toContainText(/father/i)
  // Reference animation renders without needing the camera (offline-capable).
  await expect(page.getByTestId('sign-reference')).toBeVisible()
  // The practice stage offers to enable the camera.
  await expect(
    page.getByRole('button', { name: /enable camera/i }),
  ).toBeVisible()
})

test('a synonym resolves to the canonical sign', async ({ page }) => {
  await openSearchTab(page)
  await page.getByTestId('sign-search-input').fill('thanks')
  await page.getByRole('button', { name: /search/i }).click()
  await expect(page.getByTestId('sign-search-found')).toContainText(
    /thank you/i,
  )
})

test('searching an unknown sign reports it is not in the system', async ({
  page,
}) => {
  await openSearchTab(page)
  await page.getByTestId('sign-search-input').fill('xyzzy')
  await page.getByRole('button', { name: /search/i }).click()

  await expect(page.getByTestId('sign-search-missing')).toContainText(
    /isn.t in the system yet/i,
  )
  await expect(page.getByTestId('sign-reference')).toHaveCount(0)
})
