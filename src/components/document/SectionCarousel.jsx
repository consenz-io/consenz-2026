import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, History, Edit, MessageSquare, Trash2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { base44 } from "@/api/base44Client";
import DeleteSectionDialog from "./DeleteSectionDialog";
import SectionHistorySidebar from "./SectionHistorySidebar";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import SectionDiff from "./SectionDiff";
import VotesNeededCounter from "./VotesNeededCounter";
import CommentsSection from "./CommentsSection";
import TranslatableContent from "./TranslatableContent";
import DocumentTextContent from "./DocumentTextContent";
import { motion } from "framer-motion";
import { toast } from "sonner";
import JoinGroupDialog from "@/components/group/JoinGroupDialog";
import SectionVoteButtons from "./SectionVoteButtons";
import VotingProgressSection from "./VotingProgressSection";

const SectionCarousel = React.memo(function SectionCarousel({
  section,
  pendingSuggestions,
  document,
  user,
  canParticipate = true,
  onEditSection,
  onDirectEdit,
  toggleComments,
  showComments,
  getCommentsCount,
  getUserVote,
  voteMutation,
  getUserName,
  acceptedSuggestions,
  sectionIndex,
  isAdmin,
  users,
  onOpenSuggestionSidebar,
  newlyCreatedSuggestionId,
  onClearNewlyCreated,
  targetSuggestionId,
  publicProfiles = [],
  allDocumentSuggestions = [],
  sectionVotes = []
}) {
  const { t, isRTL, language: rawLanguage } = useLanguage();
  const language = rawLanguage || 'he';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // חישוב מקומי של הצעות הסעיף מתוך allDocumentSuggestions שהועבר כ-prop
  const allSectionSuggestions = React.useMemo(() => {
    if (!allDocumentSuggestions || allDocumentSuggestions.length === 0) return [];
    
    const directSuggestions = allDocumentSuggestions.filter(s => 
      s.sectionId === section.id && 
      (s.type === 'edit_section' || s.type === 'delete_section')
    );
    
    const sectionSuggestionIds = new Set(directSuggestions.map(s => s.id));
    
    const editSuggestions = allDocumentSuggestions.filter(s => 
      s.type === 'edit_suggestion' && 
      s.parentSuggestionId && 
      sectionSuggestionIds.has(s.parentSuggestionId)
    );
    
    return [...directSuggestions, ...editSuggestions];
  }, [allDocumentSuggestions, section.id]);

  // קביעת הישות שאליה משויכות תגובות כרטיס הסעיף הנוכחי:
  // אם תוכן הסעיף הגיע מהצעה שהתקבלה (edit_section / new_section) — התגובות הן של ההצעה.
  // אחרת (עריכת אדמין / יצירה ישירה) — התגובות הן של הסעיף.
  const activeCommentEntity = React.useMemo(() => {
    // הצעות edit_section שהתקבלו לסעיף זה — מחפש את האחרונה ביותר
    const acceptedEdits = allDocumentSuggestions
      .filter(s => s.sectionId === section.id && s.status === 'accepted' && s.type === 'edit_section')
      .sort((a, b) => new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date));

    if (acceptedEdits.length > 0) {
      return { entityType: 'suggestion', entityId: acceptedEdits[0].id };
    }

    // הצעת new_section שיצרה את הסעיף הזה
    const creationSuggestion = allDocumentSuggestions.find(
      s => s.sectionId === section.id && s.status === 'accepted' && s.type === 'new_section'
    );

    if (creationSuggestion) {
      return { entityType: 'suggestion', entityId: creationSuggestion.id };
    }

    // fallback: סעיף שנוצר ישירות ללא הצעה
    return { entityType: 'section', entityId: section.id };
  }, [allDocumentSuggestions, section.id]);
  
  // שומר את ה-ID של ההצעה הנוכחית במקום index
  const [currentSuggestionId, setCurrentSuggestionId] = useState(null);
  
  // מסגרת ירוקה מהבהבת לאחר קבלת הצעה
  const [flashingSection, setFlashingSection] = useState(false);
  const prevSuggestionsStatusRef = React.useRef({});
  const hasAnimatedRef = React.useRef(new Set());
  
  // סדר הצגה: לפי דלתא קרובה ל-0, ואז כרונולוגי
  const sortedSuggestions = [...pendingSuggestions].sort((a, b) => {
    const deltaA = Math.abs((a.proVotes || 0) - (a.conVotes || 0));
    const deltaB = Math.abs((b.proVotes || 0) - (b.conVotes || 0));
    
    if (deltaA !== deltaB) {
      return deltaA - deltaB; // דלתא קטנה יותר קודם
    }
    
    // אם הדלתא זהה, סדר כרונולוגי - האחרונה ראשונה
    return new Date(b.created_date) - new Date(a.created_date);
  });
  
  const flashTimerRef = React.useRef(null);

  // מעקב אחרי שינוי סטטוס - כשהצעה מתקבלת, עוברים לתצוגת הסעיף עם מסגרת מהבהבת
  React.useEffect(() => {
    if (!allSectionSuggestions || allSectionSuggestions.length === 0 || !document?.id) return;
    
    allSectionSuggestions.forEach(sug => {
      const prevStatus = prevSuggestionsStatusRef.current[sug.id];
      
      if (prevStatus === 'pending' && sug.status === 'accepted' && !hasAnimatedRef.current.has(sug.id)) {
        hasAnimatedRef.current.add(sug.id);
        
        // מיד עוברים לתצוגת הסעיף הנוכחי ומרעננים
        setCurrentSuggestionId('current');
        queryClient.invalidateQueries({ queryKey: ['sections', document.id] });
        
        // מסגרת ירוקה מהבהבת
        setFlashingSection(true);
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setFlashingSection(false), 3000);
      }
      
      prevSuggestionsStatusRef.current[sug.id] = sug.status;
    });

    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [allSectionSuggestions, document.id, queryClient]);

  // רשימת כל ה"עמודים": תוכן נוכחי + הצעות ממויינות
  const allViews = React.useMemo(() => {
    return [
      { type: 'current', data: section, id: 'current' },
      ...sortedSuggestions.map(s => ({ type: 'suggestion', data: s, id: s.id }))
    ];
  }, [section, sortedSuggestions]);
  
  // מחשב את ה-index הנוכחי לפי ה-ID
  const currentIndex = React.useMemo(() => {
    if (!currentSuggestionId) return 0;
    const idx = allViews.findIndex(v => v.id === currentSuggestionId);
    return idx >= 0 ? idx : 0;
  }, [currentSuggestionId, allViews]);
  const [showTranslated, setShowTranslated] = useState({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [showJoinGroupDialog, setShowJoinGroupDialog] = useState(false);
  
  // Effect to scroll to newly created suggestion
  React.useEffect(() => {
    if (newlyCreatedSuggestionId && sortedSuggestions.length > 0) {
      const foundSuggestion = sortedSuggestions.find(s => s.id === newlyCreatedSuggestionId);
      if (foundSuggestion) {
        setCurrentSuggestionId(newlyCreatedSuggestionId);
        // Clear the flag after navigating
        if (onClearNewlyCreated) {
          setTimeout(() => onClearNewlyCreated(), 100);
        }
      }
    }
  }, [newlyCreatedSuggestionId, sortedSuggestions, onClearNewlyCreated]);
  
  // Effect to navigate to target suggestion (from floating nav buttons)
  React.useEffect(() => {
    if (targetSuggestionId && sortedSuggestions.length > 0) {
      const foundSuggestion = sortedSuggestions.find(s => s.id === targetSuggestionId);
      if (foundSuggestion) {
        setCurrentSuggestionId(targetSuggestionId);
      }
    }
  }, [targetSuggestionId, sortedSuggestions]);
  
  // Reset if current suggestion no longer exists
  const safeIndex = currentIndex >= allViews.length ? 0 : currentIndex;
  const currentView = allViews && allViews.length > 0 ? (allViews[safeIndex] || allViews[0]) : null;

  // דפדוף מעגלי - משתמש ב-ID במקום index
  const handleNext = () => {
    if (!allViews || allViews.length === 0) return;
    const nextIndex = (currentIndex + 1) % allViews.length;
    setCurrentSuggestionId(allViews[nextIndex]?.id);
  };

  const handlePrev = () => {
    if (!allViews || allViews.length === 0) return;
    const prevIndex = (currentIndex - 1 + allViews.length) % allViews.length;
    setCurrentSuggestionId(allViews[prevIndex]?.id);
  };

  const isFirstView = currentIndex === 0;
  const isLastView = currentIndex === allViews.length - 1;

  const deleteSectionMutation = useMutation({
    mutationFn: async (saveToHistory) => {
      // Get existing versions to calculate next version number
      const versions = await base44.entities.DocumentVersion.filter({ sectionId: section.id });
      const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version)) + 1 : 1;

      // Save the section content BEFORE deletion (the "before" record)
      await base44.entities.DocumentVersion.create({
        documentId: section.documentId,
        sectionId: section.id,
        topicId: section.topicId,
        sectionOrder: section.order,
        content: section.content,
        changeDescription: `לפני: ${saveToHistory ? t('deleteSection') : 'Section deletion'}`,
        version: nextVersion,
        changeType: 'direct_edit',
      });

      // Save the deletion record (empty content)
      await base44.entities.DocumentVersion.create({
        documentId: section.documentId,
        sectionId: section.id,
        topicId: section.topicId,
        sectionOrder: section.order,
        content: '',
        changeDescription: saveToHistory ? t('deleteSection') : 'Section deletion',
        version: nextVersion + 1,
        changeType: 'direct_edit',
      });

      // Delete the section
      await base44.entities.Section.delete(section.id);

      // Reject any orphaned suggestions targeting this deleted section
      base44.functions.invoke('rejectOrphanedSuggestions', {
        sectionIds: [section.id],
        documentId: section.documentId,
        gamificationEnabled: !!document.gamificationEnabled
      }).catch(err => console.error('[DELETE SECTION] Failed to reject orphaned suggestions:', err));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections', document.id] });
      queryClient.invalidateQueries({ queryKey: ['versions'] });
      setShowDeleteDialog(false);
    },
  });

  const translateSuggestionMutation = useMutation({
    mutationFn: async (suggestion) => {
      const languagePrompts = { en: "English", he: "Hebrew", ar: "Arabic" };
      const originalLanguage = suggestion.originalLanguage || 'he';
      
      // תרגום כותרת
      const titlePrompt = `Translate the following HTML content to ${languagePrompts[language]}. Keep ALL HTML tags. Return ONLY the translated HTML:\n${suggestion.title}`;
      const titleResult = await base44.integrations.Core.InvokeLLM({
        prompt: titlePrompt,
        add_context_from_internet: false,
      });
      const translatedTitle = (typeof titleResult === 'string' ? titleResult : titleResult.content || titleResult)
        .replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

      console.log('[TRANSLATE DEBUG] Translated title:', translatedTitle);

      // תרגום הסבר
      let translatedExplanation = suggestion.explanation || '';
      if (suggestion.explanation) {
        const explanationPrompt = `Translate the following HTML content to ${languagePrompts[language]}. Keep ALL HTML tags. Return ONLY the translated HTML:\n${suggestion.explanation}`;
        const explanationResult = await base44.integrations.Core.InvokeLLM({
          prompt: explanationPrompt,
          add_context_from_internet: false,
        });
        translatedExplanation = (typeof explanationResult === 'string' ? explanationResult : explanationResult.content || explanationResult)
          .replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
      }

      // תרגום תוכן מוצע
      const contentPrompt = `Translate the following HTML content to ${languagePrompts[language]}. Keep ALL HTML tags. Return ONLY the translated HTML:\n${suggestion.newContent}`;
      const contentResult = await base44.integrations.Core.InvokeLLM({
        prompt: contentPrompt,
        add_context_from_internet: false,
      });
      const translatedContent = (typeof contentResult === 'string' ? contentResult : contentResult.content || contentResult)
        .replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

      console.log('[TRANSLATE DEBUG] Translated content:', translatedContent);

      const newTranslations = {
        ...(suggestion.translations || {}),
        [language]: {
          title: translatedTitle,
          explanation: translatedExplanation,
          newContent: translatedContent
        }
      };

      await base44.entities.Suggestion.update(suggestion.id, {
        translations: newTranslations
      });

      return { suggestionId: suggestion.id, translations: newTranslations, suggestion };
    },
    onMutate: async (suggestion) => {
      // מגדיר מראש שאנחנו מציגים תרגום
      setShowTranslated(prev => ({ ...prev, [suggestion.id]: true }));
    },
    onSuccess: (data) => {
      // עדכון הדאטה באופן מיידי בקאש
      queryClient.setQueryData(['suggestions', document.id], (oldData) => {
        if (!oldData) return oldData;
        return oldData.map(s => 
          s.id === data.suggestionId 
            ? { ...s, translations: data.translations }
            : s
        );
      });
    }
  });

  const currentSuggestionDisplayId = currentView?.type === 'suggestion' ? `suggestion-${currentView.data.id}` : `section-${section.id}`;

  // Scroll to target section when needed (only in browser)
  React.useEffect(() => {
    if (targetSuggestionId && typeof window !== 'undefined' && window.document) {
      const targetElement = window.document.getElementById(`suggestion-${targetSuggestionId}`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [targetSuggestionId]);

  // צבעי ה-indicator לפי סוג התצוגה
  const isDeleteView = currentView?.data?.type === 'delete_section';
  const hasSuggestions = allViews.length > 1;

  return (
    <div id={currentSuggestionDisplayId} className={`group relative border-2 rounded-xl transition-all bg-white ${flashingSection ? 'suggestion-accepted-flash border-green-400 shadow-md' : hasSuggestions ? 'border-amber-300 shadow-sm hover:shadow-md' : 'border-slate-200 hover:border-blue-300 hover:shadow-sm'}`}>

      {/* פס עליון עם מידע + היסטוריה */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-slate-400">
            {t('section')} {sectionIndex + 1}
          </div>
          {hasSuggestions && (
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-slate-300" />
              {/* Dot indicators */}
              <div className="flex gap-1">
                {allViews.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSuggestionId(allViews[i].id)}
                    className={`rounded-full transition-all ${
                      i === currentIndex
                        ? 'w-4 h-2 bg-amber-500'
                        : 'w-2 h-2 bg-slate-300 hover:bg-amber-300'
                    }`}
                    aria-label={`עבור לכרטיס ${i + 1}`}
                  />
                ))}
              </div>
              <span className="text-xs text-slate-400">{currentIndex + 1}/{allViews.length}</span>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); setShowHistorySidebar(true); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-600 h-7 px-2"
        >
          <History className={`w-3.5 h-3.5 ${isRTL ? 'ml-1' : 'mr-1'}`} />
          <span className="hidden md:inline text-xs">{t('history')}</span>
        </Button>
      </div>

      {/* banner לתצוגת הצעה */}
      {hasSuggestions && !isFirstView && (
        <div className={`mx-4 mb-2 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
          isDeleteView
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-amber-50 text-amber-800 border border-amber-200'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDeleteView ? 'bg-red-500' : 'bg-amber-500'}`} />
          <span className="truncate">
            {isDeleteView
              ? ((language === 'he') ? 'הצעה למחיקת הסעיף' : (language === 'ar') ? 'اقتراح لحذف القسم' : 'Delete section suggestion')
              : `${(language === 'he') ? 'הצעת עריכה' : (language === 'ar') ? 'اقتراح تعديل' : 'Edit suggestion'} · ${getUserName(currentView?.data?.created_by)}`
            }
          </span>
          {currentView?.data?.created_date && (
            <span className="text-[10px] opacity-60 flex-shrink-0">
              {new Date(currentView.data.created_date).toLocaleDateString(language === 'he' ? 'he-IL' : language === 'ar' ? 'ar-SA' : 'en-GB', { day: '2-digit', month: '2-digit' })}
            </span>
          )}
        </div>
      )}

      {/* banner לתצוגת תוכן נוכחי עם הצעות */}
      {hasSuggestions && isFirstView && (
        <div className="mx-4 mb-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
          <span>
            {language === 'he' ? `${sortedSuggestions.length} הצעות עריכה ממתינות — גלול לצדדים` : language === 'ar' ? `${sortedSuggestions.length} اقتراحات تعديل معلقة` : `${sortedSuggestions.length} pending edit suggestions — swipe to browse`}
          </span>
        </div>
      )}

      {/* גוף הכרטיס עם כפתורי דפדוף משני הצדדים */}
      <div className="relative flex items-stretch">
        {/* כפתור שמאל */}
        {hasSuggestions && (
          <button
            onClick={isRTL ? handleNext : handlePrev}
            className={`flex-shrink-0 flex items-center justify-center w-10 md:w-12 self-stretch transition-all
              ${isRTL ? (isLastView  ? 'text-slate-200 cursor-default' : 'text-amber-500 hover:text-amber-700 hover:bg-amber-50 active:bg-amber-100')
                      : (isFirstView ? 'text-slate-200 cursor-default' : 'text-amber-500 hover:text-amber-700 hover:bg-amber-50 active:bg-amber-100')
              }`}
            disabled={isRTL ? isLastView : isFirstView}
            aria-label={isRTL ? t('nextSuggestion') : t('previousSuggestion')}
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        )}

        {/* תוכן */}
        <div className={`flex-1 min-w-0 py-3 min-h-[60px] ${hasSuggestions ? 'px-2 md:px-3' : 'px-4 md:px-6'}`}>
        {!currentView ? null : currentView.type === 'current' ? (
          // תצוגת תוכן נוכחי
          <>
            <TranslatableContent
              content={section.content}
              entity={section}
              entityType="Section"
              className="prose prose-sm max-w-none"
              renderContent={(content) => (
                <DocumentTextContent content={content} className="text-slate-800" />
              )}
            />
            <div className={`flex flex-col md:flex-row items-start md:items-center justify-between mt-3 gap-2 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
              <div className="text-[10px] md:text-xs text-slate-400">
                {t('lastEdited')} {new Date(section.updated_date).toLocaleDateString('en-GB')}
              </div>
              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <SectionVoteButtons
                  section={section}
                  user={user}
                  onSuggestEdit={onEditSection}
                  canParticipate={canParticipate}
                  onCannotParticipate={() => setShowJoinGroupDialog(true)}
                  initialVotes={sectionVotes}
                />
                {(() => {
                  const count = typeof getCommentsCount === 'function' ? getCommentsCount(activeCommentEntity.entityType, activeCommentEntity.entityId) : 0;
                  const hasComments = count > 0;
                  return (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleComments(`section-${section.id}`)}
                      className={`h-7 md:h-8 text-xs px-2 transition-all ${
                        hasComments
                          ? 'font-bold text-blue-700 border border-blue-300 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 shadow-sm'
                          : 'text-slate-600 hover:text-blue-600'
                      }`}
                    >
                      <MessageSquare className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-1' : 'mr-1'} ${hasComments ? 'fill-blue-200' : ''}`} />
                      {t('comments')}{hasComments ? ` (${count})` : ''}
                    </Button>
                  );
                })()}
              </div>
            </div>
            {showComments[`section-${section.id}`] && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <CommentsSection
                  entityType={activeCommentEntity.entityType}
                  entityId={activeCommentEntity.entityId}
                  user={user}
                />
              </div>
            )}
          </>
        ) : (
          // תצוגת הצעה
          <>
            {(() => {
              return (
                <div 
                  className="cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => onOpenSuggestionSidebar && onOpenSuggestionSidebar(currentView.data.id)}
                >
                  {currentView.data.type === 'delete_section' ? (
                    <div>
                      <div className="p-3 md:p-4 bg-red-50 rounded border border-red-200">
                        <div className="text-sm font-bold text-red-700 mb-2">
                          {(language || 'he') === 'he' ? 'סעיף שמוצע למחיקה:' : (language || 'he') === 'ar' ? 'القسم المقترح حذفه:' : 'Section to be deleted:'}
                        </div>
                        <div 
                          className="prose prose-sm max-w-none text-slate-700 line-through opacity-60"
                          dangerouslySetInnerHTML={{ __html: currentView.data.originalContent }}
                        />
                      </div>
                      {currentView.data.explanation && (
                        <div className="mt-3 p-3 bg-white/60 rounded-lg border border-red-100">
                          <div className="text-sm font-bold text-slate-700 mb-1">{t('explanation')}:</div>
                          <TranslatableContent
                            content={currentView.data.explanation}
                            entity={currentView.data}
                            entityType="Suggestion"
                            className="text-slate-700 text-sm whitespace-pre-wrap"
                          />
                        </div>
                      )}
                    </div>
                  ) : currentView.data.originalContent ? (
                    <div>
                      <SectionDiff
                        originalContent={currentView.data.originalContent}
                        newContent={currentView.data.newContent}
                        documentId={document?.id}
                        sectionId={section?.id}
                        suggestion={currentView.data}
                        section={section}
                      />
                      {currentView.data.explanation && typeof currentView.data.explanation === 'string' && (
                        <div className="mt-3 text-sm">
                          <div className="font-semibold text-slate-700 mb-1">{t('explanation')}:</div>
                          <TranslatableContent
                            content={currentView.data.explanation}
                            entity={currentView.data}
                            entityType="Suggestion"
                            className="text-slate-600"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="p-3 bg-green-50 rounded border border-green-200 hover:bg-green-100 hover:shadow-md transition-all">
                        <TranslatableContent
                          content={currentView.data.newContent}
                          entity={currentView.data}
                          entityType="Suggestion"
                          className="prose prose-sm max-w-none"
                          renderContent={(content) => (
                            <DocumentTextContent content={content} />
                          )}
                        />
                      </div>
                      {currentView.data.explanation && typeof currentView.data.explanation === 'string' && (
                        <div className="mt-3 text-sm">
                          <div className="font-semibold text-slate-700 mb-1">{t('explanation')}:</div>
                          <TranslatableContent
                            content={currentView.data.explanation}
                            entity={currentView.data}
                            entityType="Suggestion"
                            className="text-slate-600"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* כפתורי הצבעה והערות */}
            <div className="mt-4 space-y-2">
              {document?.votingButtonsEnabled && (
                <div onClick={(e) => e.stopPropagation()}>
                  {user && canParticipate ? (
                    <VotingProgressSection
                      suggestion={currentView.data}
                      document={document}
                      userVote={getUserVote(currentView.data.id)}
                      voteMutation={{
                        isPending: voteMutation.isPending,
                        mutate: (vote) => voteMutation.mutate({ suggestionId: currentView.data.id, vote, currentVote: getUserVote(currentView.data.id) })
                      }}
                      isRTL={isRTL}
                    />
                  ) : (
                    <VotingProgressSection
                      suggestion={currentView.data}
                      document={document}
                      userVote={null}
                      voteMutation={{ isPending: false, mutate: () => {
                        if (!user) base44.auth.redirectToLogin(window.location.href);
                        else if (!canParticipate) setShowJoinGroupDialog(true);
                      }}}
                      isRTL={isRTL}
                      readOnly={!user}
                    />
                  )}
                </div>
              )}
              {currentView?.data?.id && (() => {
                const count = typeof getCommentsCount === 'function' ? getCommentsCount('suggestion', currentView.data.id) : 0;
                const hasComments = count > 0;
                const commentsKey = `suggestion-${currentView.data.id}`;
                return (
                  <>
                    <div className={`flex items-center gap-2 flex-wrap mt-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className={`text-xs h-8 px-3 flex-shrink-0 ${isRTL ? 'mr-0 ml-auto' : 'ml-0 mr-auto'}`}
                        onClick={() => onOpenSuggestionSidebar && onOpenSuggestionSidebar(currentView.data.id)}
                      >
                        {t('viewDetails')}
                      </Button>
                      <Button
                        variant={hasComments ? "outline" : "ghost"}
                        size="sm"
                        onClick={() => toggleComments(commentsKey)}
                        className={`h-8 text-sm px-3 gap-1.5 relative flex-shrink-0 transition-all ${
                          hasComments
                            ? 'font-semibold text-blue-700 border-blue-300 bg-blue-50 hover:bg-blue-100'
                            : 'text-slate-600 hover:text-blue-600'
                        }`}
                      >
                        <MessageSquare className={`w-4 h-4 ${hasComments ? 'fill-blue-200' : ''}`} />
                        {t('comments')}{hasComments ? ` (${count})` : ''}
                      </Button>
                    </div>
                    {showComments[commentsKey] && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <CommentsSection
                          entityType="suggestion"
                          entityId={currentView.data.id}
                          user={user}
                        />
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </>
        )}
        </div>

        {/* כפתור ימין */}
        {hasSuggestions && (
          <button
            onClick={isRTL ? handlePrev : handleNext}
            className={`flex-shrink-0 flex items-center justify-center w-10 md:w-12 self-stretch rounded-br-xl transition-all
              ${isRTL ? (isFirstView ? 'text-slate-200 cursor-default' : 'text-amber-500 hover:text-amber-700 hover:bg-amber-50 active:bg-amber-100')
                      : (isLastView  ? 'text-slate-200 cursor-default' : 'text-amber-500 hover:text-amber-700 hover:bg-amber-50 active:bg-amber-100')
              }`}
            disabled={isRTL ? isFirstView : isLastView}
            aria-label={isRTL ? t('previousSuggestion') : t('nextSuggestion')}
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        )}
      </div>

      {/* כפתורים תחתונים - ערוך/מחק (תצוגה נוכחית בלבד) */}
      {isFirstView && (
        <div className={`flex flex-wrap gap-1 px-4 pb-3 pt-2 border-t border-slate-100 ${isRTL ? 'justify-end' : 'justify-start'}`}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (!user) { base44.auth.redirectToLogin(window.location.href); return; }
              if (!canParticipate) { setShowJoinGroupDialog(true); return; }
              onEditSection(section);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs min-w-0"
          >
            <Edit className={`w-3.5 h-3.5 shrink-0 ${isRTL ? 'ml-1' : 'mr-1'}`} />
            <span className="truncate">{t('suggestEditSection')}</span>
          </Button>
          {isAdmin && onDirectEdit && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onDirectEdit(section)}
              className="bg-purple-600 hover:bg-purple-700 opacity-0 group-hover:opacity-100 transition-opacity text-xs min-w-0"
            >
              <Edit className={`w-3.5 h-3.5 shrink-0 ${isRTL ? 'ml-1' : 'mr-1'}`} />
              <span className="truncate">עריכה ישירה</span>
            </Button>
          )}
          {!pendingSuggestions.some(s => s.type === 'delete_section') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!user) { base44.auth.redirectToLogin(window.location.href); return; }
                onEditSection({ ...section, isDeletingSuggestion: true });
              }}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity text-xs min-w-0"
              title={(language || 'he') === 'he' ? 'הצע מחיקת סעיף' : 'Suggest Section Deletion'}
            >
              <Trash2 className={`w-3.5 h-3.5 shrink-0 ${isRTL ? 'ml-1' : 'mr-1'}`} />
              <span className="hidden sm:inline">{(language || 'he') === 'he' ? 'הצעת מחיקה' : 'Suggest Delete'}</span>
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="text-red-700 hover:text-red-900 hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-opacity text-xs min-w-0"
              title={t('deleteSection')}
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">{(language || 'he') === 'he' ? 'מחק (מנהל)' : 'Delete (Admin)'}</span>
            </Button>
          )}
        </div>
      )}
      
      <DeleteSectionDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={(saveToHistory) => deleteSectionMutation.mutate(saveToHistory)}
        isDeleting={deleteSectionMutation.isPending}
      />
      
      <SectionHistorySidebar
        sectionId={section.id}
        isOpen={showHistorySidebar}
        onClose={() => setShowHistorySidebar(false)}
      />

      <JoinGroupDialog
        isOpen={showJoinGroupDialog}
        onClose={() => setShowJoinGroupDialog(false)}
        groupId={document?.groupId}
        groupName={document?.groupId ? undefined : undefined}
      />
    </div>
  );
});

export default SectionCarousel;