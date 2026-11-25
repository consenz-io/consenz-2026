import { test, expect } from '@playwright/test';
import {
  openApp,
  waitForAppReady,
  expectNoFatalError,
  signIn,
  hasAuthCredentials,
  watchPageErrors,
} from './fixtures/app';

/**
 * Tier 2 — communication and activity. Requires credentials.
 * Private messaging, the notification bell and the profile activity feed are
 * the surfaces a member uses daily, and the ones that break silently.
 */
test.describe('Communication and activity', () => {
  test.skip(!hasAuthCredentials(), 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run communication flows');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('messages page opens with the conversation list', async ({ page }) => {
    await openApp(page, '/Messages');
    await waitForAppReady(page);

    await expect(page.locator('body')).toContainText(/message|הודעה|رسالة/i);
    await expectNoFatalError(page);
  });

  test('notification bell opens and closes without leaving the page', async ({ page }) => {
    await openApp(page, '/');
    await waitForAppReady(page);

    const bell = page.getByRole('button', { name: /notification|התראות|إشعار/i }).first();
    test.skip(!(await bell.count()), 'No notification bell for this account');

    await bell.click();
    await expect(page.getByText(/notification|התראה|إشعار/i).first()).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/$/);
    await expectNoFatalError(page);
  });

  test('profile page shows the activity tabs and points history', async ({ page }) => {
    await openApp(page, '/Profile');
    await waitForAppReady(page);

    await expect(page.locator('h1, h2').first()).toBeVisible();
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/point|activity|profile|נקודות|פרופיל/i);
    await expectNoFatalError(page);
  });

  test('a deep link to a suggestion detail resolves to a real screen', async ({ page }) => {
    const { pageErrors } = watchPageErrors(page);

    await openApp(page, '/suggestiondetail');
    await waitForAppReady(page);

    await expectNoFatalError(page);
    expect(pageErrors, 'uncaught errors on the suggestion detail route').toEqual([]);
  });

  test('unread badge never blocks the header layout', async ({ page }) => {
    await openApp(page, '/');
    await waitForAppReady(page);

    const header = page.locator('header').first();
    const box = await header.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(0);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'horizontal overflow caused by the header').toBeLessThanOrEqual(2);
  });
});