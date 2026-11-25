/* global process */
import { expect } from '@playwright/test';

/** Unique tag per run, so test data is recognizable and safe to clean up. */
export const RUN_TAG = `E2E-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}`;

/** Console noise that is never a product bug. */
const IGNORED_CONSOLE = [
  /ResizeObserver loop/i,
  /Download the React DevTools/i,
  /favicon/i,
  /net::ERR_ABORTED/i,
  /Failed to load resource: the server responded with a status of 40[13]/i,
];

/** Text that only appears when the app actually crashed. */
export const FATAL_TEXT =
  /Something went wrong|Unexpected Application Error|Minified React error|Cannot read propert|is not a function/i;

/**
 * Collects uncaught page errors (real bugs) and console errors (reported, but
 * not fatal on their own — a 401 for an anonymous visitor is expected).
 */
export function watchPageErrors(page) {
  const pageErrors = [];
  const consoleErrors = [];

  page.on('pageerror', (err) => {
    const message = err?.message || String(err);
    if (!IGNORED_CONSOLE.some((rx) => rx.test(message))) pageErrors.push(message);
  });

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (!IGNORED_CONSOLE.some((rx) => rx.test(text))) consoleErrors.push(text);
  });

  return { pageErrors, consoleErrors };
}

/** Opens a route and waits for the React root to exist. */
export async function openApp(page, path = '/') {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#root', { state: 'attached' });
  return response;
}

/** Waits until the app shell finished its first data round-trip. */
export async function waitForAppReady(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await expect(page.locator('#root')).toBeVisible();
}

/** Fails when crash text is on screen. */
export async function expectNoFatalError(page) {
  const bodyText = await page.locator('body').innerText().catch(() => '');
  expect(FATAL_TEXT.test(bodyText), `Crash text rendered on the page: ${bodyText.slice(0, 300)}`).toBeFalsy();
}

/** Credentials are required for every authenticated flow. */
export function hasAuthCredentials() {
  return Boolean(process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD);
}

/** Signs in through the real login form. */
export async function signIn(page) {
  await openApp(page, '/login');
  await page.locator('#email').fill(process.env.E2E_USER_EMAIL);
  await page.locator('#password').fill(process.env.E2E_USER_PASSWORD);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
  await waitForAppReady(page);
}

/** Pins the UI language before the app boots. */
export async function setLanguage(page, language) {
  await page.addInitScript((lang) => {
    localStorage.setItem('consenz_language', lang);
    localStorage.setItem('consenz_language_selected', 'true');
  }, language);
}

/** Notes created data in the report so it can be cleaned up deliberately. */
export function annotateCreated(testInfo, what, id) {
  testInfo.annotations.push({
    type: 'created-data',
    description: `${what} created during this run${id ? ` (id: ${id})` : ''} — remove it from Document Admin / group management when the run ends.`,
  });
}