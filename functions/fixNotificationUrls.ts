/**
 * Fix Notification URLs
 * 
 * This function fixes incorrect URLs in existing notifications
 * Specifically fixes "suggestiondetail" to "suggestion-detail"
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin authentication
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[FIX NOTIFICATION URLS] Starting...');

    // Fetch all notifications
    const allNotifications = await base44.asServiceRole.entities.Notification.list();
    console.log('[FIX NOTIFICATION URLS] Found', allNotifications.length, 'notifications');

    let fixedCount = 0;
    const updates = [];

    for (const notification of allNotifications) {
      if (!notification.actionUrl) continue;

      let newUrl = notification.actionUrl;
      let needsUpdate = false;

      // Fix 1: suggestiondetail -> suggestion-detail
      if (newUrl.includes('suggestiondetail')) {
        newUrl = newUrl.replace(/suggestiondetail/g, 'suggestion-detail');
        needsUpdate = true;
      }

      // Fix 2: SuggestionDetail -> suggestion-detail
      if (newUrl.includes('SuggestionDetail')) {
        newUrl = newUrl.replace(/SuggestionDetail/g, 'suggestion-detail');
        needsUpdate = true;
      }

      // Fix 3: suggestion-Detail -> suggestion-detail
      if (newUrl.includes('suggestion-Detail')) {
        newUrl = newUrl.replace(/suggestion-Detail/g, 'suggestion-detail');
        needsUpdate = true;
      }

      if (needsUpdate) {
        updates.push({
          id: notification.id,
          oldUrl: notification.actionUrl,
          newUrl: newUrl
        });

        await base44.asServiceRole.entities.Notification.update(notification.id, {
          actionUrl: newUrl
        });

        fixedCount++;
      }
    }

    // Also fix EmailDigest entries
    const allDigests = await base44.asServiceRole.entities.EmailDigest.list();
    console.log('[FIX NOTIFICATION URLS] Found', allDigests.length, 'email digests');

    let fixedDigestsCount = 0;

    for (const digest of allDigests) {
      if (!digest.actionUrl) continue;

      let newUrl = digest.actionUrl;
      let needsUpdate = false;

      if (newUrl.includes('suggestiondetail')) {
        newUrl = newUrl.replace(/suggestiondetail/g, 'suggestion-detail');
        needsUpdate = true;
      }

      if (newUrl.includes('SuggestionDetail')) {
        newUrl = newUrl.replace(/SuggestionDetail/g, 'suggestion-detail');
        needsUpdate = true;
      }

      if (newUrl.includes('suggestion-Detail')) {
        newUrl = newUrl.replace(/suggestion-Detail/g, 'suggestion-detail');
        needsUpdate = true;
      }

      if (needsUpdate) {
        await base44.asServiceRole.entities.EmailDigest.update(digest.id, {
          actionUrl: newUrl
        });

        fixedDigestsCount++;
      }
    }

    console.log('[FIX NOTIFICATION URLS] Fixed', fixedCount, 'notifications');
    console.log('[FIX NOTIFICATION URLS] Fixed', fixedDigestsCount, 'email digests');

    return Response.json({
      success: true,
      message: 'Fixed notification URLs',
      notificationsFixed: fixedCount,
      emailDigestsFixed: fixedDigestsCount,
      updates: updates,
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error) {
    console.error('[FIX NOTIFICATION URLS] Error:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
});