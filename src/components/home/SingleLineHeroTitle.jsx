import React, { useLayoutEffect, useRef } from 'react';

export default function SingleLineHeroTitle({ children }) {
  const titleRef = useRef(null);

  useLayoutEffect(() => {
    const title = titleRef.current;
    const parent = title.parentElement;
    let active = true;
    const fit = () => {
      if (!active) return;
      if (window.innerWidth >= 768) {
        title.style.fontSize = '';
        return;
      }
      title.style.fontSize = '48px';
      const textWidth = title.getBoundingClientRect().width;
      const availableWidth = parent.clientWidth;
      if (textWidth > 0 && availableWidth > 0) {
        title.style.fontSize = `${Math.min(48, 48 * (availableWidth - 1) / textWidth)}px`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(parent);
    window.addEventListener('resize', fit);
    document.fonts?.ready.then(fit);
    return () => {
      active = false;
      observer.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [children]);

  return <span ref={titleRef} className="inline-block whitespace-nowrap text-slate-900 text-xl md:text-5xl">{children}</span>;
}