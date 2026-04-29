import { base44 } from "@/api/base44Client";

/**
 * Validate and sanitize action URL
 */
export function validateActionUrl(url) {
  if (!url || typeof url !== 'string' || url.length === 0) {
    return null;
  }
  
  // Remove any whitespace
  const cleaned = url.trim();
  
  // Check if it's a valid URL format (starts with / or http)
  if (!cleaned.startsWith('/') && !cleaned.startsWith('http')) {
    console.warn('[NOTIFICATION] Invalid actionUrl format:', cleaned);
    return null;
  }
  
  return cleaned;
}

/**
 * Send notifications via backend function (async, non-blocking)
 */
export async function sendNotificationsBatch(notifications) {
  if (!notifications || notifications.length === 0) {
    console.log('[SEND BATCH] No notifications to send');
    return { successful: 0, failed: 0 };
  }
  
  console.log('[SEND BATCH] Sending', notifications.length, 'notifications directly to DB...');
  
  let successful = 0;
  let failed = 0;
  
  for (const notif of notifications) {
    try {
      await base44.entities.Notification.create({
        userId: notif.userId,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        translations: notif.translations || {},
        relatedEntityId: notif.relatedEntityId,
        relatedEntityType: notif.relatedEntityType,
        actionUrl: notif.actionUrl,
        read: false
      });
      successful++;
    } catch (err) {
      console.error('[SEND BATCH] Failed to create notification for user', notif.userId, ':', err.message);
      failed++;
    }
  }
  
  console.log(`[SEND BATCH] ✓ ${successful} sent, ${failed} failed`);
  return { successful, failed };
}

/**
 * Deduplicate notifications - remove duplicates by userId + type + relatedEntityId
 */
export function deduplicateNotifications(notifications) {
  const seen = new Set();
  const unique = [];
  
  for (const notif of notifications) {
    const key = `${notif.userId}-${notif.type}-${notif.relatedEntityId}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(notif);
    }
  }
  
  if (unique.length < notifications.length) {
    console.log('[DEDUPLICATE] Removed', notifications.length - unique.length, 'duplicate notifications');
  }
  
  return unique;
}

/**
 * Sanitize notification message - limit length and remove sensitive data
 */
export function sanitizeMessage(message, maxLength = 150) {
  if (!message || typeof message !== 'string') return '';
  
  let sanitized = message.trim();
  
  // Limit length for browser notifications
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength - 3) + '...';
  }
  
  return sanitized;
}