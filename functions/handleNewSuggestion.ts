import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data: suggestion } = await req.json();

    if (!suggestion || event.type !== 'create') {
      return Response.json({ message: 'Not a create event' }, { status: 200 });
    }

    console.log('[AUTOMATION] New suggestion created:', suggestion.id);

    // שליחת התראה למשתתפים במסמך
    const document = await base44.asServiceRole.entities.Document.filter({ id: suggestion.documentId }).then(d => d[0]);
    if (!document) {
      console.log('[AUTOMATION] Document not found');
      return Response.json({ message: 'Document not found' }, { status: 200 });
    }

    // קבלת כל המשתתפים במסמך (למעט יוצר ההצעה)
    const interactions = await base44.asServiceRole.entities.UserInteraction.filter({ documentId: document.id });
    const uniqueUserIds = [...new Set(interactions.map(i => i.userId))].filter(uid => uid !== suggestion.created_by);

    // קבלת פרטי היוצר
    const creatorProfile = await base44.asServiceRole.entities.UserPublicProfile.filter({ email: suggestion.created_by }).then(p => p[0]);
    const creatorName = creatorProfile?.fullName || 'User';

    // יצירת התראות לכל המשתתפים
    const notifications = uniqueUserIds.map(userId => ({
      userId,
      type: suggestion.type === 'edit_suggestion' ? 'reply_to_my_suggestion' : 'vote_on_suggestion',
      title: suggestion.type === 'edit_suggestion' 
        ? `הצעה לעריכת הצעה מאת ${creatorName}`
        : `הצעה חדשה במסמך "${document.title}"`,
      message: `${creatorName} ${suggestion.type === 'edit_suggestion' ? 'הציע עריכה להצעה' : 'הוסיף הצעה חדשה'} במסמך "${document.title}"`,
      relatedEntityId: suggestion.id,
      relatedEntityType: 'suggestion',
      actionUrl: `/suggestion-detail?id=${suggestion.id}`
    }));

    if (notifications.length > 0) {
      await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
      console.log(`[AUTOMATION] Created ${notifications.length} notifications`);
    }

    return Response.json({ success: true, notificationsSent: notifications.length });
  } catch (error) {
    console.error('[AUTOMATION ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});