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
const MAX_UNITS = 100;

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

    const body = await req.json();
    const { documentId, targetLanguage, units } = body;

    if (!documentId)
      return Response.json({ error: "Missing documentId" }, { status: 400 });
    if (!SUPPORTED_LANGUAGES.includes(targetLanguage))
      return Response.json({ error: "Invalid targetLanguage" }, { status: 400 });
    if (!Array.isArray(units) || units.length === 0)
      return Response.json({ error: "Missing or empty units array" }, { status: 400 });
    if (units.length > MAX_UNITS)
      return Response.json({ error: `Too many units (max ${MAX_UNITS})` }, { status: 400 });

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