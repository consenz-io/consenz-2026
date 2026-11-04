import React from "react";
import { useLanguage } from "@/components/LanguageContext";

/**
 * Side-by-side of the user's own draft and the wording that already exists in
 * the document, so the similarity is visible without opening anything.
 */
export default function SimilarComparison({ yourText, existingText, existingLabel }) {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-2.5 space-y-1 min-w-0">
        <p className="text-xs font-semibold text-blue-900">{t("similarYourProposal")}</p>
        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed line-clamp-4" dir="auto">
          {yourText}
        </p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-1 min-w-0">
        <p className="text-xs font-semibold text-slate-700">{existingLabel}</p>
        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed line-clamp-4" dir="auto">
          {existingText}
        </p>
      </div>
    </div>
  );
}