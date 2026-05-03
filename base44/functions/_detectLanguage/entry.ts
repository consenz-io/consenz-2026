/**
 * Shared language detection utility.
 * Detects Hebrew / Arabic / English from text content.
 * Input:  { text: string }
 * Output: { lang: 'he' | 'ar' | 'en' }
 */

export function detectLanguage(text) {
  if (!text) return 'he';
  if (/[\u0590-\u05FF]/.test(text)) return 'he';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  return 'en';
}

Deno.serve(async (req) => {
  try {
    const { text } = await req.json();
    return Response.json({ lang: detectLanguage(text) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});