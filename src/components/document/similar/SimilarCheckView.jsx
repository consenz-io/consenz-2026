import React from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/LanguageContext";

export default function SimilarCheckView({ slow, failed, onContinue }) {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        {failed ? (
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" aria-hidden="true" />
        ) : (
          <Loader2 className="w-5 h-5 animate-spin text-blue-600 mt-0.5 shrink-0" aria-hidden="true" />
        )}
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">{t("similarCheckTitle")}</h2>
          <p className="text-sm text-slate-600">{t("similarCheckBody")}</p>
        </div>
      </div>

      {/* Placeholder cards keep the window stable when results replace the check. */}
      {!failed && (
        <div className="space-y-3" aria-hidden="true">
          {[0, 1].map((row) => (
            <div key={row} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 animate-pulse">
              <div className="h-4 w-24 rounded bg-slate-200" />
              <div className="h-3 w-full rounded bg-slate-100" />
              <div className="h-3 w-2/3 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      )}

      {failed && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
          {t("similarCheckFailed")}
        </p>
      )}

      {slow && !failed && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
          {t("similarCheckSlow")}
        </p>
      )}

      {(slow || failed) && (
        <Button variant="outline" onClick={onContinue} className="w-full sm:w-auto">
          {t("similarContinuePublishing")}
        </Button>
      )}
    </div>
  );
}