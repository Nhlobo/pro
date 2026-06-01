import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the TUS resumable-upload E2E.
 *
 * The webServer block boots a hermetic TUS server + static test page on
 * localhost:4321. No external services are contacted; the test asserts the
 * resume guarantee by inspecting the server's request log.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node e2e/tus-server/server.mjs',
    url: 'http://localhost:4321/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
