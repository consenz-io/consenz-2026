import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { PROMPT_INJECTION_GUARD, wrapUntrusted, validateTranslationIntegrity } from "../../shared/translatePromptSafety.ts";
import { checkDocumentAccess, verifyGroupMembership } from "../../shared/documentAuth.ts";

const LANGUAGE_PROMPTS = { en: "English", he: "Hebrew", ar: "Arabic" };
const VALID_LANGS = new Set(["en", "he", "ar"]);
const MAX_CONTENT_LENGTH = 20000;

// Per-user rate limiter — prevents unmetered LLM credit consumption.
// 5 translations per minute per user. Requires a documentId so the endpoint
// cannot be used as a free general-purpose translation API.
const translateRateLimiter = new Map();
const TRANSLATE_RATE_LIMIT = 5;
const TRANSLATE_WINDOW_MS = 60000;

function checkTranslateRateLimit(userId) {
  const now = Date.now();
  const userKey = `translate-${userId}`;
  if (!translateRateLimiter.has(userKey)) {
    translateRateLimiter.set(userKey, { count: 1, resetAt: now + TRANSLATE_WINDOW_MS });
    return { allowed: true };
  }
  const record = translateRateLimiter.get(userKey);
  if (now >= record.resetAt) {
    record.count = 1;
    record.resetAt = now + TRANSLATE_WINDOW_MS;
    translateRateLimiter.set(userKey, record);
    return { allowed: true };
  }
  record.count++;
  translateRateLimiter.set(userKey, record);
  if (record.count > TRANSLATE_RATE_LIMIT) {
    const remainingSeconds = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, remainingSeconds };
  }
  return { allowed: true };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of translateRateLimiter.entries()) {
    if (now >= record.resetAt) translateRateLimiter.delete(key);
  }
}, 5 * 60 * 1000);

const TERMINOLOGY_DIRECTIVE = `\n\nTERMINOLOGY — translate these domain terms consistently, using exactly these equivalents in both directions:\n- סעיף <-> section (NEVER "clause" or "provision")\n- נושא <-> topic (NEVER "subject" or "theme")\n- הצעה <-> suggestion (NEVER "proposal" or "recommendation")\n- קונצנזוס <-> consensus (NEVER "agreement" or "consent")\n- מסמך <-> document (NEVER "file" or "paper")\n- הצבעה <-> vote (NEVER "ballot" or "poll")\n- תגובה <-> comment (NEVER "reply" or "response")\n- עריכה <-> edit (NEVER "modification" or "revision")\n- תומך <-> pro / supporter (NEVER "backer")\n- מתנגד <-> con / opponent (NEVER "objector")\nIf the same concept appears more than once, use the SAME target word every time.`;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { content, targetLanguage, isHtml, documentId, groupId } = await req.json();
    if (!content || typeof content !== 'string') {
      return Response.json({ error: 'Missing content' }, { status: 400 });
    }
    if (!VALID_LANGS.has(targetLanguage)) {
      return Response.json({ error: 'Invalid targetLanguage' }, { status: 400 });
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return Response.json({ error: 'Content too long' }, { status: 400 });
    }
    // Require either a documentId or groupId so this endpoint cannot be used as
    // a free general-purpose translation API. The caller must prove access to
    // the entity whose content they are translating.
    if ((!documentId || typeof documentId !== 'string') &&
        (!groupId || typeof groupId !== 'string')) {
      return Response.json({ error: 'Missing documentId or groupId' }, { status: 400 });
    }

    const rateLimitCheck = checkTranslateRateLimit(user.id);
    if (!rateLimitCheck.allowed) {
      return Response.json(
        { error: 'Rate limit exceeded', remainingSeconds: rateLimitCheck.remainingSeconds },
        { status: 429 }
      );
    }

    // Authorization: verify the user can access the document or group whose
    // content they are translating. Without this, any authenticated user could
    // use this endpoint as a free general-purpose translation API, burning LLM
    // credits on content unrelated to the platform.
    if (documentId) {
      const document = await base44.asServiceRole.entities.Document
        .filter({ id: documentId })
        .then(r => r[0])
        .catch(() => null);
      if (!document) return Response.json({ error: 'Document not found' }, { status: 404 });
      const { authorized } = await checkDocumentAccess(base44, document, user);
      if (!authorized) return Response.json({ error: 'Forbidden' }, { status: 403 });
    } else if (groupId) {
      const group = await base44.asServiceRole.entities.Group
        .filter({ id: groupId })
        .then(r => r[0])
        .catch(() => null);
      if (!group) return Response.json({ error: 'Group not found' }, { status: 404 });
      // Public groups are accessible to all; private/hidden require membership.
      if (group.status === 'private' || group.status === 'hidden') {
        const { isMember } = await verifyGroupMembership(base44, group, user);
        if (!isMember) return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const langName = LANGUAGE_PROMPTS[targetLanguage];
    const prompt = isHtml
      ? `Translate the following HTML content to ${langName}. Preserve all HTML tags exactly as-is. Only translate the text content between tags. Return only the translated HTML with no additional commentary or markdown.${TERMINOLOGY_DIRECTIVE}${PROMPT_INJECTION_GUARD}\n\nContent to translate:\n${wrapUntrusted(content)}`
      : `Translate the following text to ${langName}. Return only the translated text with no commentary or markdown.${TERMINOLOGY_DIRECTIVE}${PROMPT_INJECTION_GUARD}\n\nText:\n${wrapUntrusted(content)}`;

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

    const integrityError = validateTranslationIntegrity(content, translated);
    if (integrityError) {
      return Response.json({ error: integrityError }, { status: 422 });
    }

    return Response.json({ translated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}