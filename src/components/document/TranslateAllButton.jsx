import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Languages, Loader2, Check, Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { useDocumentTranslation } from "./TranslationContext";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const languagePrompts = {
  en: "English",
  he: "Hebrew",
  ar: "Arabic"
};

const detectLanguage = (text) => {
  if (!text) return 'en';
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  if (hebrewPattern.test(text)) return 'he';
  if (arabicPattern.test(text)) return 'ar';
  return 'en';
};

export default function TranslateAllButton({ document, topics, sections }) {
  const { t, language, isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const { globalShowTranslated, setGlobalShowTranslated, isTranslatingAll, setIsTranslatingAll, addTranslatedId } = useDocumentTranslation();
  const [progress, setProgress] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  // Check if any content has translations (no language detection needed)
  const hasAnyTranslations = 
    document.translations?.[language]?.title ||
    topics.some(t => t.translations?.[language]?.title) ||
    sections.some(s => s.translations?.[language]?.content);

  const translateAllMutation = useMutation({
    mutationFn: async () => {
      setIsTranslatingAll(true);
      setProgress(0);

      const result = await base44.functions.invoke('translateDocumentAll', {
        documentId: document.id,
        targetLanguage: language,
      });
      const total = result.data?.totalItems || 0;
      setTotalItems(total);
      setProgress(total);

      // Invalidate queries to refresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['document', document.id] }),
        queryClient.invalidateQueries({ queryKey: ['topics', document.id] }),
        queryClient.invalidateQueries({ queryKey: ['sections', document.id] }),
      ]);

      setGlobalShowTranslated(true);
    },
    onSettled: () => {
      setIsTranslatingAll(false);
      setProgress(0);
      setTotalItems(0);
    }
  });

  return null;
}