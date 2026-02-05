import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const startTime = Date.now();
  console.log('[SUGGESTION AUTOMATION] ===== START =====');
  console.log('[SUGGESTION AUTOMATION] Timestamp:', new Date().toISOString());
  
  try {
    const base44 = createClientFromRequest(req);
    const { event, data: suggestion } = await req.json();

    console.log('[SUGGESTION AUTOMATION] Event type:', event?.type);
    console.log('[SUGGESTION AUTOMATION] Suggestion data received:', {
      id: suggestion?.id,
      documentId: suggestion?.documentId,
      type: suggestion?.type,
      created_by: suggestion?.created_by,
      title: suggestion?.title
    });

    if (!suggestion || event.type !== 'create') {
      console.log('[SUGGESTION AUTOMATION] ⏭️ Skipping - not a create event');
      return Response.json({ message: 'Not a create event' }, { status: 200 });
    }

    console.log('[SUGGESTION AUTOMATION] ✅ Processing new suggestion:', suggestion.id);

    // שליחת התראה למשתתפים במסמך
    console.log('[SUGGESTION AUTOMATION] Fetching document:', suggestion.documentId);
    const document = await base44.asServiceRole.entities.Document.filter({ id: suggestion.documentId }).then(d => d[0]);
    
    if (!document) {
      console.error('[SUGGESTION AUTOMATION] ❌ Document not found:', suggestion.documentId);
      return Response.json({ message: 'Document not found' }, { status: 200 });
    }
    
    console.log('[SUGGESTION AUTOMATION] ✅ Document found:', document.title);

    // קבלת כל המשתתפים במסמך (למעט יוצר ההצעה)
    console.log('[SUGGESTION AUTOMATION] Fetching user interactions...');
    const interactions = await base44.asServiceRole.entities.UserInteraction.filter({ documentId: document.id });
    console.log('[SUGGESTION AUTOMATION] Total interactions:', interactions.length);
    
    const uniqueUserIds = [...new Set(interactions.map(i => i.userId))].filter(uid => uid !== suggestion.created_by);
    console.log('[SUGGESTION AUTOMATION] Unique users to notify (excluding creator):', uniqueUserIds.length);

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
      actionUrl: `/suggestiondetail?id=${suggestion.id}`
    }));

    if (notifications.length > 0) {
      console.log('[SUGGESTION AUTOMATION] Creating', notifications.length, 'notifications...');
      await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
      console.log('[SUGGESTION AUTOMATION] ✅ Notifications created successfully');
    } else {
      console.log('[SUGGESTION AUTOMATION] No notifications to create');
    }

    const duration = Date.now() - startTime;
    console.log('[SUGGESTION AUTOMATION] ✅ Completed successfully');
    console.log('[SUGGESTION AUTOMATION] Duration:', duration, 'ms');
    console.log('[SUGGESTION AUTOMATION] Notifications sent:', notifications.length);
    console.log('[SUGGESTION AUTOMATION] ===== END =====');

    return Response.json({ 
      success: true, 
      notificationsSent: notifications.length,
      duration
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[SUGGESTION AUTOMATION] ❌ ERROR:', error.message);
    console.error('[SUGGESTION AUTOMATION] Error stack:', error.stack);
    console.error('[SUGGESTION AUTOMATION] Duration before error:', duration, 'ms');
    console.error('[SUGGESTION AUTOMATION] Suggestion data:', JSON.stringify(suggestion, null, 2));
    console.error('[SUGGESTION AUTOMATION] ===== END (ERROR) =====');
    
    return Response.json({ 
      error: error.message,
      duration,
      suggestionId: suggestion?.id
    }, { status: 500 });
  }
});