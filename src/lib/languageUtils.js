/**
 * Centralized language utilities — import from here instead of redefining per-component.
 */

export const LANGUAGE_NAMES = {
  en: "English",
  he: "עברית",
  ar: "العربية",
};

export const LANGUAGE_PROMPTS = {
  en: "English",
  he: "Hebrew",
  ar: "Arabic",
};

/** Detect language from text using Unicode ranges */
export function detectLanguage(text) {
  if (!text) return 'en';
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  if (hebrewPattern.test(text)) return 'he';
  if (arabicPattern.test(text)) return 'ar';
  return 'en';
}