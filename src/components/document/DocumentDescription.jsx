import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Edit2, Save, X, Loader2 } from "lucide-react";
import ReactQuill from "react-quill";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import CommentsSection from "./CommentsSection";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { useVersionTranslation } from "./hooks/useVersionTranslation";
import { useDocumentTranslation } from "./TranslationContext";

const detectLanguage = (text) => {
  if (!text) return 'en';
  if (/[\u0590-\u05FF]/.test(text)) return 'he';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  return 'en';
};

/**
 * Document description area — view, edit, translate, read more/less, and comments.
 * Self-contained: manages its own editing + translation state + mutations.
 * Extracted from DocumentView to reduce re-render scope.
 */
const DocumentDescription = React.memo(function DocumentDescription({
  document,
  documentId,
  isRTL,
  language,
  t,
  isAdmin,
  user,
  commentIdFromUrl,
  showDescriptionComments,
}) {
  const queryClient = useQueryClient();
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [description, setDescription] = useState("");
  const [showFullDescription, setShowFullDescription] = useState(false);

  useEffect(() => {
    if (document) setDescription(document.description || "");
  }, [document]);

  const updateDescriptionMutation = useMutation({
    mutationFn: (newDescription) => base44.entities.Document.update(documentId, { description: newDescription }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      setIsEditingDescription(false);
    },
  });

  // Follow the global "Translate All" toggle so the description translates
  // together with the rest of the page.
  const { globalShowTranslated } = useDocumentTranslation();

  // Version-aware translation for the document description.
  // Uses translateVersion — canonical, shared across all users.
  const {
    translatedContent: translatedDesc,
    showTranslated: showTranslatedDescription,
    isTranslating: isTranslatingDescription,
    handleToggle: handleToggleDescription,
    needsTranslation: needsDescriptionTranslation,
  } = useVersionTranslation({
    documentId: document?.id,
    sourceEntityType: 'document',
    sourceEntityId: document?.id,
    sourceField: 'description',
    content: document?.description || '',
    isHtml: true,
    sourceLanguage: document?.originalLanguage || detectLanguage(document?.description || ''),
    globalShowTranslated,
  });

  const hasDescription = !!document?.description;
  const showContainer = hasDescription || isAdmin || showDescriptionComments;
  const hasTranslatedDesc = typeof translatedDesc === 'string' && translatedDesc.length > 1;
  const displayTranslatedDesc = (showTranslatedDescription || globalShowTranslated) && hasTranslatedDesc;
  const currentDescription = displayTranslatedDesc ? translatedDesc : (document?.description || "");

  const scrollToTitle = () => {
    setTimeout(() => {
      if (typeof window !== 'undefined' && window.document?.getElementById) {
        const titleElement = window.document.getElementById('document-title');
        if (titleElement) titleElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  return (
    <div className={`relative ${showContainer ? 'bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg p-4' : ''}`}>
      {/* Translate button — sits in its own row at the inline end of the
          description, so it can never cover the text (LTR or RTL). */}
      {!isEditingDescription && needsDescriptionTranslation && (
        <div className="flex justify-end mb-1" dir={isRTL ? 'rtl' : 'ltr'}>
          {isTranslatingDescription ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          ) : (
            <button
              onClick={handleToggleDescription}
              className="p-1.5 hover:bg-blue-50 rounded transition-colors"
              title={displayTranslatedDesc ? t('showOriginal') : t('translate')}
              aria-label={displayTranslatedDesc ? t('showOriginal') : t('translate')}
            >
              <img
                src="https://media.base44.com/images/public/69ef99e5583af6a64ca3772e/02bc69061_generated_84736192.png"
                alt={displayTranslatedDesc ? t('showOriginal') : t('translate')}
                className={`w-4 h-4 object-contain rounded-sm ${displayTranslatedDesc ? 'opacity-70' : 'opacity-100'}`}
              />
            </button>
          )}
        </div>
      )}

      {isEditingDescription ? (
        <div className="space-y-3">
          <ReactQuill
            value={description}
            onChange={setDescription}
            className="bg-white"
            modules={{
              toolbar: [['bold', 'italic', 'underline'], ['link'], [{ list: 'ordered' }, { list: 'bullet' }], ['clean']],
            }}
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDescription(document?.description || "");
                setIsEditingDescription(false);
              }}
            >
              <X className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('cancel')}
            </Button>
            <Button
              size="sm"
              onClick={() => updateDescriptionMutation.mutate(description)}
              disabled={updateDescriptionMutation.isPending}
              className="bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              <Save className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('saveChanges')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative group">
          {hasDescription ? (
            <DescriptionContent
              content={currentDescription}
              showFull={showFullDescription}
              onToggle={() => {
                if (showFullDescription) {
                  setShowFullDescription(false);
                  scrollToTitle();
                } else {
                  setShowFullDescription(true);
                }
              }}
              isRTL={isRTL}
              language={language}
            />
          ) : isAdmin ? (
            <p className="text-slate-400 text-sm italic">{t('noDescription')}</p>
          ) : null}

          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditingDescription(true)}
              className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      {showDescriptionComments && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <CommentsSection
            entityType="document"
            entityId={documentId}
            user={user}
            documentId={documentId}
            scrollToCommentId={commentIdFromUrl}
          />
        </div>
      )}
    </div>
  );
});

/** Inner description content with read-more / read-less logic */
const DescriptionContent = React.memo(function DescriptionContent({ content, showFull, onToggle, isRTL, language }) {
  const readMoreMarker = '<!-- READ_MORE -->';
  const hasMarker = content.includes(readMoreMarker);

  const readMoreText = language === 'he' ? 'קרא עוד' : language === 'ar' ? 'اقرأ المزيد' : 'Read more';
  const showLessText = language === 'he' ? 'הצג פחות' : language === 'ar' ? 'عرض أقل' : 'Show less';

  if (hasMarker) {
    const parts = content.split(readMoreMarker);
    const beforeMarker = parts[0];
    const afterMarker = parts.slice(1).join('');
    return (
      <>
        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(beforeMarker) }} dir={isRTL ? 'rtl' : 'ltr'} />
        {!showFull ? (
          <Button variant="link" size="sm" onClick={onToggle} className="mt-2 p-0 h-auto text-blue-600 hover:text-blue-800">
            {readMoreText}
          </Button>
        ) : (
          <>
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(afterMarker) }} dir={isRTL ? 'rtl' : 'ltr'} />
            <Button variant="link" size="sm" onClick={onToggle} className="mt-2 p-0 h-auto text-blue-600 hover:text-blue-800">
              {showLessText}
            </Button>
          </>
        )}
      </>
    );
  }

  const stripHtml = content.replace(/<[^>]*>/g, '');
  const hasLongContent = stripHtml.length > 600;

  return (
    <>
      <div className="prose prose-sm max-w-none relative" dir={isRTL ? 'rtl' : 'ltr'}>
        <div
          className={!showFull && hasLongContent ? 'max-h-[15rem] overflow-hidden relative' : ''}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
        />
        {!showFull && hasLongContent && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        )}
      </div>
      {hasLongContent && (
        <Button variant="link" size="sm" onClick={onToggle} className="mt-2 p-0 h-auto text-blue-600 hover:text-blue-800">
          {showFull ? showLessText : readMoreText}
        </Button>
      )}
    </>
  );
});

export default DocumentDescription;