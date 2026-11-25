/* global process */
import { test, expect } from '@playwright/test';
import {
  openApp,
  waitForAppReady,
  expectNoFatalError,
  signIn,
  hasAuthCredentials,
  RUN_TAG,
  annotateCreated,
} from './fixtures/app';

/**
 * Tier 2/3 — groups and membership. Requires credentials.
 * Admin-only screens are checked only when the signed-in account is an admin;
 * otherwise the test verifies the screen is not reachable, which is the
 * security-relevant behaviour.
 */
test.describe('Groups', () => {
  test.skip(!hasAuthCredentials(), 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run group flows');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('my groups page renders', async ({ page }) => {
    await openApp(page, '/Groups');
    await waitForAppReady(page);
    await expect(page.locator('h1').first()).toBeVisible();
    await expectNoFatalError(page);
  });

  test('create-group form requires a name before submitting', async ({ page }) => {
    await openApp(page, '/CreateGroup');
    await waitForAppReady(page);

    const submit = page.locator('form button[type="submit"], button[type="submit"]').first();
    await expect(submit).toBeVisible();
    await expect(submit).toBeDisabled();
  });

  test('a new group can be created and opened', async ({ page }, testInfo) => {
    const name = `${RUN_TAG} group`;

    await openApp(page, '/CreateGroup');
    await waitForAppReady(page);

    const nameField = page.locator('#name, input[name="name"], form input[type="text"]').first();
    await nameField.fill(name);

    const submit = page.locator('form button[type="submit"], button[type="submit"]').first();
    await submit.click();

    await page.waitForURL(/GroupView\?id=/, { timeout: 30_000 });
    await waitForAppReady(page);
    const groupId = new URL(page.url()).searchParams.get('id');
    annotateCreated(testInfo, `Group "${name}"`, groupId);

    await expect(page.getByText(name, { exact: false }).first()).toBeVisible();
    await expectNoFatalError(page);
  });

  test('group page shows members and documents for a known group', async ({ page }) => {
    const groupId = process.env.E2E_GROUP_ID;
    test.skip(!groupId, 'Set E2E_GROUP_ID to check a populated group');

    await openApp(page, `/GroupView?id=${groupId}`);
    await waitForAppReady(page);
    await expectNoFatalError(page);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/member|document|חבר|מסמך/i);
  });

  test('admin-only screens are not offered to non-admin accounts', async ({ page }) => {
    await openApp(page, '/');
    await waitForAppReady(page);

    const adminLink = page.getByRole('link', { name: /translation suggestions|הצעות תרגום/i });
    const isAdmin = (await adminLink.count()) > 0;

    if (!isAdmin) {
      await openApp(page, '/TranslationReview');
      await waitForAppReady(page);
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toMatch(/pending translation|הצעות ממתינות/i);
    }
  });
});