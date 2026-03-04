import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data: suggestion, old_data: oldSuggestion } = await req.json();

    if (!suggestion || event.type !== 'update') {
      return Response.json({ message: 'Not an update event' }, { status: 200 });
    }

    // בדיקה אם הסטטוס השתנה
    const statusChanged = oldSuggestion?.status !== suggestion.status;
    if (!statusChanged) {
      console.log('[AUTOMATION] Status not changed, skipping');
      return Response.json({ message: 'Status not changed' }, { status: 200 });
    }

    console.log('[AUTOMATION] Suggestion status changed:', suggestion.id, oldSuggestion.status, '->', suggestion.status);

    // קבלת המסמך
    const document = await base44.asServiceRole.entities.Document.filter({ id: suggestion.documentId }).then(d => d[0]);
    if (!document) {
      console.log('[AUTOMATION] Document not found');
      return Response.json({ message: 'Document not found' }, { status: 200 });
    }

    // אם הצעה אושרה על ידי אדמין (לא דרך הצבעות) - עדכן מד קונסנזוס רק להצעות שעברו את רף ההצבעות
    // הצעות שאושרו על ידי אדמין מסומנות עם approvedByAdmin=true ולא משפיעות על המד
    if (suggestion.status === 'accepted' && suggestion.approvedByAdmin === true) {
      console.log('[AUTOMATION] Suggestion approved by admin override - skipping consensus meter update');
    } else if (suggestion.status === 'accepted' && !suggestion.approvedByAdmin) {
      // הצעה שהגיעה לסטטוס accepted ללא סימון approvedByAdmin -
      // כלומר אושרה דרך processAcceptance או autoAcceptSuggestion (עברה הצבעות)
      // החישוב כבר בוצע שם, אין צורך לעשות כלום כאן
      console.log('[AUTOMATION] Suggestion accepted via vote threshold - consensus already updated by processAcceptance');
    }

    // Accepted suggestions: notification is already sent by processAcceptance.
    // This automation only handles rejected suggestions (admin override).
    if (suggestion.status === 'accepted') {
      console.log('[AUTOMATION] Accepted - notification already sent by processAcceptance, skipping');
      return Response.json({ message: 'Accepted notifications handled by processAcceptance' }, { status: 200 });
    }

    if (suggestion.status !== 'rejected') {
      return Response.json({ message: 'Status not rejected, skipping' }, { status: 200 });
    }

    // שליחת התראה רק על דחייה על ידי אדמין
    const creatorUser = await base44.asServiceRole.entities.User.filter({ email: suggestion.created_by }).then(u => u[0]);
    if (!creatorUser) {
      console.log('[AUTOMATION] Creator not found');
      return Response.json({ message: 'Creator not found' }, { status: 200 });
    }

    await base44.asServiceRole.entities.Notification.create({
      userId: creatorUser.id,
      type: 'suggestion_rejected',
      title: 'ההצעה שלך נדחתה',
      message: `ההצעה "${suggestion.title}" נדחתה במסמך "${document.title}"`,
      relatedEntityId: suggestion.id,
      relatedEntityType: 'suggestion',
      actionUrl: `/suggestiondetail?id=${suggestion.id}`
    });

    console.log('[AUTOMATION] Rejection notification sent');
    return Response.json({ success: true });
  } catch (error) {
    console.error('[AUTOMATION ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});