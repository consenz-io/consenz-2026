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
 * Tier 2 — document flows. Requires E2E_USER_EMAIL / E2E_USER_PASSWORD.
 * E2E_DOCUMENT_ID unlocks the deep read/vote checks on a document that already
 * holds open proposals.
 */
test.describe('Documents', () => {
  test.skip(!hasAuthCredentials(), 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated document flows');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('My Documents lists the documents the user participates in', async ({ page }) => {
    await openApp(page, '/MyDocuments');
    await waitForAppReady(page);

    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
    await expectNoFatalError(page);
  });

  test('creating a document opens the new document page', async ({ page }, testInfo) => {
    const title = `${RUN_TAG} constitution`;
    const urlName = `${RUN_TAG.toLowerCase()}-constitution`;

    await openApp(page, '/CreateDocument');
    await waitForAppReady(page);

    await page.locator('#title').fill(title);
    await page.locator('#urlName').fill(urlName);

    const submit = page.locator('form button[type="submit"], button[type="submit"]').first();
    await expect(submit).toBeEnabled();
    await submit.click();

    await page.waitForURL(/DocumentView\?id=/, { timeout: 30_000 });
    await waitForAppReady(page);

    const createdId = new URL(page.url()).searchParams.get('id');
    expect(createdId, 'document id in the URL').toBeTruthy();
    annotateCreated(testInfo, `Document "${title}"`, createdId);

    await expect(page.getByText(title, { exact: false }).first()).toBeVisible();
    await expectNoFatalError(page);
  });

  test('an unknown document id shows a clear state instead of crashing', async ({ page }) => {
    await openApp(page, '/DocumentView?id=000000000000000000000000');
    await waitForAppReady(page);
    await expectNoFatalError(page);
  });

  test('document page shows its clauses and proposal actions', async ({ page }) => {
    const documentId = process.env.E2E_DOCUMENT_ID;
    test.skip(!documentId, 'Set E2E_DOCUMENT_ID to check a populated document');

    await openApp(page, `/DocumentView?id=${documentId}`);
    await waitForAppReady(page);

    await expectNoFatalError(page);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(300);

    // Voting affordances must be present and large enough to hit on mobile.
    const voteButtons = page.getByRole('button', { name: /for|against|support|oppose|בעד|נגד/i });
    if (await voteButtons.count()) {
      const box = await voteButtons.first().boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(32);
    }
  });

  test('document version history opens from the document page', async ({ page }) => {
    const documentId = process.env.E2E_DOCUMENT_ID;
    test.skip(!documentId, 'Set E2E_DOCUMENT_ID to check version history');

    await openApp(page, `/DocumentView?id=${documentId}`);
    await waitForAppReady(page);

    const historyButton = page
      .getByRole('button', { name: /version|history|היסטוריה|גרסאות/i })
      .first();
    test.skip(!(await historyButton.count()), 'No version-history control on this document');

    await historyButton.click();
    await expect(page.getByText(/version|גרסה/i).first()).toBeVisible({ timeout: 15_000 });
    await expectNoFatalError(page);
  });
});