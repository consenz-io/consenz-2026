import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, History, Edit, MessageSquare, ThumbsUp, ThumbsDown, Languages, Loader2, Trash2 } from "lucide-react";
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

import { toast } from "sonner";
import JoinGroupDialog from "@/components/group/JoinGroupDialog";

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
  allDocumentSuggestions = []
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
    
    return [...directSuggestions, ...editSuggestions].filter(s => s.status === 'pending');
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
  
  // שומר הצעות שהתקבלו בזמן שהיוזר צופה בהן - כדי שלא ייעלמו פתאום
  const [recentlyAcceptedSuggestions, setRecentlyAcceptedSuggestions] = useState({});
  
  // מעקב אחרי הצעות שהתקבלו לצורך אנימציה
  const [acceptedFlash, setAcceptedFlash] = useState({}); // suggestionId -> true
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
  
  // זיהוי מעבר pending → accepted והפעלת אנימציה פשוטה
  // בודק את כל הצעות הסעיף (לא רק pending) כדי לזהות מעבר סטטוס
  const allDirectSectionSuggestions = React.useMemo(() => {
    return allDocumentSuggestions.filter(s =>
      s.sectionId === section.id &&
      (s.type === 'edit_section' || s.type === 'delete_section' || s.type === 'new_section')
    );
  }, [allDocumentSuggestions, section.id]);

  React.useEffect(() => {
    if (!allDirectSectionSuggestions || allDirectSectionSuggestions.length === 0 || !document?.id) return;

    allDirectSectionSuggestions.forEach(sug => {
      const prevStatus = prevSuggestionsStatusRef.current[sug.id];

      if (prevStatus === 'pending' && sug.status === 'accepted' && !hasAnimatedRef.current.has(sug.id)) {
        hasAnimatedRef.current.add(sug.id);

        // הפעל flash ירוק על ה-container
        setAcceptedFlash(prev => ({ ...prev, [sug.id]: true }));

        // Toast feedback
        const lang = language || 'he';
        if (sug.type === 'delete_section') {
          toast.success(
            lang === 'he' ? '🗑️ ההצעה למחיקת הסעיף התקבלה!' :
            lang === 'ar' ? '🗑️ تم قبول اقتراح حذف القسم!' :
            '🗑️ Delete section suggestion accepted!',
            { duration: 4000 }
          );
        } else {
          toast.success(
            lang === 'he' ? '🎉 הצעת העריכה התקבלה!' :
            lang === 'ar' ? '🎉 تم قبول اقتراح التعديل!' :
            '🎉 Edit suggestion accepted!',
            { duration: 4000 }
          );
        }

        // חזרה לתצוגת הסעיף המעודכן אחרי 2 שניות
        setTimeout(() => {
          setCurrentSuggestionId('current');
          queryClient.invalidateQueries({ queryKey: ['sections', document.id] });
          queryClient.invalidateQueries({ queryKey: ['suggestions', document.id] });
        }, 2000);

        // הסרת ה-flash אחרי 2.5 שניות
        setTimeout(() => {
          setAcceptedFlash(prev => { const n = { ...prev }; delete n[sug.id]; return n; });
        }, 2500);
      }

      prevSuggestionsStatusRef.current[sug.id] = sug.status;
    });
  }, [allDirectSectionSuggestions, document.id, queryClient]);

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

  const languageNames = {
    en: "English",
    he: "עברית",
    ar: "العربية"
  };

  const languagePrompts = {
    en: "English",
    he: "Hebrew",
    ar: "Arabic"
  };

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

  // האם יש flash ירוק פעיל — בדוק על כל ההצעות של הסעיף הזה
  const isFlashing = allDirectSectionSuggestions.some(s => acceptedFlash[s.id]);

  return (
    <div
      id={currentSuggestionDisplayId}
      className={`group relative p-3 md:p-6 border-2 rounded-lg transition-all bg-gradient-to-br from-white to-slate-50/30 ${
        isFlashing
          ? 'border-green-400 shadow-green-200 shadow-lg animate-pulse'
          : 'border-slate-300 hover:border-blue-400 hover:shadow-md'
      }`}
    >
      {/* כותרת סעיף עם אינדיקטור */}
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="text-xs md:text-sm font-medium text-slate-500">
            {t('section')} {sectionIndex + 1}
          </div>
          {allViews.length > 1 && (
            <Badge variant="outline" className="text-[10px] md:text-xs">
              {currentIndex + 1} / {allViews.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 md:gap-2 relative z-10">
          {/* כפתור היסטוריה - פותח sidebar */}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); setShowHistorySidebar(true); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-blue-600 h-7 md:h-8 px-2 md:px-3"
          >
            <History className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
            <span className="hidden md:inline">{t('history')}</span>
          </Button>
        </div>
      </div>

      {/* כפתורי דפדוף */}
      {allViews.length > 1 && (
        <div className={`flex items-center justify-between mb-4 pb-4 border-b-2 p-3 rounded-lg shadow-sm ${
          currentView?.data?.type === 'delete_section' 
            ? 'border-red-300 bg-gradient-to-r from-red-50 to-pink-50' 
            : 'border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50'
        }`}>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            className="flex items-center"
          >
            {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>

          <div className="text-center">
            {isFirstView ? (
              <p className="text-sm">
                <span className="font-bold text-amber-700 text-lg">{sortedSuggestions.length}</span> <span className="font-bold text-slate-800">{t('editSuggestions')}</span>
              </p>
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                <button 
                  onClick={() => setCurrentSuggestionId('current')}
                  className={`text-sm font-bold hover:underline cursor-pointer transition-colors ${
                    currentView?.data?.type === 'delete_section' 
                      ? 'text-red-700 hover:text-red-900' 
                      : 'text-blue-700 hover:text-blue-900'
                  }`}
                >
                  {currentView?.data?.type === 'delete_section' 
                   ? ((language || 'he') === 'he' ? 'הצעה למחיקת הסעיף' : (language || 'he') === 'ar' ? 'اقتراح لحذف القسم' : 'Delete Section Suggestion')
                   : `${(language || 'he') === 'he' ? 'הצעת עריכה מאת' : (language || 'he') === 'ar' ? 'اقتراح תعديل בواسطة' : 'Edit suggestion by'} ${getUserName(currentView?.data?.created_by)}`
                  }
                </button>
                {currentView?.data?.created_date && (
                  <span className="text-[10px] text-slate-400">
                    {new Date(currentView.data.created_date).toLocaleDateString(language === 'he' ? 'he-IL' : language === 'ar' ? 'ar-SA' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            className="flex items-center"
          >
            {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      )}

      {/* תוכן */}
      <div className="min-h-[40px]">
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
          // תצוגת הצעה - diff או אנימציה
          <>
            {(() => {
              // תצוגה רגילה - diff או הצעה
              return (
                <div 
                  className="cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => onOpenSuggestionSidebar && onOpenSuggestionSidebar(currentView.data.id)}
                >
                  {currentView.data.type !== 'delete_section' && currentView.data.explanation && typeof currentView.data.explanation === 'string' && (
                    <div className="mb-3 text-sm">
                      <div className="font-semibold text-slate-700 mb-1">הסבר:</div>
                      <TranslatableContent
                        content={currentView.data.explanation}
                        entity={currentView.data}
                        entityType="Suggestion"
                        className="text-slate-600"
                      />
                    </div>
                  )}
                  
                  {currentView.data.type === 'delete_section' ? (
                    <div>
                      {currentView.data.explanation && (
                        <div className="mb-3 p-3 bg-white/60 rounded-lg border border-red-100">
                          <div className="text-sm font-bold text-slate-700 mb-1">{t('explanation')}:</div>
                          <TranslatableContent
                            content={currentView.data.explanation}
                            entity={currentView.data}
                            entityType="Suggestion"
                            className="text-slate-700 text-sm whitespace-pre-wrap"
                          />
                        </div>
                      )}
                      <div className="p-3 md:p-4 bg-red-50 rounded border border-red-200">
                        <div className="text-sm font-bold text-red-700 mb-2">
                          {(language || 'he') === 'he' ? 'סעיף שמוצע למחיקה:' : (language || 'he') === 'ar' ? 'القسم المقترح حذفه:' : 'Section to be deleted:'}
                        </div>
                        <div 
                          className="prose prose-sm max-w-none text-slate-700 line-through opacity-60"
                          dangerouslySetInnerHTML={{ __html: currentView.data.originalContent }}
                        />
                      </div>
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
                    </div>
                  ) : (
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
                  )}
                </div>
              );
            })()}

            {/* כפתורי הצבעה והערות */}
            {(
              <div className="flex items-center gap-2 md:gap-4 mt-4 text-sm flex-wrap relative">
                {voteMutation.isPending && (
                  <div className="absolute inset-0 bg-white/50 rounded-lg flex items-center justify-center z-10">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  </div>
                )}
                {document?.votingButtonsEnabled ? (
                  <>
                    <Button
                      variant={getUserVote(currentView.data.id)?.vote === 'pro' ? 'default' : 'outline'}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!user) { base44.auth.redirectToLogin(window.location.href); return; }
                        if (!canParticipate) { setShowJoinGroupDialog(true); return; }
                        voteMutation.mutate({ suggestionId: currentView.data.id, vote: 'pro', currentVote: getUserVote(currentView.data.id) });
                      }}
                      disabled={voteMutation.isPending}
                      className={`text-xs px-2 md:px-3 ${getUserVote(currentView.data.id)?.vote === 'pro' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    >
                      <ThumbsUp className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                      {currentView.data.proVotes || 0}
                    </Button>
                    <Button
                      variant={getUserVote(currentView.data.id)?.vote === 'con' ? 'default' : 'outline'}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!user) { base44.auth.redirectToLogin(window.location.href); return; }
                        if (!canParticipate) { setShowJoinGroupDialog(true); return; }
                        voteMutation.mutate({ suggestionId: currentView.data.id, vote: 'con', currentVote: getUserVote(currentView.data.id) });
                      }}
                      disabled={voteMutation.isPending}
                      className={`text-xs px-2 md:px-3 ${getUserVote(currentView.data.id)?.vote === 'con' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                    >
                      <ThumbsDown className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                      {currentView.data.conVotes || 0}
                    </Button>
                  </>
                ) : null}
                {document?.votingButtonsEnabled && (
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <VotesNeededCounter 
                      suggestion={currentView.data} 
                      document={document} 
                      acceptedSuggestions={acceptedSuggestions}
                      sectionId={section.id}
                    />
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-[10px] md:text-xs h-7 md:h-8 px-2 md:px-3 flex-shrink-0"
                      onClick={() => onOpenSuggestionSidebar && onOpenSuggestionSidebar(currentView.data.id)}
                    >
                      {t('viewDetails')}
                    </Button>
                  </div>
                )}
                {!document?.votingButtonsEnabled && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-[10px] md:text-xs h-7 md:h-8 px-2 md:px-3 flex-shrink-0"
                    onClick={() => onOpenSuggestionSidebar && onOpenSuggestionSidebar(currentView.data.id)}
                  >
                    {t('viewDetails')}
                  </Button>
                )}
              </div>
            )}

            {/* תגובות להצעה */}
            {currentView?.data?.id && (
              <>
                <div className="mt-3">
                  {(() => {
                    const count = typeof getCommentsCount === 'function' ? getCommentsCount('suggestion', currentView.data.id) : 0;
                    const hasComments = count > 0;
                    return (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleComments(`suggestion-${currentView.data.id}`)}
                        className={`h-7 md:h-8 text-xs px-2 transition-all relative ${
                          hasComments
                            ? 'font-bold text-blue-700 border border-blue-300 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 shadow-sm'
                            : 'text-slate-600 hover:text-blue-600'
                        }`}
                      >
                        <div className="relative">
                          <MessageSquare className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-1' : 'mr-1'} ${hasComments ? 'fill-blue-200' : ''}`} />
                          {hasComments && (
                            <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-blue-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                              {count > 9 ? '9+' : count}
                            </span>
                          )}
                        </div>
                        {t('comments')}{hasComments ? ` (${count})` : ''}
                      </Button>
                    );
                  })()}
                </div>
                {showComments[`suggestion-${currentView.data.id}`] && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <CommentsSection
                      entityType="suggestion"
                      entityId={currentView.data.id}
                      user={user}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* כפתורים מרכזיים - ערוך/תגובה בתצוגה נוכחית */}
      {isFirstView && (
        <div className={`flex flex-wrap gap-1 mt-4 pt-4 border-t border-slate-200 ${isRTL ? 'justify-end' : 'justify-start'}`}>
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
                if (!user) {
                  base44.auth.redirectToLogin(window.location.href);
                  return;
                }
                onEditSection({ ...section, isDeletingSuggestion: true });
              }}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity text-xs min-w-0"
              title={(language || 'he') === 'he' ? 'הצע מחיקת סעיף' : 'Suggest Section Deletion'}
            >
              <Trash2 className={`w-3.5 h-3.5 shrink-0 ${isRTL ? 'ml-1' : 'mr-1'}`} />
              <span className="hidden sm:inline">{(language || 'he') === 'he' ? 'הצע מחיקה' : 'Suggest Delete'}</span>
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