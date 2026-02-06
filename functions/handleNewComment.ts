import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data: comment } = await req.json();

    if (!comment || event.type !== 'create') {
      return Response.json({ message: 'Not a create event' }, { status: 200 });
    }

    console.log('[AUTOMATION] New comment created:', comment.id);

    // קבלת פרטי המגיב
    const commenterProfile = await base44.asServiceRole.entities.UserPublicProfile.filter({ email: comment.created_by }).then(p => p[0]);
    const commenterName = commenterProfile?.fullName || 'User';
    const commenterUser = await base44.asServiceRole.entities.User.filter({ email: comment.created_by }).then(u => u[0]);

    let recipientUserIds = [];
    let notificationTitle = '';
    let notificationMessage = '';
    let actionUrl = '';

    // אם זו תגובה על הצעה
    if (comment.rootEntityType === 'suggestion') {
      const suggestion = await base44.asServiceRole.entities.Suggestion.filter({ id: comment.rootEntityId }).then(s => s[0]);
      if (!suggestion) {
        console.log('[AUTOMATION] Suggestion not found');
        return Response.json({ message: 'Suggestion not found' }, { status: 200 });
      }

      // התראה ליוצר ההצעה (אם המגיב לא הוא)
      const creatorUser = await base44.asServiceRole.entities.User.filter({ email: suggestion.created_by }).then(u => u[0]);
      if (creatorUser && creatorUser.id !== commenterUser?.id) {
        recipientUserIds.push(creatorUser.id);
      }

      // אם זו תשובה לתגובה אחרת, שלח התראה גם ליוצר התגובה המקורית
      if (comment.parentCommentId) {
        const parentComment = await base44.asServiceRole.entities.Comment.filter({ id: comment.parentCommentId }).then(c => c[0]);
        if (parentComment) {
          const parentCommenterUser = await base44.asServiceRole.entities.User.filter({ email: parentComment.created_by }).then(u => u[0]);
          if (parentCommenterUser && parentCommenterUser.id !== commenterUser?.id && !recipientUserIds.includes(parentCommenterUser.id)) {
            recipientUserIds.push(parentCommenterUser.id);
            notificationTitle = 'תשובה לתגובה שלך';
            notificationMessage = `${commenterName} השיב לתגובה שלך`;
          }
        }
      }

      if (!comment.parentCommentId) {
        notificationTitle = 'תגובה חדשה על ההצעה שלך';
        notificationMessage = `${commenterName} הגיב על ההצעה שלך`;
      }

      actionUrl = `/suggestiondetail?id=${suggestion.id}#comment-${comment.id}`;
    }

    // אם זו תגובה על סעיף
    if (comment.rootEntityType === 'section') {
      const section = await base44.asServiceRole.entities.Section.filter({ id: comment.rootEntityId }).then(s => s[0]);
      if (!section) {
        console.log('[AUTOMATION] Section not found');
        return Response.json({ message: 'Section not found' }, { status: 200 });
      }

      // התראה לעורך האחרון של הסעיף (אם המגיב לא הוא)
      if (section.lastEditedBy && section.lastEditedBy !== commenterUser?.id) {
        recipientUserIds.push(section.lastEditedBy);
      }

      // אם זו תשובה לתגובה אחרת
      if (comment.parentCommentId) {
        const parentComment = await base44.asServiceRole.entities.Comment.filter({ id: comment.parentCommentId }).then(c => c[0]);
        if (parentComment) {
          const parentCommenterUser = await base44.asServiceRole.entities.User.filter({ email: parentComment.created_by }).then(u => u[0]);
          if (parentCommenterUser && parentCommenterUser.id !== commenterUser?.id && !recipientUserIds.includes(parentCommenterUser.id)) {
            recipientUserIds.push(parentCommenterUser.id);
            notificationTitle = 'תשובה לתגובה שלך';
            notificationMessage = `${commenterName} השיב לתגובה שלך`;
          }
        }
      }

      if (!comment.parentCommentId) {
        notificationTitle = 'תגובה חדשה על הסעיף שלך';
        notificationMessage = `${commenterName} הגיב על הסעיף שלך`;
      }

      const document = await base44.asServiceRole.entities.Document.filter({ id: section.documentId }).then(d => d[0]);
      actionUrl = `/document-view?id=${section.documentId}#section-${section.id}`;
    }

    // יצירת התראות
    const notifications = recipientUserIds.map(userId => ({
      userId,
      type: comment.parentCommentId ? 'reply_to_my_comment' : 'section_comment',
      title: notificationTitle,
      message: notificationMessage,
      relatedEntityId: comment.id,
      relatedEntityType: 'comment',
      actionUrl
    }));

    if (notifications.length > 0) {
      await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
      console.log(`[AUTOMATION] Created ${notifications.length} comment notifications`);
    }

    return Response.json({ success: true, notificationsSent: notifications.length });
  } catch (error) {
    console.error('[AUTOMATION ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});