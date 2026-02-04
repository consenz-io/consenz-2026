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

    // קבלת יוצר ההצעה
    const creatorUser = await base44.asServiceRole.entities.User.filter({ email: suggestion.created_by }).then(u => u[0]);
    if (!creatorUser) {
      console.log('[AUTOMATION] Creator not found');
      return Response.json({ message: 'Creator not found' }, { status: 200 });
    }

    let title = '';
    let message = '';
    
    if (suggestion.status === 'accepted') {
      title = '🎉 ההצעה שלך התקבלה!';
      message = `ההצעה "${suggestion.title}" התקבלה ונוספה למסמך "${document.title}"`;
    } else if (suggestion.status === 'rejected') {
      title = 'ההצעה שלך נדחתה';
      message = `ההצעה "${suggestion.title}" נדחתה במסמך "${document.title}"`;
    } else {
      return Response.json({ message: 'Status not accepted or rejected' }, { status: 200 });
    }

    // שליחת התראה ליוצר ההצעה
    await base44.asServiceRole.entities.Notification.create({
      userId: creatorUser.id,
      type: suggestion.status === 'accepted' ? 'suggestion_accepted' : 'suggestion_rejected',
      title,
      message,
      relatedEntityId: suggestion.id,
      relatedEntityType: 'suggestion',
      actionUrl: `/suggestion-detail?id=${suggestion.id}`
    });

    console.log('[AUTOMATION] Status change notification sent');
    return Response.json({ success: true });
  } catch (error) {
    console.error('[AUTOMATION ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});