import { defineConfig, devices } from '@playwright/test'

// Builds the PWA and serves the production preview, then runs the e2e smoke
// tests against it. This also indirectly verifies that the build succeeds.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    // Not vite's default preview port (4173): with reuseExistingServer, a
    // preview server from *another* project on the default port silently
    // becomes the test target (bit us twice — the suite "passed" 1/23 against
    // a different app). A project-unique port makes that collision impossible.
    baseURL: 'http://localhost:4179',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Provide a synthetic camera stream and auto-accept the permission
        // prompt so getUserMedia works headlessly in CI.
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
          ],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4179 --strictPort',
    url: 'http://localhost:4179',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
