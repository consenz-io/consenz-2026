/**
 * Normalizes translation retrieval across all entities.
 * entity.translations[lang] can be either:
 *   - a string (simple translation)
 *   - an object { title, description, content, ... }
 *
 * @param {object} entity - Any entity with a translations field
 * @param {string} lang - Language code ('en', 'he', 'ar')
 * @param {string} [field] - Which field to extract from object translations (default: 'title')
 * @returns {string|null} - The translated string, or null if not available
 */
export function getTranslation(entity, lang, field = 'title') {
  if (!entity || !lang) return null;
  const t = entity.translations?.[lang];
  if (!t) return null;
  if (typeof t === 'string') return t;
  return t[field] ?? null;
}

/**
 * Returns the translated value if available, otherwise falls back to the entity's own field.
 *
 * @param {object} entity - Any entity with a translations field
 * @param {string} lang - Language code
 * @param {string} [field] - Field name on both the entity and inside translations object
 * @returns {string} - Translated or original value
 */
export function getTranslatedField(entity, lang, field = 'title') {
  return getTranslation(entity, lang, field) ?? entity?.[field] ?? '';
}