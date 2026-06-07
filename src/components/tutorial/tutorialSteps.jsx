/**
 * TutorialStep interface:
 * {
 *   id: string,
 *   type: 'explain' | 'practice',
 *   targetSelector: string,
 *   tooltipPosition: 'top' | 'bottom' | 'left' | 'right' | 'auto',
 *   heading: string,
 *   body: string,
 *   successMessage?: string,
 *   completionEvent?: string
 * }
 */

/**
 * Pre-tutorial step shown on the home page.
 * No progress dots, no scrim — spotlight only on .documents-list.
 */
export const HOME_INTRO_STEP = {
  id: 'home-intro',
  type: 'practice',
  targetSelector: '.documents-list',
  tooltipPosition: 'bottom',
  heading: 'איך מתחילים?',
  body: 'כדי להתחיל, בחר מסמך מהרשימה כאן למטה — הסיור המלא יחכה לך בפנים.',
  successMessage: 'מעולה, בואו נתחיל',
  completionEvent: 'document:entered',
};

/** @type {Array} */
export const TUTORIAL_STEPS = [
  // Document-page steps will be populated in subsequent prompts
];