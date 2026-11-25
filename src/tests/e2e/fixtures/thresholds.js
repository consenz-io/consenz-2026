/**
 * Explicit performance budgets. A test fails when a measurement crosses its
 * budget, so regressions are visible instead of being a feeling.
 *
 * All values are milliseconds and measured on the app's own code — network
 * latency of a deployed environment is included, so budgets are generous but
 * still catch real regressions (a doubled page weight, a blocking call).
 */
export const BUDGETS = {
  desktop: {
    domContentLoaded: 4000,
    firstContentfulPaint: 3000,
    navigationToInteractive: 8000,
    listRender: 3000,
  },
  mobile: {
    domContentLoaded: 8000,
    firstContentfulPaint: 6000,
    navigationToInteractive: 15000,
    listRender: 5000,
  },
};

/** Picks the budget set for the running project. */
export function budgetsFor(projectName) {
  return projectName.includes('mobile') ? BUDGETS.mobile : BUDGETS.desktop;
}