# Consenz — Automated Test Suite

Five tiers, ordered by risk. Fast tiers run first so a broken build is caught in
seconds; the full regression tier runs before a release.

| Tier | What it protects | Runs in a browser | Command |
| --- | --- | --- | --- |
| 1. Unit | Consensus math, content helpers, data-access rules | no | `npm run test:unit` |
| 2. HTTP smoke | The deployed app serves its shell, bundle and public routes | no | `npm run test:http` |
| 3. Browser smoke | Public routes render, no crash, login form works | yes | `npm run test:smoke` |
| 4. Business flows | Documents, groups, messages, notifications, profile | yes | `npm run test:e2e` |
| 5. Accessibility & performance | RTL, labels, keyboard, touch targets, budgets | yes | `npm run test:a11y` / `npm run test:e2e` |

## Running

```bash
npm run test:unit          # no dependencies, ~1s
npm run test:http          # against the deployed app
npm run test:smoke         # desktop + mobile browser smoke
npm run test:e2e           # everything, both profiles
npm run test:mobile        # mobile profile only
npm run test:a11y          # translation + accessibility
npm run test:report        # open the HTML report
```

Environment variables:

| Variable | Purpose |
| --- | --- |
| `E2E_BASE_URL` | Target environment. Default `http://localhost:5173` (dev server started automatically). Use `https://consenz.net` for production checks. |
| `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` | A real account. Without them every authenticated tier is skipped, not failed. |
| `E2E_DOCUMENT_ID` | A document with open proposals, for the deep document checks. |
| `E2E_GROUP_ID` | A group with members and documents, for the group checks. |

## Structure

```
src/playwright.config.js        desktop + mobile projects, traces/screenshots on failure
src/tests/e2e/
  smoke.spec.js                 public routes, shell, brand, unknown route
  auth.spec.js                  login, wrong password, register, reset, MFA route
  documents.spec.js             create document, open document, versions, votes
  groups.spec.js                group list, create group, members, admin gating
  communications.spec.js        messages, notification bell, profile, deep link
  translation-a11y.spec.js      he/ar RTL, language persistence, labels, keyboard, touch
  performance.spec.js           load budgets, list budget, request failure resilience
  fixtures/app.js               sign-in, console/page-error collection, run tag
  fixtures/thresholds.js        explicit performance budgets
tests/unit/                     consensus math, content helpers, entity access rules
tests/http/                     deployed-environment smoke, no browser needed
```

## Test data

Every run creates data tagged with `E2E-<timestamp>` (document or group name), so
it is recognizable in the admin screens. Created records are listed in the test
report under the `created-data` annotation. Data creation is limited to one
document and one group per run; everything else reads existing data supplied
through `E2E_DOCUMENT_ID` / `E2E_GROUP_ID`.

## Not automatable

- Email delivery and rendering in real inboxes (the send is triggered, delivery is not observable).
- Google sign-in, MFA codes and push notifications (they need a real second factor).
- PDF extraction quality (needs a human judgement on the extracted text).
- Visual design quality, spacing and animation feel.
