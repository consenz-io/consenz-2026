import React, { useEffect, useState } from 'react';

/**
 * Screen reader announcer for dynamic content updates
 * Compliant with WCAG 2.1 Level AA
 */
export function AccessibilityAnnouncer() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    // Listen for custom accessibility announcement events
    const handleAnnouncement = (event) => {
      const { message, priority = 'polite' } = event.detail;
      setMessages(prev => [...prev, { message, priority, id: Date.now() }]);
      
      // Clear message after announcement
      setTimeout(() => {
        setMessages(prev => prev.filter(m => m.id !== event.detail.id));
      }, 1000);
    };

    window.addEventListener('announce-to-screen-reader', handleAnnouncement);
    return () => window.removeEventListener('announce-to-screen-reader', handleAnnouncement);
  }, []);

  return (
    <>
      {/* Polite announcements - wait for user to finish current task */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {messages.filter(m => m.priority === 'polite').map(m => (
          <p key={m.id}>{m.message}</p>
        ))}
      </div>
      
      {/* Assertive announcements - interrupt immediately for important updates */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {messages.filter(m => m.priority === 'assertive').map(m => (
          <p key={m.id}>{m.message}</p>
        ))}
      </div>
    </>
  );
}

/**
 * Utility function to announce messages to screen readers
 * @param {string} message - The message to announce
 * @param {string} priority - 'polite' or 'assertive'
 */
export function announceToScreenReader(message, priority = 'polite') {
  const event = new CustomEvent('announce-to-screen-reader', {
    detail: { message, priority, id: Date.now() }
  });
  window.dispatchEvent(event);
}