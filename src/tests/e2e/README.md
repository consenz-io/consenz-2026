# E2E Smoke Tests — Layer 3

Fast regression guards that answer one question: **"Does the page load without crashing?"**

## Files

| File | Covers |
|---|---|
| `smoke.spec.js` | Home page, sidebar navigation, 404 route |
| `document.spec.js` | DocumentView, DocumentCleanView, GroupView, Groups, Profile |
| `voting.spec.js` | Voting UI, sign-in gating, navigation flows, ConsensusView, MyDocuments |

## How to run

```bash
# Run all smoke tests (headless)
npx playwright test

# Run with browser visible
npx playwright test --headed

# Run only smoke tests
npx playwright test smoke.spec.js

# Show HTML report after run
npx playwright show-report
```

## Requirements

- Dev server must be running on `http://localhost:5173` (or `npx playwright test` starts it automatically via `webServer` config)
- Install Playwright browsers once: `npx playwright install chromium`

## What counts as a failure?

1. **JS crash** — any `window.onerror` / uncaught exception
2. **Blank screen** — body text shorter than 5 characters
3. **Infinite spinner** — loading state not resolved within 10s
4. **Navigation crash** — clicking a link throws an error

## What these tests do NOT check

- Business logic (covered by `voting.flow.test.js` + `queryCache.test.js`)
- Actual vote casting (requires auth)
- Real document data (tests use fake IDs and gracefully skip if no data)