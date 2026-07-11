import React, { useState, useEffect, useRef } from "react";

/**
 * Lazy-mount wrapper for heavy section components.
 *
 * Uses IntersectionObserver to defer mounting children until they are near
 * the viewport. This achieves the same performance benefit as list virtualization
 * (react-virtuoso) — only visible sections are fully mounted — while remaining
 * compatible with the drag-and-drop context (@hello-pangea/dnd) that wraps sections.
 *
 * Once a section becomes visible, it stays mounted (the observer disconnects)
 * to preserve internal state and avoid remounting on scroll-back.
 *
 * Props:
 *   forceMount   — if true, children render immediately (e.g. scroll target)
 *   estimatedHeight — placeholder height before mounting (px)
 *   rootMargin   — IntersectionObserver rootMargin (how early to pre-mount)
 */
const LazySection = React.memo(function LazySection({
  children,
  forceMount = false,
  estimatedHeight = 250,
  rootMargin = '300px',
}) {
  const [isVisible, setIsVisible] = useState(forceMount);
  const ref = useRef(null);

  useEffect(() => {
    if (forceMount || isVisible) return;

    const el = ref.current;
    if (!el) return;

    // If IntersectionObserver isn't available (older browsers), just render
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [forceMount, isVisible, rootMargin]);

  // If forceMount changes to true after initial render, mount immediately
  useEffect(() => {
    if (forceMount && !isVisible) setIsVisible(true);
  }, [forceMount, isVisible]);

  if (!isVisible) {
    return <div ref={ref} style={{ minHeight: estimatedHeight }} aria-busy="true" />;
  }

  return <div ref={ref}>{children}</div>;
});

export default LazySection;