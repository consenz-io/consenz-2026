/**
 * smoke.spec.js
 *
 * Layer 3 — Smoke Tests
 * "Does the page load without crashing?"
 *
 * These are fast regression guards. They do NOT test business logic —
 * they verify that a page renders its skeleton without a blank screen,
 * JS crash, or uncaught error. Run after every deploy.
 */

import { test, expect } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Collect JS errors thrown during page load.
 * Any uncaught error is a hard failure.
 */
function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

// ─── Home page ────────────────────────────────────────────────────────────────

test.describe('Home page', () => {
  test('loads without JS crash', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(errors, `JS errors on Home: ${errors.join(', ')}`).toHaveLength(0);
  });

  test('renders main content area', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The main landmark must exist (set in Layout)
    await expect(page.locator('main')).toBeVisible();
  });

  test('shows the Consenz brand name in sidebar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Consenz')).toBeVisible();
  });

  test('page title is set (not blank)', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('does not show a blank white screen', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // If the page crashed or shows nothing, body would be empty
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(10);
  });
});

// ─── Sidebar navigation ───────────────────────────────────────────────────────

test.describe('Sidebar navigation', () => {
  test('sidebar is present on Home', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[role="navigation"]')).toBeVisible();
  });

  test('clicking My Documents does not crash', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find and click the My Documents link
    const link = page.getByRole('link', { name: /my documents|המסמכים שלי|وثائقي/i });
    if (await link.count() > 0) {
      await link.first().click();
      await page.waitForLoadState('networkidle');
    }

    expect(errors).toHaveLength(0);
  });

  test('clicking Groups does not crash', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const link = page.getByRole('link', { name: /groups|קבוצות|مجموعات/i });
    if (await link.count() > 0) {
      await link.first().click();
      await page.waitForLoadState('networkidle');
    }

    expect(errors).toHaveLength(0);
  });
});

// ─── 404 page ─────────────────────────────────────────────────────────────────

test.describe('404 / unknown routes', () => {
  test('unknown route renders without JS crash', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/this-route-does-not-exist-xyz');
    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
  });

  test('unknown route renders something (not blank)', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-xyz');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(5);
  });
});