import React from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/LanguageContext";

export default function SimilarCheckView({ slow, failed, onContinue }) {
  const { t } = useLanguage();

  return (
    <div className="py-6 space-y-4 text-center">
      {failed ? (
        <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" aria-hidden="true" />
      ) : (
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" aria-hidden="true" />
      )}

      <div>
        <p className="font-semibold text-slate-900">{t("similarCheckTitle")}</p>
        <p className="text-sm text-slate-600 mt-1">{t("similarCheckBody")}</p>
      </div>

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