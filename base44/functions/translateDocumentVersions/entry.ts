import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { translateUnit } from "../../shared/translateLogic.ts";
import { detectLanguage, SUPPORTED_LANGUAGES } from "../../shared/translationVersioning.ts";

const BATCH_SIZE = 3;

interface UnitTask {
  sourceEntityType: string;
  sourceEntityId: string;
  sourceField: string;
  sourceLanguage: string;
  content: string;
  isHtml: boolean;
  label: string;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { documentId, targetLanguage } = await req.json();
    if (!documentId)
      return Response.json({ error: "Missing documentId" }, { status: 400 });
    if (!SUPPORTED_LANGUAGES.includes(targetLanguage))
      return Response.json({ error: "Invalid targetLanguage" }, { status: 400 });

    // Verify document exists
    const document = await base44.asServiceRole.entities.Document.filter({
      id: documentId,
    }).then((r: any[]) => r[0]);
    if (!document)
      return Response.json({ error: "Document not found" }, { status: 404 });

    // Gather all content units
    const [topics, sections] = await Promise.all([
      base44.asServiceRole.entities.Topic.filter({ documentId }),
      base44.asServiceRole.entities.Section.filter({ documentId }),
    ]);

    const tasks: UnitTask[] = [];

    // Document title
    if (document.title) {
      tasks.push({
        sourceEntityType: "document",
        sourceEntityId: documentId,
        sourceField: "title",
        sourceLanguage: document.originalLanguage || detectLanguage(document.title),
        content: document.title,
        isHtml: false,
        label: "document:title",
      });
    }

    // Document description
    if (document.description) {
      tasks.push({
        sourceEntityType: "document",
        sourceEntityId: documentId,
        sourceField: "description",
        sourceLanguage: document.originalLanguage || detectLanguage(document.description),
        content: document.description,
        isHtml: true,
        label: "document:description",
      });
    }

    // Topics
    for (const topic of topics) {
      if (topic.title) {
        tasks.push({
          sourceEntityType: "topic",
          sourceEntityId: topic.id,
          sourceField: "title",
          sourceLanguage: topic.originalLanguage || detectLanguage(topic.title),
          content: topic.title,
          isHtml: false,
          label: `topic:${topic.id}:title`,
        });
      }
    }

    // Sections
    for (const section of sections) {
      if (section.content) {
        tasks.push({
          sourceEntityType: "section",
          sourceEntityId: section.id,
          sourceField: "content",
          sourceLanguage: section.originalLanguage || detectLanguage(section.content),
          content: section.content,
          isHtml: true,
          label: `section:${section.id}:content`,
        });
      }
    }

    // Translate in batches
    const results: Array<{
      label: string;
      status: string;
      fromCache: boolean;
      error?: string;
    }> = [];

    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
      const batch = tasks.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (task) => {
          try {
            const result = await translateUnit(base44, user, {
              documentId,
              sourceEntityType: task.sourceEntityType,
              sourceEntityId: task.sourceEntityId,
              sourceField: task.sourceField,
              sourceLanguage: task.sourceLanguage,
              targetLanguage,
              content: task.content,
              isHtml: task.isHtml,
            });
            return {
              label: task.label,
              status: result.status,
              fromCache: result.fromCache,
              error: result.error,
            };
          } catch (err: any) {
            return {
              label: task.label,
              status: "failed",
              fromCache: false,
              error: err.message,
            };
          }
        })
      );
      results.push(...batchResults);
    }

    const summary = {
      total: results.length,
      translated: results.filter((r) => r.status === "ready").length,
      fromCache: results.filter((r) => r.fromCache).length,
      failed: results.filter((r) => r.status === "failed").length,
      notNeeded: results.filter((r) => r.status === "not_needed").length,
    };

    return Response.json({ summary, results });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}