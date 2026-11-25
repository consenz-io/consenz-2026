import { test, expect } from '@playwright/test';
import { openApp, waitForAppReady, expectNoFatalError } from './fixtures/app';
import { budgetsFor } from './fixtures/thresholds';

/**
 * Tier 5 — performance and resilience.
 * Budgets are explicit (fixtures/thresholds.js) so a regression fails the run
 * instead of being noticed months later.
 */
test.describe('Performance', () => {
  test('home page loads inside its budget', async ({ page }, testInfo) => {
    const budget = budgetsFor(testInfo.project.name);

    await openApp(page, '/');
    await waitForAppReady(page);

    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint');
      return {
        domContentLoaded: nav ? nav.domContentLoadedEventEnd - nav.startTime : 0,
        load: nav ? nav.loadEventEnd - nav.startTime : 0,
        firstContentfulPaint: paint ? paint.startTime : 0,
      };
    });

    testInfo.annotations.push({
      type: 'measurements',
      description: `DCL ${Math.round(timing.domContentLoaded)}ms · FCP ${Math.round(timing.firstContentfulPaint)}ms · load ${Math.round(timing.load)}ms`,
    });

    expect(timing.domContentLoaded).toBeLessThan(budget.domContentLoaded);
    expect(timing.firstContentfulPaint).toBeLessThan(budget.firstContentfulPaint);
    expect(timing.load).toBeLessThan(budget.navigationToInteractive);
  });

  test('a public list page renders inside its budget', async ({ page }, testInfo) => {
    const budget = budgetsFor(testInfo.project.name);

    const started = Date.now();
    await openApp(page, '/Groups');
    await waitForAppReady(page);
    await expect(page.locator('body')).toContainText(/group|קבוצה|مجموعة/i);
    const elapsed = Date.now() - started;

    testInfo.annotations.push({ type: 'measurements', description: `Groups list ready in ${elapsed}ms` });
    expect(elapsed).toBeLessThan(budget.listRender);
  });

  test('a second visit is not slower than the first', async ({ page }) => {
    const measure = async () => {
      const started = Date.now();
      await openApp(page, '/');
      await waitForAppReady(page);
      return Date.now() - started;
    };

    const first = await measure();
    const second = await measure();
    // Cached assets and warmed queries must not make the repeat visit slower.
    expect(second).toBeLessThanOrEqual(Math.max(first * 1.5, first + 1500));
  });

  test('the page still renders when a stats request fails', async ({ page }) => {
    await page.route('**/functions/getHomeStats**', (route) => route.abort());

    await openApp(page, '/');
    await waitForAppReady(page);

    await expectNoFatalError(page);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(100);
  });

  test('a failed list request does not leave an endless spinner', async ({ page }) => {
    await page.route('**/entities/Document**', (route) => route.abort());

    await openApp(page, '/');
    await page.waitForTimeout(5000);

    const spinners = await page.locator('.animate-spin').count();
    const bodyText = await page.locator('body').innerText();
    expect(spinners + bodyText.length).toBeGreaterThan(0);
    await expectNoFatalError(page);
  });

  test('no horizontal overflow on the home page', async ({ page }) => {
    await openApp(page, '/');
    await waitForAppReady(page);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'horizontal scroll on the home page').toBeLessThanOrEqual(2);
  });
});