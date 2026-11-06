import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const LANG_NAMES: Record<string, string> = { en: 'English', he: 'עברית', ar: 'العربية' };

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const id = String(body.id || '');
    const action = String(body.action || '');
    if (!id) return Response.json({ error: 'id is required' }, { status: 400 });
    if (action !== 'approve' && action !== 'reject') {
      return Response.json({ error: 'invalid_action' }, { status: 400 });
    }

    const record = await base44.asServiceRole.entities.TranslationSuggestion
      .get(id)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!record) return Response.json({ error: 'Not found' }, { status: 404 });
    if (record.status !== 'pending') {
      return Response.json({ error: 'already_reviewed' }, { status: 409 });
    }

    if (action === 'approve' && record.scope === 'content') {
      // Replace the canonical translation so every user sees the approved wording.
      const existing = await base44.asServiceRole.entities.Translation.filter({
        sourceVersionId: record.sourceVersionId,
        targetLanguage: record.targetLanguage,
        status: 'ready',
      });

      if (existing.length > 0) {
        await base44.asServiceRole.entities.Translation.update(existing[0].id, {
          translatedContent: record.proposedText,
          sourceContentHash: record.sourceContentHash || existing[0].sourceContentHash,
        });
      } else {
        await base44.asServiceRole.entities.Translation.create({
          documentId: record.documentId,
          sourceEntityType: record.sourceEntityType,
          sourceEntityId: record.sourceEntityId,
          sourceVersionId: record.sourceVersionId,
          sourceField: record.sourceField || 'content',
          sourceLanguage: record.sourceLanguage || 'he',
          targetLanguage: record.targetLanguage,
          sourceContentHash: record.sourceContentHash || '',
          translatedContent: record.proposedText,
          status: 'ready',
          translatedBy: record.userId || user.id,
        });
      }
    }

    const status = action === 'approve' ? 'approved' : 'rejected';
    const updated = await base44.asServiceRole.entities.TranslationSuggestion.update(record.id, {
      status,
      reviewedByEmail: user.email,
      reviewedAt: new Date().toISOString(),
    });

    // Let the submitter know the outcome
    if (record.userId && record.userId !== user.id) {
      const langName = LANG_NAMES[record.targetLanguage] || record.targetLanguage;
      const approved = action === 'approve';
      await base44.asServiceRole.entities.Notification.create({
        userId: record.userId,
        type: 'translation_suggestion',
        title: approved ? 'הצעת התרגום שלך אושרה' : 'הצעת התרגום שלך נדחתה',
        message: approved
          ? `התיקון שלך ל${langName} נכנס לתרגום הרשמי`
          : `התיקון שלך ל${langName} לא אושר`,
        translations: {
          he: {
            title: approved ? 'הצעת התרגום שלך אושרה' : 'הצעת התרגום שלך נדחתה',
            message: approved
              ? `התיקון שלך ל${langName} נכנס לתרגום הרשמי`
              : `התיקון שלך ל${langName} לא אושר`,
          },
          en: {
            title: approved ? 'Your translation suggestion was approved' : 'Your translation suggestion was rejected',
            message: approved
              ? `Your fix for ${langName} is now the official translation`
              : `Your fix for ${langName} was not approved`,
          },
          ar: {
            title: approved ? 'تمت الموافقة على اقتراح الترجمة' : 'تم رفض اقتراح الترجمة',
            message: approved
              ? `أصبح تصحيحك للغة ${langName} هو الترجمة الرسمية`
              : `لم تتم الموافقة على تصحيحك للغة ${langName}`,
          },
        },
        relatedEntityId: record.id,
        relatedEntityType: 'translation',
        actionUrl: '/TranslationReview',
        read: false,
      }).catch(() => {});
    }

    return Response.json({ record: updated });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}