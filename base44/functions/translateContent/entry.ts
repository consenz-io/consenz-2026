import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const LANGUAGE_PROMPTS = { en: "English", he: "Hebrew", ar: "Arabic" };
const VALID_LANGS = new Set(["en", "he", "ar"]);
const MAX_CONTENT_LENGTH = 20000;

const TERMINOLOGY_DIRECTIVE = `\n\nTERMINOLOGY — translate these domain terms consistently, using exactly these equivalents in both directions:\n- סעיף <-> section (NEVER "clause" or "provision")\n- נושא <-> topic (NEVER "subject" or "theme")\n- הצעה <-> suggestion (NEVER "proposal" or "recommendation")\n- קונצנזוס <-> consensus (NEVER "agreement" or "consent")\n- מסמך <-> document (NEVER "file" or "paper")\n- הצבעה <-> vote (NEVER "ballot" or "poll")\n- תגובה <-> comment (NEVER "reply" or "response")\n- עריכה <-> edit (NEVER "modification" or "revision")\n- תומך <-> pro / supporter (NEVER "backer")\n- מתנגד <-> con / opponent (NEVER "objector")\nIf the same concept appears more than once, use the SAME target word every time.`;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { content, targetLanguage, isHtml } = await req.json();
    if (!content || typeof content !== 'string') {
      return Response.json({ error: 'Missing content' }, { status: 400 });
    }
    if (!VALID_LANGS.has(targetLanguage)) {
      return Response.json({ error: 'Invalid targetLanguage' }, { status: 400 });
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return Response.json({ error: 'Content too long' }, { status: 400 });
    }

    const langName = LANGUAGE_PROMPTS[targetLanguage];
    const prompt = isHtml
      ? `Translate the following HTML content to ${langName}. Preserve all HTML tags exactly as-is. Only translate the text content between tags. Return only the translated HTML with no additional commentary or markdown.${TERMINOLOGY_DIRECTIVE}\n\nContent to translate:\n${content}`
      : `Translate the following text to ${langName}. Return only the translated text with no commentary or markdown.${TERMINOLOGY_DIRECTIVE}\n\nText:\n${content}`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: false,
    });

    let translated = typeof result === 'string'
      ? result
      : (result?.content || result?.text || result?.translation || result?.output || result?.result || content);
    translated = String(translated)
      .replace(/```html\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    return Response.json({ translated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}