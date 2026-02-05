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

    // OPTIMIZED: Fetch all data in parallel
    console.log('[SUGGESTION AUTOMATION] Fetching data in parallel...');
    const [documents, interactions, creatorProfiles] = await Promise.all([
      base44.asServiceRole.entities.Document.filter({ id: suggestion.documentId }),
      base44.asServiceRole.entities.UserInteraction.filter({ documentId: suggestion.documentId }),
      base44.asServiceRole.entities.UserPublicProfile.filter({ email: suggestion.created_by })
    ]);
    
    const document = documents[0];
    if (!document) {
      console.error('[SUGGESTION AUTOMATION] ❌ Document not found:', suggestion.documentId);
      return Response.json({ message: 'Document not found' }, { status: 404 });
    }
    
    console.log('[SUGGESTION AUTOMATION] ✅ Document found:', document.title);
    console.log('[SUGGESTION AUTOMATION] Total interactions:', interactions.length);

    // OPTIMIZED: Extract unique users more efficiently
    const uniqueUserIds = [...new Set(interactions.map(i => i.userId))].filter(uid => uid !== suggestion.created_by);
    console.log('[SUGGESTION AUTOMATION] Unique users to notify (excluding creator):', uniqueUserIds.length);

    const creatorProfile = creatorProfiles[0];
    const creatorName = creatorProfile?.fullName || 'User';
    console.log('[SUGGESTION AUTOMATION] Creator:', creatorName);

    // OPTIMIZED: Batch notifications - skip if no users to notify
    if (uniqueUserIds.length === 0) {
      console.log('[SUGGESTION AUTOMATION] ⏭️ No users to notify, skipping notification creation');
    } else {
      console.log('[SUGGESTION AUTOMATION] Preparing', uniqueUserIds.length, 'notifications...');
      
      // Build notification type and messages
      const isEditSuggestion = suggestion.type === 'edit_suggestion';
      const notificationType = isEditSuggestion ? 'reply_to_my_suggestion' : 'vote_on_suggestion';
      const title = isEditSuggestion 
        ? `הצעה לעריכת הצעה מאת ${creatorName}`
        : `הצעה חדשה במסמך "${document.title}"`;
      const message = `${creatorName} ${isEditSuggestion ? 'הציע עריכה להצעה' : 'הוסיף הצעה חדשה'} במסמך "${document.title}"`;
      
      // Create notifications array
      const notifications = uniqueUserIds.map(userId => ({
        userId,
        type: notificationType,
        title,
        message,
        relatedEntityId: suggestion.id,
        relatedEntityType: 'suggestion',
        actionUrl: `/suggestiondetail?id=${suggestion.id}`
      }));

      try {
        await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
        console.log('[SUGGESTION AUTOMATION] ✅ Created', notifications.length, 'notifications successfully');
      } catch (notifError) {
        console.error('[SUGGESTION AUTOMATION] ⚠️ Notification error (non-critical):', notifError.message);
        // Don't fail the entire request if notifications fail
      }
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
    console.error('[SUGGESTION AUTOMATION] ❌ CRITICAL ERROR:', error.message);
    console.error('[SUGGESTION AUTOMATION] Error stack:', error.stack);
    console.error('[SUGGESTION AUTOMATION] Error name:', error.name);
    console.error('[SUGGESTION AUTOMATION] Duration before error:', duration, 'ms');
    console.error('[SUGGESTION AUTOMATION] Suggestion data:', {
      id: suggestion?.id,
      documentId: suggestion?.documentId,
      type: suggestion?.type,
      created_by: suggestion?.created_by
    });
    console.error('[SUGGESTION AUTOMATION] ===== END (ERROR) =====');
    
    // Return appropriate status code
    const statusCode = error.message?.includes('not found') ? 404 : 500;
    
    return Response.json({ 
      error: error.message,
      errorType: error.name,
      duration,
      suggestionId: suggestion?.id
    }, { status: statusCode });
  }
});