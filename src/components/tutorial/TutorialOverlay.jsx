import React, { useEffect, useState, useRef } from 'react';

/**
 * Renders the dark scrim with a spotlight cutout on the target element.
 * Uses box-shadow trick: the TARGET element gets the huge inset shadow,
 * which paints the scrim. The scrim div itself is pointer-events-none.
 */
export default function TutorialOverlay({ targetSelector, additionalSpotlights = [], children }) {
  const [targetRect, setTargetRect] = useState(null);
  const styleRef = useRef(null);

  useEffect(() => {
    // Inject pulse keyframes once
    if (!document.getElementById('tutorial-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'tutorial-pulse-style';
      style.textContent = `
        @keyframes tutorial-pulse-ring {
          0%   { box-shadow: 0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 0 rgba(59,130,246,0.7); }
          70%  { box-shadow: 0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 10px rgba(59,130,246,0); }
          100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 0 rgba(59,130,246,0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .tutorial-spotlight-pulse {
            animation: none !important;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    let frame;

    function update() {
      const el = document.querySelector(targetSelector);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    }

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    // Poll for element availability (in case it renders after mount)
    const interval = setInterval(update, 300);

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      clearInterval(interval);
      cancelAnimationFrame(frame);
    };
  }, [targetSelector]);

  useEffect(() => {
    // Apply spotlight box-shadow directly to target element
    const el = document.querySelector(targetSelector);
    if (!el || !targetRect) return;

    const computedRadius = window.getComputedStyle(el).borderRadius || '8px';
    el.style.position = 'relative';
    el.style.zIndex = '10001';
    el.style.borderRadius = computedRadius;
    el.style.boxShadow = `0 0 0 9999px rgba(0,0,0,0.6)`;

    // Additional spotlight elements (raised z-index only, no shadow)
    const additionalEls = additionalSpotlights
      .map(sel => document.querySelector(sel))
      .filter(Boolean);
    additionalEls.forEach(aEl => {
      aEl.style.position = 'relative';
      aEl.style.zIndex = '10001';
    });

    return () => {
      el.style.position = '';
      el.style.zIndex = '';
      el.style.boxShadow = '';
      additionalEls.forEach(aEl => {
        aEl.style.position = '';
        aEl.style.zIndex = '';
      });
    };
  }, [targetSelector, targetRect, additionalSpotlights]);

  return (
    <>
      {/* Scrim — pointer-events-none so clicks pass through to tooltip/target */}
      <div
        className="fixed inset-0 z-[10000] pointer-events-none"
        aria-hidden="true"
      />
      {/* Tooltip and other interactive content */}
      {children}
    </>
  );
}