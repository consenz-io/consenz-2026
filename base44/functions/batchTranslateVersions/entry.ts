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
const MAX_UNITS = 100;

/**
 * Batch translation: accepts an array of content units and translates them
 * all in a single request. Each unit is checked against the Translation
 * entity cache first (via translateUnit); only uncached units invoke the LLM.
 * This eliminates N sequential network round-trips + N×500ms client-side
 * delays, making re-translation of an already-translated document near-instant.
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

    // Validate all units first — fail fast before any translation work
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

    // Translate all units — translateUnit checks cache first, only calls LLM if needed
    const results = [];
    for (const u of units) {
      const resolvedSourceLanguage = u.sourceLanguage || detectLanguage(u.content);
      const result = await translateUnit(base44, user, {
        documentId,
        sourceEntityType: u.sourceEntityType,
        sourceEntityId: u.sourceEntityId,
        sourceField: u.sourceField,
        sourceLanguage: resolvedSourceLanguage,
        targetLanguage,
        content: u.content,
        isHtml: u.isHtml ?? false,
      });
      results.push({
        sourceEntityType: u.sourceEntityType,
        sourceEntityId: u.sourceEntityId,
        sourceField: u.sourceField,
        translatedContent: result.translatedContent,
        status: result.status,
        fromCache: result.fromCache,
      });
    }

    return Response.json({ results });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}