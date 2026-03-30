/**
 * document.spec.js
 *
 * Smoke tests for DocumentView and DocumentCleanView.
 * Verifies that document pages load correctly given a document ID.
 *
 * These tests run against the real dev server but do NOT mutate data.
 * They guard against regressions in routing, data-fetching, and rendering.
 */

import { test, expect } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

// ─── DocumentView — no ID (edge case) ─────────────────────────────────────────

test.describe('DocumentView — missing document ID', () => {
  test('renders without crashing when no id param is given', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/DocumentView');
    await page.waitForLoadState('networkidle');

    expect(errors, `JS errors: ${errors.join(', ')}`).toHaveLength(0);
  });

  test('shows "document not found" message or redirect — not blank', async ({ page }) => {
    await page.goto('/DocumentView');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(5);
  });
});

// ─── DocumentView — with a fake ID ────────────────────────────────────────────

test.describe('DocumentView — with unknown document ID', () => {
  test('renders without JS crash', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/DocumentView?id=nonexistent-doc-id-smoke-test');
    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
  });

  test('shows "not found" fallback — not blank screen', async ({ page }) => {
    await page.goto('/DocumentView?id=nonexistent-doc-id-smoke-test');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(5);
  });
});

// ─── DocumentCleanView — no ID ────────────────────────────────────────────────

test.describe('DocumentCleanView — no ID', () => {
  test('renders without JS crash', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/DocumentCleanView');
    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
  });
});

// ─── GroupView — no ID ────────────────────────────────────────────────────────

test.describe('GroupView — no ID', () => {
  test('renders without JS crash', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/GroupView');
    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
  });

  test('shows something (not blank)', async ({ page }) => {
    await page.goto('/GroupView');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(5);
  });
});

// ─── Groups list page ─────────────────────────────────────────────────────────

test.describe('Groups list page', () => {
  test('loads without JS crash', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/Groups');
    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
  });

  test('renders main content', async ({ page }) => {
    await page.goto('/Groups');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('main')).toBeVisible();
  });
});

// ─── Profile page ─────────────────────────────────────────────────────────────

test.describe('Profile page', () => {
  test('loads without JS crash', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/Profile');
    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
  });
});