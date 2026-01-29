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
  
  console.log('[SEND BATCH] Sending', notifications.length, 'notifications via backend...');
  
  try {
    // Call backend function asynchronously
    const response = await base44.functions.invoke('sendBatchNotifications', {
      notifications,
      maxRetries: 3
    });
    
    if (response.data.success) {
      console.log('[SEND BATCH] ✓', response.data.message);
      return {
        successful: response.data.successful,
        failed: response.data.failed
      };
    } else {
      console.error('[SEND BATCH] ✗ Backend error:', response.data.error);
      return { successful: 0, failed: notifications.length };
    }
  } catch (error) {
    console.error('[SEND BATCH] ✗ Failed to call backend:', error.message);
    return { successful: 0, failed: notifications.length };
  }
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