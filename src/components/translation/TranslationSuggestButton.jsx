import React, { useState } from "react";
import { Pencil } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslationAssist } from "./TranslationAssistContext";
import TranslationSuggestDialog from "./TranslationSuggestDialog";

const titles = {
  he: "הצעת תיקון תרגום",
  ar: "اقتراح تصحيح ترجمة",
  en: "Suggest a translation fix",
};

/**
 * Small inline button rendered next to a translated text while translation
 * help mode is on. Renders nothing when the mode is off.
 *
 * target: { scope, platformKey, documentId, sourceEntityType, sourceEntityId,
 *           sourceVersionId, sourceField, sourceLanguage, targetLanguage,
 *           sourceContentHash }
 */
export default function TranslationSuggestButton({ target, currentText, language = "en" }) {
  const { assistEnabled } = useTranslationAssist();
  const [open, setOpen] = useState(false);

  if (!assistEnabled) return null;

  const label = titles[language] || titles.en;

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(true);
              }}
              aria-label={label}
              className="inline-flex items-center justify-center align-middle w-6 h-6 rounded-full text-blue-600/70 hover:text-blue-700 hover:bg-blue-50 transition-colors flex-shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs font-medium">
            {label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <TranslationSuggestDialog
        open={open}
        onOpenChange={setOpen}
        target={target}
        currentText={currentText}
      />
    </>
  );
}