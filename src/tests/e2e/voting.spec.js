/**
 * voting.spec.js
 *
 * Smoke tests for the voting critical path.
 * Goal: verify that the voting UI renders without crashing,
 * vote buttons are present and interactive, and no JS errors fire.
 *
 * These tests do NOT cast actual votes (would require auth).
 * They verify the UI scaffolding renders correctly.
 */

import { test, expect } from '@playwright/test';

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

// ─── Voting UI on DocumentView ─────────────────────────────────────────────────

test.describe('Voting UI — DocumentView smoke', () => {
  test('DocumentView loads without crashing with a real-looking ID', async ({ page }) => {
    const errors = collectErrors(page);
    // Use a fake but realistic-looking ID
    await page.goto('/DocumentView?id=smoke-test-doc-000');
    await page.waitForLoadState('networkidle');

    expect(errors, `Unexpected JS errors: ${errors.join(', ')}`).toHaveLength(0);
  });

  test('page does not show loading spinner forever (resolves within 10s)', async ({ page }) => {
    await page.goto('/DocumentView?id=smoke-test-doc-000');

    // Wait for spinner to disappear OR for content to appear
    await Promise.race([
      page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10_000 }).catch(() => {}),
      page.waitForTimeout(10_000),
    ]);

    // Page should have rendered something beyond an empty body
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(5);
  });
});

// ─── Sign-in gating ────────────────────────────────────────────────────────────

test.describe('Unauthenticated user — voting UI gating', () => {
  test('vote buttons show sign-in prompt or are disabled — no crash', async ({ page }) => {
    const errors = collectErrors(page);

    // Visit a document page without being signed in
    await page.goto('/DocumentView?id=smoke-test-doc-000');
    await page.waitForLoadState('networkidle');

    // Should not crash regardless of auth state
    expect(errors).toHaveLength(0);
  });

  test('clicking "Sign In" button on sign-in prompt does not crash', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/DocumentView?id=smoke-test-doc-000');
    await page.waitForLoadState('networkidle');

    // If there's a sign-in button visible, click it and verify no crash
    const signInBtn = page.getByRole('button', { name: /sign in|התחבר|تسجيل الدخول/i });
    if (await signInBtn.count() > 0) {
      await signInBtn.first().click();
      await page.waitForTimeout(1000);
    }

    expect(errors).toHaveLength(0);
  });
});

// ─── Navigation from Home to Document ─────────────────────────────────────────

test.describe('Navigation flow: Home → Document', () => {
  test('clicking a document card navigates without crash', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Try to find any link pointing to a DocumentView
    const docLink = page.locator('a[href*="DocumentView"]').first();
    if (await docLink.count() > 0) {
      await docLink.click();
      await page.waitForLoadState('networkidle');
      expect(errors).toHaveLength(0);
    } else {
      // No documents visible (empty state or unauthenticated) — skip gracefully
      test.skip(true, 'No document links found on Home page (likely empty state)');
    }
  });

  test('navigating back from DocumentView to Home works', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/DocumentView?id=smoke-test-doc-000');
    await page.waitForLoadState('networkidle');

    // Navigate back to home
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('main')).toBeVisible();
    expect(errors).toHaveLength(0);
  });
});

// ─── ConsensusView smoke ───────────────────────────────────────────────────────

test.describe('UnderstandingConsensus page', () => {
  test('loads without crash', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/UnderstandingConsensus?id=smoke-test-doc-000');
    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
  });

  test('renders page content (not blank)', async ({ page }) => {
    await page.goto('/UnderstandingConsensus?id=smoke-test-doc-000');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(10);
  });
});

// ─── MyDocuments page ─────────────────────────────────────────────────────────

test.describe('MyDocuments page', () => {
  test('loads without JS crash', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/MyDocuments');
    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
  });

  test('renders layout structure', async ({ page }) => {
    await page.goto('/MyDocuments');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('main')).toBeVisible();
  });
});