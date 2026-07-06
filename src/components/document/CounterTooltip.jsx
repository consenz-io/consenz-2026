import React from "react";

/**
 * Lightweight CSS-only tooltip wrapper for document counter cards.
 * Matches the existing inline tooltip style used by the "open suggestions" nudge.
 *
 * Usage:
 *   <CounterTooltip text="…">
 *     <button>…</button>
 *   </CounterTooltip>
 */
export default function CounterTooltip({ text, children }) {
  if (!text) return children;
  return (
    <div className="relative group/tip">
      {children}
      <div className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 bg-slate-800 text-white text-xs rounded-lg px-3 py-2.5 shadow-xl opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity duration-200 text-center leading-relaxed">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
      </div>
    </div>
  );
}