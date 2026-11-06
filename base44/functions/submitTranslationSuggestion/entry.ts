import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const LANGS = ['en', 'he', 'ar'];
const SCOPES = ['platform', 'content'];
const CONTENT_ENTITY_TYPES = ['section', 'version', 'suggestion', 'document', 'topic', 'comment'];
const LANG_NAMES: Record<string, string> = { en: 'English', he: 'עברית', ar: 'العربية' };

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const scope = String(body.scope || '');
    const targetLanguage = String(body.targetLanguage || '');
    const proposedText = String(body.proposedText || '').trim();
    const currentText = String(body.currentText || '').trim().slice(0, 5000);
    const note = String(body.note || '').trim().slice(0, 500);

    if (!SCOPES.includes(scope)) return Response.json({ error: 'invalid_scope' }, { status: 400 });
    if (!LANGS.includes(targetLanguage)) return Response.json({ error: 'invalid_language' }, { status: 400 });
    if (proposedText.length < 2 || proposedText.length > 2000) {
      return Response.json({ error: 'invalid_text' }, { status: 400 });
    }
    if (proposedText === currentText) {
      return Response.json({ error: 'identical' }, { status: 400 });
    }

    const platformKey = scope === 'platform' ? String(body.platformKey || '').trim() : '';
    if (scope === 'platform' && !platformKey) {
      return Response.json({ error: 'missing_key' }, { status: 400 });
    }

    const sourceEntityType = scope === 'platform' ? 'platform' : String(body.sourceEntityType || '');
    const sourceEntityId = scope === 'content' ? String(body.sourceEntityId || '') : '';
    const sourceField = scope === 'content' ? String(body.sourceField || 'content') : '';
    const documentId = scope === 'content' ? String(body.documentId || '') : '';
    const sourceVersionId = String(body.sourceVersionId || body.sourceEntityId || '');
    const sourceContentHash = String(body.sourceContentHash || '');
    const sourceLanguage = LANGS.includes(body.sourceLanguage) ? body.sourceLanguage : 'he';

    if (scope === 'content') {
      if (!CONTENT_ENTITY_TYPES.includes(sourceEntityType)) {
        return Response.json({ error: 'invalid_entity_type' }, { status: 400 });
      }
      if (!sourceEntityId || !documentId || !sourceVersionId) {
        return Response.json({ error: 'missing_source' }, { status: 400 });
      }
    }

    // Prevent duplicate active suggestions for the same source + target language
    const identityQuery: any = {
      scope,
      targetLanguage,
      status: 'pending',
    };
    if (scope === 'platform') {
      identityQuery.platformKey = platformKey;
    } else {
      identityQuery.sourceVersionId = sourceVersionId;
      identityQuery.sourceField = sourceField;
    }
    const pendingForSource = await base44.asServiceRole.entities.TranslationSuggestion.filter(identityQuery);

    if (pendingForSource.some((s: any) => s.created_by_id === user.id || s.userId === user.id)) {
      return Response.json({ error: 'duplicate_own' }, { status: 409 });
    }
    if (pendingForSource.length >= 5) {
      return Response.json({ error: 'too_many_pending' }, { status: 409 });
    }

    let userName = user.full_name || user.email;
    const profiles = await base44.entities.UserPublicProfile
      .filter({ userId: user.id })
      .catch(() => []);
    if (profiles.length > 0 && profiles[0].fullName) userName = profiles[0].fullName;

    const record = await base44.entities.TranslationSuggestion.create({
      scope,
      platformKey,
      sourceEntityType,
      sourceEntityId,
      sourceVersionId,
      sourceField,
      documentId,
      sourceLanguage,
      targetLanguage,
      sourceContentHash,
      currentText,
      proposedText,
      note,
      userId: user.id,
      userName,
      userEmail: user.email,
      status: 'pending',
    });

    // Notify admins about the new suggestion
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const langName = LANG_NAMES[targetLanguage] || targetLanguage;
    const notifications = admins.slice(0, 50).map((admin: any) => ({
      userId: admin.id,
      type: 'translation_suggestion',
      title: 'הצעת תרגום חדשה',
      message: `${userName} הציע/ה תיקון תרגום ל${langName}`,
      translations: {
        he: { title: 'הצעת תרגום חדשה', message: `${userName} הציע/ה תיקון תרגום ל${langName}` },
        en: { title: 'New translation suggestion', message: `${userName} proposed a translation fix (${langName})` },
        ar: { title: 'اقتراح ترجمة جديد', message: `${userName} اقترح/ت تصحيح ترجمة (${langName})` },
      },
      relatedEntityId: record.id,
      relatedEntityType: 'translation',
      actionUrl: '/TranslationReview',
      read: false,
    }));

    await Promise.allSettled(
      notifications.map((notification: any) =>
        base44.asServiceRole.entities.Notification.create(notification)
      )
    );

    return Response.json({ record });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}