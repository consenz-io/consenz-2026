import { test, expect } from '@playwright/test';
import { openApp, waitForAppReady, expectNoFatalError } from './fixtures/app';

/**
 * Tier 1 — authentication surfaces.
 * Covers the public half (login, register, password reset) that needs no
 * credentials, plus the failed-login path that every user can reach.
 */
test.describe('Authentication', () => {
  test('login form exposes both fields and the Google option', async ({ page }) => {
    await openApp(page, '/login');
    await waitForAppReady(page);

    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('form button[type="submit"]')).toBeEnabled();
    await expect(page.getByRole('link', { name: /forgot/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
  });

  test('login rejects a wrong password with an inline error', async ({ page }) => {
    await openApp(page, '/login');
    await waitForAppReady(page);

    await page.locator('#email').fill('e2e-not-a-real-user@example.com');
    await page.locator('#password').fill('definitely-wrong-password');
    await page.locator('form button[type="submit"]').click();

    // The page must stay on /login and explain the failure instead of crashing.
    await expect(page.locator('form')).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/login/);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/invalid|incorrect|wrong|failed|error|שגוי|שגיאה/i);
    await expectNoFatalError(page);
  });

  test('register form renders the sign-up fields', async ({ page }) => {
    await openApp(page, '/register');
    await waitForAppReady(page);

    await expect(page.locator('input[type="email"], #email').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expectNoFatalError(page);
  });

  test('forgot-password form asks for an email', async ({ page }) => {
    await openApp(page, '/forgot-password');
    await waitForAppReady(page);

    const emailField = page.locator('input[type="email"], #email').first();
    await expect(emailField).toBeVisible();
    await expect(page.locator('form button[type="submit"]')).toBeVisible();
    await expectNoFatalError(page);
  });

  test('MFA route is reachable', async ({ page }) => {
    const response = await openApp(page, '/mfa');
    expect(response?.status() ?? 200).toBeLessThan(400);
    await waitForAppReady(page);
    await expectNoFatalError(page);
  });
});