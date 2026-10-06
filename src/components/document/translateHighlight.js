/**
 * Shared helpers for the "Translate All" feature.
 *
 * A document is eligible for translation highlighting when its original
 * language differs from the UI/system language (the one the user picked in
 * the sidebar). When that's the case, every "Translate All" button across the
 * app gets the `translate-all-highlight` class so the user notices they can
 * translate the whole document at once.
 */

const detectLanguage = (text) => {
  if (!text) return null;
  if (/[\u0590-\u05FF]/.test(text)) return 'he';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  return 'en';
};

/**
 * Returns true when the document's original language is known and differs
 * from the current UI language — i.e. translation is actually useful and the
 * Translate All buttons should be highlighted.
 */
export const needsTranslationHighlight = (document, language) => {
  if (!document || !language) return false;
  const docLang =
    document.originalLanguage || detectLanguage(document.title) || detectLanguage(document.description);
  if (!docLang) return false;
  return docLang !== language;
};

export const TRANSLATE_HIGHLIGHT_CLASS = 'translate-all-highlight';