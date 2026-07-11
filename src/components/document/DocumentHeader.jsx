import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Languages, MoreVertical, MessageSquare, FileText, AlertCircle, Settings } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import TranslateAllButton from "./TranslateAllButton";

/**
 * Document title area — title, translate button, and action dropdown menu.
 * Self-contained: manages its own translation state + mutation.
 * Extracted from DocumentView to reduce re-render scope.
 */
const DocumentHeader = React.memo(function DocumentHeader({
  document,
  documentId,
  isRTL,
  language,
  t,
  isAdmin,
  documentComments,
  sectionCommentsCount,
  showDescriptionComments,
  setShowDescriptionComments,
  topics,
  sections,
}) {
  const queryClient = useQueryClient();
  const [showTranslated, setShowTranslated] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const languagePrompts = { en: "English", he: "Hebrew", ar: "Arabic" };

  const translateDocumentMutation = useMutation({
    mutationFn: async () => {
      const titlePrompt = `Translate the following text to ${languagePrompts[language]}. Return ONLY the translated text:\n${document.title}`;
      const titleResult = await base44.integrations.Core.InvokeLLM({
        prompt: titlePrompt,
        add_context_from_internet: false,
      });
      const translatedTitle = (typeof titleResult === 'string' ? titleResult : titleResult.content || titleResult).trim();
      const newTranslations = {
        ...(document.translations || {}),
        [language]: { title: translatedTitle },
      };
      await base44.entities.Document.update(document.id, { translations: newTranslations });
      return newTranslations;
    },
    onMutate: () => {
      setIsTranslating(true);
      setShowTranslated(true);
    },
    onSuccess: (newTranslations) => {
      setIsTranslating(false);
      queryClient.setQueryData(['document', documentId], (oldData) =>
        oldData ? { ...oldData, translations: newTranslations } : oldData
      );
    },
    onError: () => setIsTranslating(false),
  });

  const translatedTitle = document.translations?.[language]?.title;
  const hasTranslation = typeof translatedTitle === 'string';

  return (
    <div className={`document-title-area flex items-center gap-2 w-full max-w-full ${isRTL ? 'flex-row-reverse' : ''}`}>
      <h1
        id="document-title"
        className="text-lg md:text-3xl font-bold text-slate-900 flex-1 min-w-0 break-words leading-tight max-w-full"
        style={{ fontFamily: "'Times New Roman', 'David Libre', 'Noto Serif', Georgia, serif" }}
      >
        {showTranslated && hasTranslation ? translatedTitle : document.title}
      </h1>

      <div className="flex-shrink-0">
        {isTranslating ? (
          <div className="w-3.5 h-3.5 md:w-5 md:h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        ) : !hasTranslation ? (
          <button
            type="button"
            onClick={() => translateDocumentMutation.mutate()}
            className="p-0.5 md:p-1.5 hover:bg-blue-50 rounded transition-colors"
            aria-label={t('translate')}
          >
            <Languages className="w-3.5 h-3.5 md:w-5 md:h-5 text-blue-600" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowTranslated(!showTranslated)}
            className="p-0.5 md:p-1.5 hover:bg-slate-100 rounded transition-colors"
            aria-label={showTranslated ? t('showOriginal') : t('showTranslation')}
          >
            <Languages className={`w-3.5 h-3.5 md:w-5 md:h-5 ${showTranslated ? 'text-slate-600' : 'text-blue-600'}`} aria-hidden="true" />
          </button>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs md:text-sm px-2 h-8">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => setShowDescriptionComments(!showDescriptionComments)}>
            <MessageSquare className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {t('documentDiscussion')}
            {documentComments.length > 0 && ` (${documentComments.length})`}
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link to={`${createPageUrl("DocumentComments")}?id=${documentId}`} className="flex items-center">
              <MessageSquare className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('sectionComments')} ({sectionCommentsCount})
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link to={`${createPageUrl("RejectedSuggestions")}?id=${documentId}`} className="flex items-center">
              <AlertCircle className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {language === 'he' ? 'הצעות שנדחו' : language === 'ar' ? 'المقترحات المرفوضة' : 'Rejected Suggestions'}
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link to={`${createPageUrl("DocumentCleanView")}?id=${documentId}`} className="flex items-center">
              <FileText className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('cleanView')}
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem>
            <div className="w-full" id="translate-all-wrapper">
              <TranslateAllButton document={document} topics={topics} sections={sections} />
            </div>
          </DropdownMenuItem>

          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to={`${createPageUrl("DocumentAdmin")}?id=${documentId}`} className="flex items-center">
                  <Settings className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {t('admin')}
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});

export default DocumentHeader;