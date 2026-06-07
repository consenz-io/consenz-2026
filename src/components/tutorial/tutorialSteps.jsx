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

/** @type {Array<import('./tutorialSteps').TutorialStep>} */
export const TUTORIAL_STEPS = [
  // Steps will be populated in subsequent prompts
];