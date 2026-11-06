import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";
import { useTranslationAssist } from "./TranslationAssistContext";
import TranslationSuggestButton from "./TranslationSuggestButton";

/** The approved wording for a platform string, if a suggestion was accepted. */
export function useTranslationOverride(key, language) {
  return useQuery({
    queryKey: ["translationOverride", key, language],
    queryFn: async () => {
      const res = await base44.entities.TranslationSuggestion.filter(
        { scope: "platform", platformKey: key, targetLanguage: language, status: "approved" },
        { sort: "-updated_date", limit: 1 }
      );
      const items = Array.isArray(res) ? res : res?.items || [];
      return items[0] || null;
    },
    enabled: !!key && !!language,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Renders a fixed platform string, using the officially approved community
 * translation when one exists. While translation help mode is on, it also
 * shows a small button for suggesting a better wording.
 */
export default function TranslatablePlatformText({ tKey, values, className = "" }) {
  const { t, language } = useLanguage();
  const { assistEnabled } = useTranslationAssist();
  const { data: override } = useTranslationOverride(tKey, language);

  const text = override?.proposedText || t(tKey, values);

  if (!assistEnabled) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={`inline-flex items-baseline gap-1 ${className}`}>
      <span>{text}</span>
      <TranslationSuggestButton
        language={language}
        currentText={text}
        target={{
          scope: "platform",
          platformKey: tKey,
          sourceEntityType: "platform",
          sourceLanguage: "en",
          targetLanguage: language,
        }}
      />
    </span>
  );
}