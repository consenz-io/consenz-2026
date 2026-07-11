import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Languages, Edit2, Save, X, Loader2 } from "lucide-react";
import ReactQuill from "react-quill";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import CommentsSection from "./CommentsSection";

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
  const [showTranslatedDescription, setShowTranslatedDescription] = useState(false);
  const [isTranslatingDescription, setIsTranslatingDescription] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);

  useEffect(() => {
    if (document) setDescription(document.description || "");
  }, [document]);

  const languagePrompts = { en: "English", he: "Hebrew", ar: "Arabic" };

  const updateDescriptionMutation = useMutation({
    mutationFn: (newDescription) => base44.entities.Document.update(documentId, { description: newDescription }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      setIsEditingDescription(false);
    },
  });

  const translateDescriptionMutation = useMutation({
    mutationFn: async () => {
      const descPrompt = `Translate the following HTML text to ${languagePrompts[language]}. Return ONLY the translated HTML, preserving all HTML tags:\n${document.description}`;
      const descResult = await base44.integrations.Core.InvokeLLM({
        prompt: descPrompt,
        add_context_from_internet: false,
      });
      const translatedDescription = (typeof descResult === 'string' ? descResult : descResult.content || descResult).trim();
      const newTranslations = {
        ...(document.translations || {}),
        [language]: {
          ...(document.translations?.[language] || {}),
          description: translatedDescription,
        },
      };
      await base44.entities.Document.update(document.id, { translations: newTranslations });
      return newTranslations;
    },
    onMutate: () => {
      setIsTranslatingDescription(true);
      setShowTranslatedDescription(true);
    },
    onSuccess: (newTranslations) => {
      setIsTranslatingDescription(false);
      queryClient.setQueryData(['document', documentId], (oldData) =>
        oldData ? { ...oldData, translations: newTranslations } : oldData
      );
    },
    onError: () => setIsTranslatingDescription(false),
  });

  const hasDescription = !!document?.description;
  const showContainer = hasDescription || isAdmin || showDescriptionComments;
  const translatedDesc = document?.translations?.[language]?.description;
  const hasTranslatedDesc = typeof translatedDesc === 'string';
  const currentDescription = showTranslatedDescription && hasTranslatedDesc ? translatedDesc : (document?.description || "");

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
      {/* Translate button */}
      {!isEditingDescription && (
        <div className="absolute top-2 left-2 z-10">
          {isTranslatingDescription ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          ) : !hasTranslatedDesc ? (
            <button
              onClick={() => translateDescriptionMutation.mutate()}
              className="p-1.5 hover:bg-blue-50 rounded transition-colors"
              title={t('translate')}
            >
              <Languages className="w-4 h-4 text-blue-600" />
            </button>
          ) : (
            <button
              onClick={() => setShowTranslatedDescription(!showTranslatedDescription)}
              className="p-1.5 hover:bg-slate-100 rounded transition-colors"
              title={showTranslatedDescription ? t('showOriginal') : t('showTranslation')}
            >
              <Languages className={`w-4 h-4 ${showTranslatedDescription ? 'text-slate-600' : 'text-blue-600'}`} />
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
        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: beforeMarker }} dir={isRTL ? 'rtl' : 'ltr'} />
        {!showFull ? (
          <Button variant="link" size="sm" onClick={onToggle} className="mt-2 p-0 h-auto text-blue-600 hover:text-blue-800">
            {readMoreText}
          </Button>
        ) : (
          <>
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: afterMarker }} dir={isRTL ? 'rtl' : 'ltr'} />
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
          dangerouslySetInnerHTML={{ __html: content }}
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