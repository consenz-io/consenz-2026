/* global process */
import { defineConfig, devices } from '@playwright/test';

/**
 * Consenz automated test plan.
 *
 * Targets:
 *   - local dev server by default (started automatically)
 *   - any deployed environment when E2E_BASE_URL is set, e.g.
 *     E2E_BASE_URL=https://consenz.net npm run test:e2e
 *
 * Authenticated flows need credentials:
 *   E2E_USER_EMAIL / E2E_USER_PASSWORD
 * Optional fixtures for deep document/group checks:
 *   E2E_DOCUMENT_ID / E2E_GROUP_ID
 *
 * Everything runs from the project root:  npm run test:e2e
 */
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const startLocalServer = !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: '../test-results/artifacts',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../test-results/html', open: 'never' }],
    ['json', { outputFile: '../test-results/results.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    headless: true,
    locale: 'en-US',
    timezoneId: 'Asia/Jerusalem',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
      testMatch: /(smoke|translation-a11y|performance)\.spec\.js/,
    },
  ],
  webServer: startLocalServer
    ? {
        command: 'npm run dev',
        cwd: '..',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});