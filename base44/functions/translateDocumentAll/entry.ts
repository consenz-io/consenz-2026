import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const LANGUAGE_PROMPTS = { en: "English", he: "Hebrew", ar: "Arabic" };
const VALID_LANGS = new Set(["en", "he", "ar"]);

const detectLanguage = (text) => {
  if (!text) return 'en';
  if (/[\u0590-\u05FF]/.test(text)) return 'he';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  return 'en';
};

const cleanTranslation = (text) =>
  String(text).replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

const translateText = async (base44, text, langName, isHtml) => {
  const prompt = isHtml
    ? `Translate the following HTML content to ${langName}. Keep ALL HTML tags exactly as they are. Return ONLY the translated HTML:\n${text}`
    : `Translate the following text to ${langName}. Return ONLY the translated text:\n${text}`;
  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: false,
  });
  const out = typeof result === 'string' ? result : (result?.content || result);
  return cleanTranslation(out);
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { documentId, targetLanguage } = await req.json();
    if (!documentId) return Response.json({ error: 'Missing documentId' }, { status: 400 });
    if (!VALID_LANGS.has(targetLanguage)) {
      return Response.json({ error: 'Invalid targetLanguage' }, { status: 400 });
    }

    const langName = LANGUAGE_PROMPTS[targetLanguage];

    const [document, topics, sections] = await Promise.all([
      base44.asServiceRole.entities.Document.filter({ id: documentId }).then(r => r[0]),
      base44.asServiceRole.entities.Topic.filter({ documentId }),
      base44.asServiceRole.entities.Section.filter({ documentId }),
    ]);

    if (!document) return Response.json({ error: 'Document not found' }, { status: 404 });

    let translatedCount = 0;
    const tasks = [];

    // Document title
    const docNeedsTr = (document.originalLanguage || detectLanguage(document.title)) !== targetLanguage
      && !document.translations?.[targetLanguage]?.title;
    if (docNeedsTr) {
      tasks.push(async () => {
        const translatedTitle = await translateText(base44, document.title, langName, false);
        await base44.asServiceRole.entities.Document.update(document.id, {
          translations: {
            ...(document.translations || {}),
            [targetLanguage]: { ...(document.translations?.[targetLanguage] || {}), title: translatedTitle },
          },
        });
        translatedCount++;
      });
    }

    // Document description
    const descNeedsTr = document.description
      && (document.originalLanguage || detectLanguage(document.description)) !== targetLanguage
      && !document.translations?.[targetLanguage]?.description;
    if (descNeedsTr) {
      tasks.push(async () => {
        const translatedDesc = await translateText(base44, document.description, langName, true);
        const fresh = await base44.asServiceRole.entities.Document.filter({ id: document.id }).then(r => r[0]);
        await base44.asServiceRole.entities.Document.update(document.id, {
          translations: {
            ...(fresh?.translations || {}),
            [targetLanguage]: { ...(fresh?.translations?.[targetLanguage] || {}), description: translatedDesc },
          },
        });
        translatedCount++;
      });
    }

    // Topics
    for (const topic of topics) {
      const needs = (topic.originalLanguage || detectLanguage(topic.title)) !== targetLanguage
        && !topic.translations?.[targetLanguage]?.title;
      if (needs) {
        tasks.push(async () => {
          const translatedTitle = await translateText(base44, topic.title, langName, false);
          await base44.asServiceRole.entities.Topic.update(topic.id, {
            translations: { ...(topic.translations || {}), [targetLanguage]: { title: translatedTitle } },
          });
          translatedCount++;
        });
      }
    }

    // Sections
    for (const section of sections) {
      const needs = (section.originalLanguage || detectLanguage(section.content)) !== targetLanguage
        && !section.translations?.[targetLanguage];
      if (needs) {
        tasks.push(async () => {
          const translatedContent = await translateText(base44, section.content, langName, true);
          await base44.asServiceRole.entities.Section.update(section.id, {
            translations: { ...(section.translations || {}), [targetLanguage]: translatedContent },
          });
          translatedCount++;
        });
      }
    }

    // Run in batches of 3 to parallelize without overwhelming
    for (let i = 0; i < tasks.length; i += 3) {
      await Promise.all(tasks.slice(i, i + 3).map(t => t().catch(err => console.error('Translation item failed:', err))));
    }

    return Response.json({ translatedCount, totalItems: tasks.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}