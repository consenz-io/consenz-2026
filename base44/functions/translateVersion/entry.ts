import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { translateUnit } from "../../shared/translateLogic.ts";
import { SUPPORTED_LANGUAGES, detectLanguage } from "../../shared/translationVersioning.ts";
import { checkDocumentAccess } from "../../shared/documentAuth.ts";

const VALID_ENTITY_TYPES = new Set([
  "section",
  "version",
  "suggestion",
  "document",
  "topic",
  "comment",
]);

const MAX_CONTENT_LENGTH = 20000;

// Per-user rate limiter — prevents unmetered LLM credit consumption.
// 10 translations per minute per user.
const translateRateLimiter = new Map();
const TRANSLATE_RATE_LIMIT = 10;
const TRANSLATE_WINDOW_MS = 60000;

function checkTranslateRateLimit(userId: string) {
  const now = Date.now();
  const userKey = `translateVersion-${userId}`;
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
    return { allowed: false, remainingSeconds: Math.ceil((record.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of translateRateLimiter.entries()) {
    if (now >= record.resetAt) translateRateLimiter.delete(key);
  }
}, 5 * 60 * 1000);

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const rateLimitCheck = checkTranslateRateLimit(user.id);
    if (!rateLimitCheck.allowed) {
      return Response.json(
        { error: "Rate limit exceeded", remainingSeconds: rateLimitCheck.remainingSeconds },
        { status: 429 }
      );
    }

    const body = await req.json();
    const {
      documentId,
      sourceEntityType,
      sourceEntityId,
      sourceField,
      sourceLanguage,
      targetLanguage,
      content,
      isHtml = false,
      anchorOriginalContent,
      anchorTranslatedContent,
    } = body;

    // Validate required fields
    if (!documentId)
      return Response.json({ error: "Missing documentId" }, { status: 400 });
    if (!sourceEntityType || !VALID_ENTITY_TYPES.has(sourceEntityType))
      return Response.json({ error: "Invalid sourceEntityType" }, { status: 400 });
    if (!sourceEntityId)
      return Response.json({ error: "Missing sourceEntityId" }, { status: 400 });
    if (!sourceField)
      return Response.json({ error: "Missing sourceField" }, { status: 400 });
    if (!SUPPORTED_LANGUAGES.includes(targetLanguage))
      return Response.json({ error: "Invalid targetLanguage" }, { status: 400 });
    if (!content || typeof content !== "string")
      return Response.json({ error: "Missing content" }, { status: 400 });
    if (content.length > MAX_CONTENT_LENGTH)
      return Response.json({ error: "Content too long" }, { status: 400 });

    // Resolve source language: use provided value, or detect from content
    const resolvedSourceLanguage =
      sourceLanguage || detectLanguage(content);

    // Verify document exists
    const document = await base44.asServiceRole.entities.Document.filter({
      id: documentId,
    }).then((r: any[]) => r[0]);
    if (!document)
      return Response.json({ error: "Document not found" }, { status: 404 });

    // Scoped authorization: verify the user can access this document's group
    const { authorized } = await checkDocumentAccess(base44, document, user);
    if (!authorized)
      return Response.json({ error: "Forbidden" }, { status: 403 });

    const result = await translateUnit(base44, user, {
      documentId,
      sourceEntityType,
      sourceEntityId,
      sourceField,
      sourceLanguage: resolvedSourceLanguage,
      targetLanguage,
      content,
      isHtml,
      anchorOriginalContent,
      anchorTranslatedContent,
    });

    return Response.json(result);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}