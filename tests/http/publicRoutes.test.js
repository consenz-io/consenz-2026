import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Tier 1 — HTTP smoke against a deployed environment.
 *
 * These run without a browser, so they work in any environment (CI, a laptop,
 * the platform sandbox). They answer the first question of every release: does
 * the app serve its shell, its entry bundle and its public routes?
 *
 *   npm run test:http
 *   E2E_BASE_URL=https://consenz.net npm run test:http
 */
const BASE_URL = (process.env.E2E_BASE_URL || 'https://consenz-copy-4ca3772e.base44.app').replace(/\/$/, '');

const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password', '/LearnMore', '/Groups'];

async function get(pathname) {
  const started = Date.now();
  const response = await fetch(`${BASE_URL}${pathname}`, { redirect: 'follow' });
  const html = await response.text();
  return { response, html, elapsed: Date.now() - started };
}

test('the deployed app is reachable', async () => {
  const { response } = await get('/');
  assert.equal(response.status, 200, `GET ${BASE_URL}/ returned ${response.status}`);
  assert.match(response.headers.get('content-type') || '', /text\/html/);
});

for (const route of PUBLIC_ROUTES) {
  test(`serves the app shell on ${route}`, async (t) => {
    const { response, html, elapsed } = await get(route);

    assert.equal(response.status, 200, `${route} returned ${response.status}`);
    assert.match(html, /id="root"/, `${route} is missing the React root`);
    assert.match(html, /<script[^>]*type="module"/, `${route} is missing the module entry script`);
    assert.doesNotMatch(html, /Internal Server Error|Cannot GET/i, `${route} leaked a server error`);

    t.diagnostic(`${route} · ${response.status} · ${elapsed}ms · ${html.length} bytes`);
    assert.ok(elapsed < 5000, `${route} took ${elapsed}ms`);
  });
}

test('the entry bundle and referenced assets load', async (t) => {
  const { html } = await get('/');
  const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((url) => url.startsWith('/') && !url.startsWith('//'));

  const unique = [...new Set(urls)].filter((url) => /\.(js|css|json|png|svg|ico)$/.test(url));
  assert.ok(unique.length > 0, 'no local assets referenced in the served HTML');

  for (const url of unique) {
    const response = await fetch(`${BASE_URL}${url}`);
    t.diagnostic(`${url} · ${response.status}`);
    assert.ok(response.ok, `${url} returned ${response.status}`);
  }
});

test('an unknown path still serves the app instead of an error page', async () => {
  const { response, html } = await get('/this-route-does-not-exist');
  assert.equal(response.status, 200);
  assert.match(html, /id="root"/);
});

test('security headers are present on the served app', async (t) => {
  const { response } = await get('/');
  const headers = {
    'x-content-type-options': response.headers.get('x-content-type-options'),
    'x-frame-options': response.headers.get('x-frame-options'),
    'content-security-policy': response.headers.get('content-security-policy'),
    'strict-transport-security': response.headers.get('strict-transport-security'),
  };

  for (const [name, value] of Object.entries(headers)) {
    t.diagnostic(`${name}: ${value ?? 'missing'}`);
  }

  assert.equal(headers['x-content-type-options'], 'nosniff');
});