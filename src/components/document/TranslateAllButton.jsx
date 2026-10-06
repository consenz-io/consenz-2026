import React from "react";
import { Button } from "@/components/ui/button";
import { Languages, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { useDocumentTranslation } from "./TranslationContext";

/**
 * "Translate All" toggle button for views that use TranslatableContent
 * components inside a TranslationProvider. When activated, every
 * TranslatableContent in the tree auto-translates via the
 * useVersionTranslation hook's globalShowTranslated effect.
 */
export default function TranslateAllButton({ className = "" }) {
  const { t, language } = useLanguage();
  const { globalShowTranslated, setGlobalShowTranslated, isTranslatingAll } =
    useDocumentTranslation();

  const label = globalShowTranslated
    ? language === "he"
      ? "הצג מקור"
      : language === "ar"
      ? "إظهار الأصلي"
      : "Show Original"
    : t("translateAll");

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setGlobalShowTranslated(!globalShowTranslated);
      }}
      className={`gap-1.5 ${className}`}
      disabled={isTranslatingAll}
    >
      {isTranslatingAll ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Languages className="w-4 h-4" />
      )}
      <span className="text-xs font-medium">{label}</span>
    </Button>
  );
}