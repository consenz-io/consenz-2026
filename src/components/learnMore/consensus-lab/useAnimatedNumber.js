import { useEffect, useState } from "react";

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Counts from `from` to `to` once, on mount. The demo re-mounts on every stage,
 * so a step change reads as the number moving to its new value instead of
 * jumping — and the bars beside it grow on the same timing.
 */
export default function useAnimatedNumber(from, to, duration = 900) {
  const [value, setValue] = useState(() => (reducedMotion() ? to : from));

  useEffect(() => {
    if (reducedMotion() || from === to) {
      setValue(to);
      return undefined;
    }

    let frame;
    const started = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (to - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [from, to, duration]);

  return value;
}