/**
 * Scrolls the page so the tutorial tooltip bubble is fully visible in the viewport.
 * Call this AFTER the bubble has been positioned and rendered in the DOM.
 * Only scrolls if the bubble is partially or fully outside the visible area.
 *
 * Uses the ACTUAL header height (measured from the DOM) instead of a hardcoded
 * estimate, and re-checks once after the smooth scroll settles so that a bubble
 * that was repositioned by the scroll handler gets a second chance to be brought
 * into view.
 */
export function scrollBubbleIntoView() {
  const bubble = document.querySelector('.tutorial-highlight-bubble');
  if (!bubble) return;

  const rect = bubble.getBoundingClientRect();

  const header = document.querySelector('header[role="banner"]');
  const headerHeight = header ? header.getBoundingClientRect().height : 72;
  const margin = 24;

  let scrollAdjust = 0;
  if (rect.top < headerHeight) {
    // Bubble is too close to the top (hidden behind header)
    scrollAdjust = rect.top - headerHeight - margin;
  } else if (rect.bottom > window.innerHeight - margin) {
    // Bubble extends below the viewport
    scrollAdjust = rect.bottom - (window.innerHeight - margin);
  }

  if (scrollAdjust !== 0) {
    const newTop = Math.max(0, window.scrollY + scrollAdjust);
    window.scrollTo({ top: newTop, behavior: 'smooth' });

    // After the smooth scroll settles, the scroll handler repositions the
    // (fixed) bubble. Re-check once: if the bubble is STILL off-screen after
    // repositioning, scroll again to bring it into view.
    setTimeout(() => {
      const bubble2 = document.querySelector('.tutorial-highlight-bubble');
      if (!bubble2) return;
      const r = bubble2.getBoundingClientRect();
      const h = document.querySelector('header[role="banner"]');
      const hh = h ? h.getBoundingClientRect().height : 72;
      let adj = 0;
      if (r.top < hh) {
        adj = r.top - hh - margin;
      } else if (r.bottom > window.innerHeight - margin) {
        adj = r.bottom - (window.innerHeight - margin);
      }
      if (adj !== 0) {
        window.scrollTo({ top: Math.max(0, window.scrollY + adj), behavior: 'smooth' });
      }
    }, 350);
  }
}

/**
 * Wait for a smooth scroll to settle, then call a callback.
 * Polls the target element's position until it stops moving.
 * Returns a cancel function.
 */
export function waitForScrollSettle(el, callback, maxWait = 3000) {
  let lastTop = null;
  let stableCount = 0;
  const startTime = Date.now();
  let timerId = null;

  const tick = () => {
    if (Date.now() - startTime > maxWait) {
      callback();
      return;
    }
    const top = el.getBoundingClientRect().top;
    if (lastTop !== null && Math.abs(top - lastTop) < 1) {
      stableCount += 1;
    } else {
      stableCount = 0;
    }
    lastTop = top;
    if (stableCount >= 2) {
      callback();
      return;
    }
    timerId = setTimeout(tick, 60);
  };
  timerId = setTimeout(tick, 60);

  return () => clearTimeout(timerId);
}