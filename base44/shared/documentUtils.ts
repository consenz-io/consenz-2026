/**
 * Shared utility functions used by backend functions that process
 * document edits (processAcceptanceV4, applyAdminEdit, etc.).
 *
 * Extracted here to avoid duplication across function entry points.
 */

// Detect the language of a text based on Unicode character ranges.
export function detectLanguage(text: string): string {
  if (!text) return 'he';
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  if (hebrewPattern.test(text)) return 'he';
  if (arabicPattern.test(text)) return 'ar';
  return 'en';
}

// Filter out non-ObjectId strings (e.g. service-role UUIDs like "service_xxx-xxx-xxx")
// before passing them to User.filter — MongoDB rejects them with "not a valid ObjectId".
export function isValidObjectId(id: string): boolean {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
}

export function filterValidObjectIds(ids: string[]): string[] {
  return ids.filter(isValidObjectId);
}