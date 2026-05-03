/**
 * Shared i18n helper — used by all notification-emitting functions.
 * Call via: base44.asServiceRole.functions.invoke('_i18nHelper', { ... })
 *
 * Input:  { translations, titleKey, messageKey, replacements, lang? }
 * Output: { title, message, allTranslations }
 *
 * Or call directly as a module (not over HTTP) by copy-pasting the pure functions
 * into callers — but the canonical source lives here.
 */

const LANGS = ['en', 'he', 'ar'];

function translate(translations, lang, key, replacements = {}) {
  let text = translations[lang]?.[key] || translations['he']?.[key] || key;
  for (const [k, v] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return text;
}

function buildAllTranslations(translations, titleKey, messageKey, replacements = {}) {
  const result = {};
  for (const lang of LANGS) {
    result[lang] = {
      title: translate(translations, lang, titleKey, replacements),
      message: translate(translations, lang, messageKey, replacements),
    };
  }
  return result;
}

// Export as HTTP endpoint so other functions can call it if needed
Deno.serve(async (req) => {
  try {
    const { translations, titleKey, messageKey, replacements = {}, lang = 'he' } = await req.json();
    return Response.json({
      title: translate(translations, lang, titleKey, replacements),
      message: translate(translations, lang, messageKey, replacements),
      allTranslations: buildAllTranslations(translations, titleKey, messageKey, replacements),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});