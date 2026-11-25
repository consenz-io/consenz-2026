import { test, expect } from '@playwright/test';
import {
  openApp,
  waitForAppReady,
  expectNoFatalError,
  watchPageErrors,
} from './fixtures/app';

/**
 * Tier 1 — smoke. Fast, public, no credentials.
 * Answers one question: does the app boot and do its public screens render?
 */
const PUBLIC_ROUTES = [
  { path: '/', name: 'Home' },
  { path: '/LearnMore', name: 'Learn more' },
  { path: '/UnderstandingConsensus', name: 'Understanding consensus' },
  { path: '/Groups', name: 'Groups' },
  { path: '/login', name: 'Login' },
  { path: '/register', name: 'Register' },
  { path: '/forgot-password', name: 'Forgot password' },
];

for (const route of PUBLIC_ROUTES) {
  test(`public route renders: ${route.name}`, async ({ page }, testInfo) => {
    const { pageErrors, consoleErrors } = watchPageErrors(page);

    const response = await openApp(page, route.path);
    expect(response?.status() ?? 200, `HTTP status for ${route.path}`).toBeLessThan(400);

    await waitForAppReady(page);
    await expect(page.locator('#root')).not.toBeEmpty();
    await expectNoFatalError(page);

    // Console errors are reported as an annotation: anonymous visitors legitimately
    // hit 401s. Only uncaught JS errors fail the test.
    if (consoleErrors.length) {
      testInfo.annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });
    }
    expect(pageErrors, `uncaught errors on ${route.path}`).toEqual([]);
  });
}

test('app shell shows the Consenz brand', async ({ page }) => {
  await openApp(page, '/');
  await waitForAppReady(page);
  await expect(page.getByText('Consenz').first()).toBeVisible();
});

test('unknown route renders the not-found screen, not the home page', async ({ page }) => {
  await openApp(page, '/this-route-does-not-exist');
  await waitForAppReady(page);
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toMatch(/Community Constitution/i);
  await expectNoFatalError(page);
});

test('home page reaches the document and group sections', async ({ page }) => {
  await openApp(page, '/');
  await waitForAppReady(page);
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.length).toBeGreaterThan(200);
  expect(bodyText).toMatch(/document|group/i);
});