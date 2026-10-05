import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Languages, MoreVertical, MessageSquare, FileText, AlertCircle, Settings } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import TranslateAllButton from "./TranslateAllButton";
import DocumentTitleHeading from "./DocumentTitleHeading";
import { useVersionTranslation } from "./hooks/useVersionTranslation";

const detectLanguage = (text) => {
  if (!text) return 'en';
  if (/[\u0590-\u05FF]/.test(text)) return 'he';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  return 'en';
};

/**
 * Document title area — title, translate button, and action dropdown menu.
 * Self-contained: manages its own translation state via useVersionTranslation.
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
  sections
}) {
  const {
    translatedContent: translatedTitle,
    showTranslated,
    isTranslating,
    handleToggle,
    needsTranslation,
  } = useVersionTranslation({
    documentId: document.id,
    sourceEntityType: 'document',
    sourceEntityId: document.id,
    sourceField: 'title',
    content: document.title,
    isHtml: false,
    sourceLanguage: document.originalLanguage || detectLanguage(document.title),
  });

  const hasTranslation = !!translatedTitle;

  return (
    <div className={`document-title-area flex items-center gap-2 w-full max-w-full ${isRTL ? 'flex-row-reverse' : ''}`}>
      <DocumentTitleHeading id="document-title">
        {showTranslated && hasTranslation ? translatedTitle : document.title}
      </DocumentTitleHeading>

      <div className="flex-shrink-0">
        {isTranslating ?
        <div className="w-3.5 h-3.5 md:w-5 md:h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /> :
        needsTranslation ?
        <button
          type="button"
          onClick={handleToggle}
          className="p-0.5 md:p-1.5 hover:bg-blue-50 rounded transition-colors"
          aria-label={showTranslated && hasTranslation ? t('showOriginal') : t('translate')}>

            <Languages className={`w-3.5 h-3.5 md:w-5 md:h-5 ${showTranslated && hasTranslation ? 'text-slate-600' : 'text-blue-600'}`} aria-hidden="true" />
          </button> :
        null
        }
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs md:text-sm px-2 h-8">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
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

          {isAdmin &&
          <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to={`${createPageUrl("DocumentAdmin")}?id=${documentId}`} className="flex items-center">
                  <Settings className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {t('admin')}
                </Link>
              </DropdownMenuItem>
            </>
          }
        </DropdownMenuContent>
      </DropdownMenu>
    </div>);

});

export default DocumentHeader;