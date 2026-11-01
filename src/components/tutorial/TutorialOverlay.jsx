import React, { useEffect, useState } from 'react';

// Extra breathing room around a spotlight so the target's blue outline and its
// glow/ring animations are not clipped by the scrim edge.
const HOLE_PADDING = 10;

function rectOf(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return {
    x: r.left - HOLE_PADDING,
    y: r.top - HOLE_PADDING,
    w: r.width + HOLE_PADDING * 2,
    h: r.height + HOLE_PADDING * 2,
  };
}

/**
 * Renders the dark scrim with true cut-outs over the spotlight targets.
 *
 * The scrim is a full-viewport SVG whose mask punches holes exactly on the
 * target elements (and any `additionalSpotlights`). Unlike raising the target's
 * z-index, a cut-out also reveals targets that live inside a lower stacking
 * context — sticky headers (`z-30`), fixed bars (`z-50`) — which the z-index
 * trick could never lift above the scrim.
 */
export default function TutorialOverlay({ targetSelector, additionalSpotlights = [], children }) {
  const [holes, setHoles] = useState([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const spotlightsKey = [targetSelector, ...additionalSpotlights].filter(Boolean).join('|');

  useEffect(() => {
    // Inject pulse keyframes once
    if (!document.getElementById('tutorial-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'tutorial-pulse-style';
      style.textContent = `
        @keyframes tutorial-pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(59,130,246,0.7); }
          70%  { box-shadow: 0 0 0 10px rgba(59,130,246,0); }
          100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
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
    const selectors = spotlightsKey.split('|').filter(Boolean);
    let lastKey = '';

    function update() {
      const rects = selectors.map(rectOf).filter(Boolean);
      const nextSize = { w: window.innerWidth, h: window.innerHeight };
      // Skip state updates when nothing moved — avoids re-rendering the
      // tooltip on every poll tick.
      const key = JSON.stringify({ rects, w: nextSize.w, h: nextSize.h });
      if (key === lastKey) return;
      lastKey = key;
      setHoles(rects);
      setSize(nextSize);
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
    };
  }, [spotlightsKey]);

  const maskId = 'tutorial-spotlight-mask';

  return (
    <>
      {holes.length === 0 ? (
        // No target resolved yet — dim everything.
        <div
          className="fixed inset-0 z-[10000] pointer-events-none bg-black/60"
          aria-hidden="true"
        />
      ) : (
        <svg
          className="fixed inset-0 z-[10000] pointer-events-none"
          width={size.w || '100%'}
          height={size.h || '100%'}
          aria-hidden="true"
        >
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={size.w} height={size.h}>
              <rect x="0" y="0" width={size.w} height={size.h} fill="white" />
              {holes.map((h, i) => (
                <rect
                  key={i}
                  x={h.x}
                  y={h.y}
                  width={h.w}
                  height={h.h}
                  rx="8"
                  ry="8"
                  fill="black"
                />
              ))}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width={size.w}
            height={size.h}
            fill="rgba(0,0,0,0.6)"
            mask={`url(#${maskId})`}
          />
        </svg>
      )}
      {/* Tooltip and other interactive content */}
      {children}
    </>
  );
}