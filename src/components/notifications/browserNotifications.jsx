/**
 * Browser Push Notifications Service
 * Manages requesting permissions and showing browser notifications
 */

let permissionGranted = false;

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('[BROWSER NOTIFICATION] Not supported in this browser');
    return false;
  }

  if (Notification.permission === 'granted') {
    permissionGranted = true;
    return true;
  }

  if (Notification.permission === 'denied') {
    console.warn('[BROWSER NOTIFICATION] Permission denied by user');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    permissionGranted = permission === 'granted';
    console.log('[BROWSER NOTIFICATION] Permission:', permission);
    return permissionGranted;
  } catch (error) {
    console.error('[BROWSER NOTIFICATION] Error requesting permission:', error);
    return false;
  }
}

/**
 * Check if notifications are supported and permission is granted
 */
export function canShowNotification() {
  return 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Show a browser notification
 * @param {string} title - Notification title
 * @param {string} body - Notification body text
 * @param {string} actionUrl - URL to navigate to on click (optional)
 * @param {string} icon - Icon URL (optional)
 */
export function showBrowserNotification({ title, body, actionUrl, icon }) {
  if (!canShowNotification()) {
    console.log('[BROWSER NOTIFICATION] Cannot show notification - permission not granted or not supported');
    return null;
  }

  // Check if page is already focused - don't show notification if user is on the page
  if (!document.hidden) {
    console.log('[BROWSER NOTIFICATION] Page is focused, skipping notification');
    return null;
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: icon || '/favicon.ico',
      badge: '/favicon.ico',
      tag: actionUrl || 'consenz-notification', // Prevents duplicate notifications
      requireInteraction: false,
      silent: false,
      vibrate: [200, 100, 200], // Vibration pattern for mobile devices
      timestamp: Date.now(),
    });

    // Handle notification click
    if (actionUrl) {
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        window.location.href = actionUrl;
        notification.close();
      };
    }

    // Auto-close after 10 seconds
    setTimeout(() => {
      notification.close();
    }, 10000);

    console.log('[BROWSER NOTIFICATION] Notification shown:', title);
    return notification;
  } catch (error) {
    console.error('[BROWSER NOTIFICATION] Error showing notification:', error);
    return null;
  }
}

/**
 * Initialize browser notifications - request permission on first load
 */
export async function initBrowserNotifications() {
  // Check if user has already been asked
  const askedBefore = localStorage.getItem('consenz_notification_asked');
  
  if (!askedBefore && 'Notification' in window && Notification.permission === 'default') {
    // Wait a bit before asking (better UX)
    setTimeout(async () => {
      const granted = await requestNotificationPermission();
      localStorage.setItem('consenz_notification_asked', 'true');
      
      if (granted) {
        console.log('[BROWSER NOTIFICATION] User granted permission');
        // Show a welcome notification
        showBrowserNotification({
          title: 'התראות מופעלות ✓',
          body: 'תקבל התראות על פעילויות חדשות במסמכים שאתה עוקב אחריהם',
        });
      }
    }, 3000); // Wait 3 seconds after page load
  } else if (Notification.permission === 'granted') {
    permissionGranted = true;
  }
}