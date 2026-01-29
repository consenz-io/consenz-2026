import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Backend function for sending batch notifications
 * Called asynchronously to avoid blocking the main UI thread
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Parse the payload
    const { notifications, maxRetries = 3 } = await req.json();
    
    if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
      return Response.json({ 
        success: false, 
        error: 'No notifications provided' 
      }, { status: 400 });
    }
    
    console.log('[BATCH NOTIFICATIONS] Starting batch of', notifications.length, 'notifications');
    
    const results = [];
    const failed = [];
    
    // Process notifications with delay to avoid rate limits
    for (let i = 0; i < notifications.length; i++) {
      const notification = notifications[i];
      
      // Add delay between notifications (except first)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second between each
      }
      
      let retries = 0;
      let success = false;
      
      // Retry logic
      while (retries < maxRetries && !success) {
        try {
          // Create notification in DB
          const created = await base44.asServiceRole.entities.Notification.create({
            ...notification,
            read: false
          });
          
          console.log(`[BATCH NOTIFICATIONS] ✓ Created ${i + 1}/${notifications.length}`);
          results.push(created);
          success = true;
          
          // Add to email digest
          if (notification.documentId && notification.documentTitle) {
            try {
              await base44.asServiceRole.entities.EmailDigest.create({
                userId: notification.userId,
                notificationType: notification.type,
                title: notification.title,
                message: notification.message,
                actionUrl: notification.actionUrl,
                relatedEntityType: notification.relatedEntityType,
                relatedEntityId: notification.relatedEntityId,
                documentId: notification.documentId,
                documentTitle: notification.documentTitle,
                isIncludedInDigest: false
              });
            } catch (digestErr) {
              console.error('[BATCH NOTIFICATIONS] Email digest error:', digestErr.message);
              // Don't fail the whole operation if digest fails
            }
          }
          
        } catch (err) {
          retries++;
          console.error(`[BATCH NOTIFICATIONS] ✗ Failed ${i + 1}/${notifications.length} (attempt ${retries}/${maxRetries}):`, err.message);
          
          if (retries >= maxRetries) {
            failed.push({
              notification,
              error: err.message,
              index: i
            });
          } else {
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
          }
        }
      }
    }
    
    console.log('[BATCH NOTIFICATIONS] Complete:', results.length, 'successful,', failed.length, 'failed');
    
    return Response.json({
      success: true,
      successful: results.length,
      failed: failed.length,
      failedDetails: failed.length > 0 ? failed : undefined,
      message: `Sent ${results.length}/${notifications.length} notifications`
    });
    
  } catch (error) {
    console.error('[BATCH NOTIFICATIONS] Critical error:', error.message);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});