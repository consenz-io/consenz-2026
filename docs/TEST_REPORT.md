# Test report — Consenz

Date: 25 November 2026
Environment: app sandbox (no browser binary), production target `https://consenz-copy-4ca3772e.base44.app`

## Summary

| Tier | Tests | Passed | Failed | Skipped |
| --- | --- | --- | --- | --- |
| Unit (consensus, content, data access) | 20 | 20 | 0 | 0 |
| HTTP smoke (deployed app) | 10 | 10 | 0 | 0 |
| Production build | 1 | 1 | 0 | 0 |
| Browser E2E (authored, not executable here) | 47 desktop / 27 mobile | — | — | — |

The browser tier could not run in this environment: the Playwright browser
binary is not installed and binary downloads are blocked in the sandbox. The
suite is complete and starts with one command on any machine or CI runner that
can install browsers:

```bash
npx playwright install chromium
E2E_USER_EMAIL=... E2E_USER_PASSWORD=... npm run test:e2e
```

## What was executed

### Unit — 20/20 passed

- **Consensus math (7 tests).** Meter bounded to 0..1, threshold never below the
  entry minimum of 2, threshold capped by the number of people who actually
  voted, history appended correctly on each acceptance.
- **Content helpers (9 tests).** Email-prefix display names become readable
  names, real names untouched, Hebrew/Arabic/English detection, drop position
  between neighbours, change-block diff (identical, replaced word, empty sides),
  translate-all highlighting only when a language differs.
- **Data access rules (4 tests).** Every app entity declares create/read/update/
  delete rules, personal entities have no open writes, an email field on a
  publicly readable entity is restricted at field level.

### HTTP smoke against production — 10/10 passed

| Route | Status | Time | Size |
| --- | --- | --- | --- |
| `/` | 200 | 172 ms | 17.2 KB |
| `/login` | 200 | 432 ms | 17.8 KB |
| `/register` | 200 | 1239 ms | 17.8 KB |
| `/forgot-password` | 200 | 190 ms | 17.9 KB |
| `/LearnMore` | 200 | 164 ms | 17.7 KB |
| `/Groups` | 200 | 178 ms | 17.7 KB |

- Entry bundle `/assets/index-CZpBDupW.js` and stylesheet `/assets/index-ETjdbOTp.css` both return 200.
- An unknown path serves the app shell instead of an error page.
- Pre-rendered SEO snapshot is present inside the app root, so crawlers get real content.

### Production build — passed

`npm run build` completes; only two pre-existing Tailwind warnings
(`duration-[900ms]` is ambiguous) and stale browser-data notices.

## Findings

1. **No Content-Security-Policy header.** `x-content-type-options: nosniff`,
   `x-frame-options: DENY` and `strict-transport-security` are present, but CSP
   is missing. Worth adding at the hosting/domain layer; it is the header that
   limits damage from an injected script.
2. **Page title on the deployed app is `Consenz`** (the platform overrides the
   `index.html` value, which still reads `Base44 APP`). No action needed unless
   the app is ever served without that override.
3. **Ambiguous Tailwind class** `duration-[900ms]` in the source produces a build
   warning and may not apply the intended duration. One-line fix when convenient.

## Coverage of the approved plan

| Planned flow | Status |
| --- | --- |
| Smoke on desktop and mobile | Authored (10 scenarios × 2 profiles); HTTP layer executed |
| Document flows: create, edit, propose, vote, comment, versions, anchors | Authored; deep checks need `E2E_DOCUMENT_ID` |
| Groups: create, join, requests, invitations, members, admin | Authored; deep checks need `E2E_GROUP_ID` |
| Communication: messages, notifications, deep links, unread state, names | Authored |
| Translation and accessibility: he/ar/en, RTL, keyboard, labels, contrast, reduced motion | Authored |
| Performance: load and interaction budgets, list load, request reuse, error recovery | Authored, budgets in `src/tests/e2e/fixtures/thresholds.js` |
| Isolated, cleanable test data | Each run tags its data `E2E-<timestamp>` and lists it in the report |

## Recommended next runs

1. `npx playwright install chromium` once on the dev machine or CI runner.
2. `npm run test:smoke` — expect a green run, then fix anything red.
3. Supply `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` and run `npm run test:e2e` to
   unlock the document, group and communication tiers.
4. Add the suite to the release checklist: `test:unit` + `test:http` on every
   change, full `test:e2e` before publishing.
