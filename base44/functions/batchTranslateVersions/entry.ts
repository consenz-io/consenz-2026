import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { translateUnitsBatch } from "../../shared/translateLogic.ts";
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
const MAX_UNITS = 20;

// Per-user rate limiter — prevents unmetered LLM credit consumption via batch.
// 2 batch calls per minute per user (each batch can translate up to 20 units).
// Caps at 40 translations/minute — fast for real use, far less abusable.
const batchRateLimiter = new Map();
const BATCH_RATE_LIMIT = 2;
const BATCH_WINDOW_MS = 60000;

function checkBatchRateLimit(userId: string) {
  const now = Date.now();
  const userKey = `batchTranslate-${userId}`;
  if (!batchRateLimiter.has(userKey)) {
    batchRateLimiter.set(userKey, { count: 1, resetAt: now + BATCH_WINDOW_MS });
    return { allowed: true };
  }
  const record = batchRateLimiter.get(userKey);
  if (now >= record.resetAt) {
    record.count = 1;
    record.resetAt = now + BATCH_WINDOW_MS;
    batchRateLimiter.set(userKey, record);
    return { allowed: true };
  }
  record.count++;
  batchRateLimiter.set(userKey, record);
  if (record.count > BATCH_RATE_LIMIT) {
    return { allowed: false, remainingSeconds: Math.ceil((record.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of batchRateLimiter.entries()) {
    if (now >= record.resetAt) batchRateLimiter.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Batch translation: accepts an array of content units and translates them
 * all in a single request. Uses translateUnitsBatch which:
 * 1. Fetches all existing translations in a single DB query (by $in).
 * 2. Parallelizes LLM calls for uncached units with a concurrency limit.
 *
 * This makes re-translation of an already-translated document near-instant
 * (single DB query instead of N sequential ones).
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const rateLimitCheck = checkBatchRateLimit(user.id);
    if (!rateLimitCheck.allowed) {
      return Response.json(
        { error: "Rate limit exceeded", remainingSeconds: rateLimitCheck.remainingSeconds },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { documentId, targetLanguage, units } = body;

    if (!documentId)
      return Response.json({ error: "Missing documentId" }, { status: 400 });
    if (!SUPPORTED_LANGUAGES.includes(targetLanguage))
      return Response.json({ error: "Invalid targetLanguage" }, { status: 400 });
    if (!Array.isArray(units) || units.length === 0)
      return Response.json({ error: "Missing or empty units array" }, { status: 400 });
    if (units.length > MAX_UNITS)
      return Response.json({ error: `Too many units (max ${MAX_UNITS} per batch)` }, { status: 400 });

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

    // Validate all units — fail fast before any translation work
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (!u.sourceEntityType || !VALID_ENTITY_TYPES.has(u.sourceEntityType))
        return Response.json({ error: `Invalid sourceEntityType at index ${i}` }, { status: 400 });
      if (!u.sourceEntityId)
        return Response.json({ error: `Missing sourceEntityId at index ${i}` }, { status: 400 });
      if (!u.sourceField)
        return Response.json({ error: `Missing sourceField at index ${i}` }, { status: 400 });
      if (!u.content || typeof u.content !== "string")
        return Response.json({ error: `Missing content at index ${i}` }, { status: 400 });
      if (u.content.length > MAX_CONTENT_LENGTH)
        return Response.json({ error: `Content too long at index ${i}` }, { status: 400 });
    }

    // Prepare units with resolved source languages
    const preparedUnits = units.map((u) => ({
      documentId,
      sourceEntityType: u.sourceEntityType,
      sourceEntityId: u.sourceEntityId,
      sourceField: u.sourceField,
      sourceLanguage: u.sourceLanguage || detectLanguage(u.content),
      content: u.content,
      isHtml: u.isHtml ?? false,
    }));

    // Translate all units — optimized batch with single cache query + parallel LLM
    const results = await translateUnitsBatch(
      base44,
      user,
      documentId,
      targetLanguage,
      preparedUnits
    );

    return Response.json({ results });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}