import React from "react";

/**
 * The wording that already exists in the document (a section or an open edit
 * proposal), shown on its own — no side-by-side with the user's draft.
 */
export default function ExistingItemBlock({ label, text }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-1 min-w-0">
      <p className="text-xs font-semibold text-slate-700">{label}</p>
      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed line-clamp-6" dir="auto">
        {text}
      </p>
    </div>
  );
}