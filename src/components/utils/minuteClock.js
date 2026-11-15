// One shared, minute-aligned ticker for every countdown on a page.
// Previously each countdown card owned its own setInterval(60_000) that kept
// firing forever — even after its timer had already expired — re-rendering the
// card once a minute for the whole life of the tab. With N cards that is N
// live timers and N wake-ups per minute; here it is one timer, one wake-up,
// and every subscriber decides what to do with it.
const listeners = new Set();
let timer = null;

function scheduleNext() {
  // Align to the next wall-clock minute so all cards update together.
  const delay = 60_000 - (Date.now() % 60_000);
  timer = setTimeout(() => {
    timer = null;
    listeners.forEach((listener) => listener());
    if (listeners.size > 0) scheduleNext();
  }, delay);
}

/**
 * Subscribe to the shared minute tick.
 * @param {() => void} listener called at most once per minute, aligned to the boundary
 * @returns {() => void} unsubscribe
 */
export function subscribeToMinute(listener) {
  listeners.add(listener);
  if (listeners.size === 1) scheduleNext();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
}