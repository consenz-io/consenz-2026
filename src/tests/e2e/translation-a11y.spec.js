import { test, expect } from '@playwright/test';
import {
  openApp,
  waitForAppReady,
  expectNoFatalError,
  setLanguage,
  watchPageErrors,
} from './fixtures/app';

/**
 * Tier 4 — translation and accessibility. Public, runs on desktop and mobile.
 * Every check here is something a keyboard user or a screen reader depends on.
 */
test.describe('Language and RTL', () => {
  test('Hebrew sets the page to RTL', async ({ page }) => {
    await setLanguage(page, 'he');
    await openApp(page, '/');
    await waitForAppReady(page);

    const dir = await page.evaluate(() => document.documentElement.getAttribute('dir') || getComputedStyle(document.body).direction);
    expect(dir).toBe('rtl');
    await expectNoFatalError(page);
  });

  test('Arabic sets the page to RTL', async ({ page }) => {
    await setLanguage(page, 'ar');
    await openApp(page, '/');
    await waitForAppReady(page);

    const dir = await page.evaluate(() => document.documentElement.getAttribute('dir') || getComputedStyle(document.body).direction);
    expect(dir).toBe('rtl');
    await expectNoFatalError(page);
  });

  test('English stays LTR and is the default', async ({ page }) => {
    await openApp(page, '/');
    await waitForAppReady(page);

    const dir = await page.evaluate(() => document.documentElement.getAttribute('dir') || getComputedStyle(document.body).direction);
    expect(dir).toBe('ltr');
  });

  test('the chosen language survives a reload', async ({ page }) => {
    await setLanguage(page, 'he');
    await openApp(page, '/');
    await waitForAppReady(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    const stored = await page.evaluate(() => localStorage.getItem('consenz_language'));
    expect(stored).toBe('he');
    const dir = await page.evaluate(() => document.documentElement.getAttribute('dir') || getComputedStyle(document.body).direction);
    expect(dir).toBe('rtl');
  });

  test('the language selector switches the UI language', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'The selector lives in the desktop sidebar');

    await openApp(page, '/');
    await waitForAppReady(page);

    const selector = page.locator('#language-selector');
    await expect(selector).toBeVisible();
    await selector.selectOption('he');
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.getAttribute('dir') || getComputedStyle(document.body).direction))
      .toBe('rtl');
  });
});

test.describe('Accessibility', () => {
  test('a skip-to-content link is the first keyboard stop', async ({ page }) => {
    await openApp(page, '/');
    await waitForAppReady(page);

    await page.keyboard.press('Tab');
    const focusedText = await page.evaluate(() => (document.activeElement?.textContent || '').trim());
    expect(focusedText).toMatch(/skip|דלג|تخطي/i);
  });

  test('every image carries an alt attribute', async ({ page }) => {
    await openApp(page, '/');
    await waitForAppReady(page);

    const missing = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img'))
        .filter((img) => !img.hasAttribute('alt'))
        .map((img) => img.getAttribute('src') || '')
    );
    expect(missing, 'images without alt text').toEqual([]);
  });

  test('every button has an accessible name', async ({ page }) => {
    await openApp(page, '/');
    await waitForAppReady(page);

    const unnamed = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button'))
        .filter((btn) => {
          const text = (btn.textContent || '').trim();
          return !text && !btn.getAttribute('aria-label') && !btn.getAttribute('title') && !btn.querySelector('img[alt]:not([alt=""])');
        })
        .map((btn) => btn.className.toString().slice(0, 60))
    );
    expect(unnamed, 'buttons without an accessible name').toEqual([]);
  });

  test('form fields on the login page have labels', async ({ page }) => {
    await openApp(page, '/login');
    await waitForAppReady(page);

    const unlabeled = await page.evaluate(() => {
      const fields = Array.from(document.querySelectorAll('input:not([type="hidden"])'));
      return fields
        .filter((input) => {
          const id = input.getAttribute('id');
          const hasLabel = id ? !!document.querySelector(`label[for="${id}"]`) : false;
          return !hasLabel && !input.getAttribute('aria-label') && !input.getAttribute('placeholder');
        })
        .map((input) => input.getAttribute('name') || input.type);
    });
    expect(unlabeled, 'form fields without a label').toEqual([]);
  });

  test('reduced-motion preference is respected without breaking the page', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { pageErrors } = watchPageErrors(page);

    await openApp(page, '/');
    await waitForAppReady(page);

    await expectNoFatalError(page);
    expect(pageErrors).toEqual([]);
  });

  test('touch targets on mobile are large enough to hit', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('mobile'), 'Touch target check runs on the mobile profile');

    await openApp(page, '/');
    await waitForAppReady(page);

    const tooSmall = await page.evaluate(() =>
      Array.from(document.querySelectorAll('header button, header a'))
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.height < 36;
        })
        .map((el) => `${el.tagName}:${(el.textContent || '').trim().slice(0, 20)}`)
    );
    expect(tooSmall, 'interactive elements smaller than 36px').toEqual([]);
  });
});