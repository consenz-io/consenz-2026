import React, { useEffect, useRef, useState } from "react";

/**
 * Renders text on a single line. If it overflows its container,
 * the text scrolls continuously so the user can read all of it.
 */
export default function MarqueeText({ children, className = "", isRTL = false }) {
  const containerRef = useRef(null);
  const measureRef = useRef(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const check = () => {
      if (!containerRef.current || !measureRef.current) return;
      setOverflow(measureRef.current.scrollWidth > containerRef.current.clientWidth + 2);
    };
    check();
    const id = setTimeout(check, 300);
    window.addEventListener("resize", check);
    return () => {
      clearTimeout(id);
      window.removeEventListener("resize", check);
    };
  }, [children]);

  return (
    <div ref={containerRef} className={`overflow-hidden ${className}`}>
      {overflow ? (
        <div className={`marquee-track ${isRTL ? 'marquee-track-rtl' : ''}`}>
          <span className="whitespace-nowrap">{children}</span>
          <span className="whitespace-nowrap" aria-hidden="true">{children}</span>
        </div>
      ) : (
        <span ref={measureRef} className="whitespace-nowrap inline-block">{children}</span>
      )}
      {overflow && (
        <span ref={measureRef} className="whitespace-nowrap absolute opacity-0 pointer-events-none -z-10">{children}</span>
      )}
    </div>
  );
}