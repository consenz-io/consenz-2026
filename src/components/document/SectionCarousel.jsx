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

  const activeCommentEntity = React.useMemo(() => {
    const acceptedEdits = allDocumentSuggestions
      .filter(s => s.sectionId === section.id && s.status === 'accepted' && s.type === 'edit_section')
      .sort((a, b) => new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date));

    if (acceptedEdits.length > 0) {
      return { entityType: 'suggestion', entityId: acceptedEdits[0].id };
    }

    const creationSuggestion = allDocumentSuggestions.find(
      s => s.sectionId === section.id && s.status === 'accepted' && s.type === 'new_section'
    );

    if (creationSuggestion) {
      return { entityType: 'suggestion', entityId: creationSuggestion.id };
    }

    return { entityType: 'section', entityId: section.id };
  }, [allDocumentSuggestions, section.id]);
  
  const [currentSuggestionId, setCurrentSuggestionId] = useState(null);
  const [flashingSection, setFlashingSection] = useState(false);
  const prevSuggestionsStatusRef = React.useRef({});
  const hasAnimatedRef = React.useRef(new Set());
  
  const sortedSuggestions = [...pendingSuggestions].sort((a, b) => {
    const deltaA = Math.abs((a.proVotes || 0) - (a.conVotes || 0));
    const deltaB = Math.abs((b.proVotes || 0) - (b.conVotes || 0));
    if (deltaA !== deltaB) return deltaA - deltaB;
    return new Date(b.created_date) - new Date(a.created_date);
  });
  
  const flashTimerRef = React.useRef(null);

  React.useEffect(() => {
    if (!allSectionSuggestions || allSectionSuggestions.length === 0 || !document?.id) return;
    
    allSectionSuggestions.forEach(sug => {
      const prevStatus = prevSuggestionsStatusRef.current[sug.id];
      
      if (prevStatus === 'pending' && sug.status === 'accepted' && !hasAnimatedRef.current.has(sug.id)) {
        hasAnimatedRef.current.add(sug.id);
        setCurrentSuggestionId('current');
        queryClient.invalidateQueries({ queryKey: ['sections', document.id] });
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

  const allViews = React.useMemo(() => {
    return [
      { type: 'current', data: section, id: 'current' },
      ...sortedSuggestions.map(s => ({ type: 'suggestion', data: s, id: s.id }))
    ];
  }, [section, sortedSuggestions]);
  
  const currentIndex = React.useMemo(() => {
    if (!currentSuggestionId) return 0;
    const idx = allViews.findIndex(v => v.id === currentSuggestionId);
    return idx >= 0 ? idx : 0;
  }, [currentSuggestionId, allViews]);

  const [showTranslated, setShowTranslated] = useState({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [showJoinGroupDialog, setShowJoinGroupDialog] = useState(false);
  
  React.useEffect(() => {
    if (newlyCreatedSuggestionId && sortedSuggestions.length > 0) {
      const foundSuggestion = sortedSuggestions.find(s => s.id === newlyCreatedSuggestionId);
      if (foundSuggestion) {
        setCurrentSuggestionId(newlyCreatedSuggestionId);
        if (onClearNewlyCreated) {
          setTimeout(() => onClearNewlyCreated(), 100);
        }
      }
    }
  }, [newlyCreatedSuggestionId, sortedSuggestions, onClearNewlyCreated]);
  
  React.useEffect(() => {
    if (targetSuggestionId && sortedSuggestions.length > 0) {
      const foundSuggestion = sortedSuggestions.find(s => s.id === targetSuggestionId);
      if (foundSuggestion) {
        setCurrentSuggestionId(targetSuggestionId);
      }
    }
  }, [targetSuggestionId, sortedSuggestions]);
  
  const safeIndex = currentIndex >= allViews.length ? 0 : currentIndex;
  const currentView = allViews && allViews.length > 0 ? (allViews[safeIndex] || allViews[0]) : null;

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
      const versions = await base44.entities.DocumentVersion.filter({ sectionId: section.id });
      const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version)) + 1 : 1;

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

      await base44.entities.Section.delete(section.id);

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
      
      const titlePrompt = `Translate the following HTML content to ${languagePrompts[language]}. Keep ALL HTML tags. Return ONLY the translated HTML:\n${suggestion.title}`;
      const titleResult = await base44.integrations.Core.InvokeLLM({
        prompt: titlePrompt,
        add_context_from_internet: false,
      });
      const translatedTitle = (typeof titleResult === 'string' ? titleResult : titleResult.content || titleResult)
        .replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

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

      const contentPrompt = `Translate the following HTML content to ${languagePrompts[language]}. Keep ALL HTML tags. Return ONLY the translated HTML:\n${suggestion.newContent}`;
      const contentResult = await base44.integrations.Core.InvokeLLM({
        prompt: contentPrompt,
        add_context_from_internet: false,
      });
      const translatedContent = (typeof contentResult === 'string' ? contentResult : contentResult.content || contentResult)
        .replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

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
      setShowTranslated(prev => ({ ...prev, [suggestion.id]: true }));
    },
    onSuccess: (data) => {
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

  React.useEffect(() => {
    if (targetSuggestionId && typeof window !== 'undefined' && window.document) {
      const targetElement = window.document.getElementById(`suggestion-${targetSuggestionId}`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [targetSuggestionId]);

  // צבע מבטא לפי סוג התצוגה
  const isDeleteView = currentView?.data?.type === 'delete_section';
  const isSuggestionView = currentView?.type === 'suggestion';
  const hasSuggestions = allViews.length > 1;

  const navBtnBase = "flex-shrink-0 flex flex-col items-center justify-center gap-1 transition-all select-none focus:outline-none";
  const prevBtnClass = isRTL
    ? `${navBtnBase} w-10 md:w-14 border-l border-slate-200 ${isDeleteView ? 'bg-red-50 hover:bg-red-100 text-red-600' : 'bg-amber-50 hover:bg-amber-100 text-amber-700'} ${isLastView ? 'opacity-35 cursor-default' : 'cursor-pointer'}`
    : `${navBtnBase} w-10 md:w-14 border-r border-slate-200 ${isDeleteView ? 'bg-red-50 hover:bg-red-100 text-red-600' : 'bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800'} ${isFirstView ? 'opacity-35 cursor-default' : 'cursor-pointer'}`;
  const nextBtnClass = isRTL
    ? `${navBtnBase} w-10 md:w-14 border-r border-slate-200 ${isDeleteView ? 'bg-red-50 hover:bg-red-100 text-red-600' : 'bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800'} ${isFirstView ? 'opacity-35 cursor-default' : 'cursor-pointer'}`
    : `${navBtnBase} w-10 md:w-14 border-l border-slate-200 ${isDeleteView ? 'bg-red-50 hover:bg-red-100 text-red-600' : 'bg-amber-50 hover:bg-amber-100 text-amber-700'} ${isLastView ? 'opacity-35 cursor-default' : 'cursor-pointer'}`;

  return (
    <div id={currentSuggestionDisplayId} className={`group relative border-2 rounded-lg hover:shadow-md transition-all overflow-hidden bg-gradient-to-br from-white to-slate-50/30 ${flashingSection ? 'suggestion-accepted-flash border-green-400' : hasSuggestions ? (isDeleteView ? 'border-red-300' : 'border-amber-300') : 'border-slate-300 hover:border-blue-400'}`}>

      {/* כותרת */}
      <div className="flex items-center justify-between px-3 md:px-6 pt-3 md:pt-4 mb-2">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="text-xs md:text-sm font-medium text-slate-500">
            {t('section')} {sectionIndex + 1}
          </div>
          {hasSuggestions && (
            <Badge
              variant="outline"
              className={`text-[10px] md:text-xs font-bold ${isDeleteView ? 'text-red-600 border-red-300 bg-red-50' : 'text-amber-700 border-amber-300 bg-amber-50'}`}
            >
              {currentIndex + 1} / {allViews.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 md:gap-2 relative z-10">
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

      {/* שורת מידע על ההצעה הנוכחית */}
      {hasSuggestions && (
        <div className={`mx-3 md:mx-6 mb-3 px-3 py-2 rounded-lg border text-center ${isDeleteView ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
          {isFirstView ? (
            <p className="text-sm">
              <span className={`font-bold text-lg ${isDeleteView ? 'text-red-700' : 'text-amber-700'}`}>{sortedSuggestions.length}</span>{' '}
              <span className="font-bold text-slate-800">{t('editSuggestions')}</span>
              <span className="text-slate-400 mx-2">·</span>
              <span className="text-slate-500 text-xs">{language === 'he' ? 'לחץ על החצים לדפדוף' : language === 'ar' ? 'انقر على الأسهم للتصفح' : 'use arrows to browse'}</span>
            </p>
          ) : (
            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={() => setCurrentSuggestionId('current')}
                className={`text-sm font-bold hover:underline cursor-pointer transition-colors ${isDeleteView ? 'text-red-700 hover:text-red-900' : 'text-amber-800 hover:text-amber-900'}`}
              >
                {isDeleteView
                  ? (language === 'he' ? 'הצעה למחיקת הסעיף' : language === 'ar' ? 'اقتراح لحذف القسم' : 'Delete Section Suggestion')
                  : `${language === 'he' ? 'הצעת עריכה מאת' : language === 'ar' ? 'اقتراح تعديل بواسطة' : 'Edit suggestion by'} ${getUserName(currentView?.data?.created_by)}`
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
      )}

      {/* אזור ראשי: כפתורי ניווט בצדדים + תוכן במרכז */}
      <div className="flex items-stretch">
        {/* כפתור שמאל */}
        {hasSuggestions && (
          <button
            onClick={isRTL ? handleNext : handlePrev}
            className={prevBtnClass}
            aria-label={isRTL ? t('nextSuggestion') : t('previousSuggestion')}
          >
            {isRTL ? <ChevronRight className="w-6 h-6 md:w-7 md:h-7" /> : <ChevronLeft className="w-6 h-6 md:w-7 md:h-7" />}
            <span className="text-[9px] font-semibold opacity-60 leading-tight text-center">
              {isRTL
                ? (language === 'he' ? 'הבא' : language === 'ar' ? 'التالي' : 'next')
                : (language === 'he' ? 'הקודם' : language === 'ar' ? 'السابق' : 'prev')}
            </span>
          </button>
        )}

        {/* תוכן */}
        <div className={`flex-1 min-w-0 py-1 ${hasSuggestions ? 'px-3 md:px-4' : 'px-3 md:px-6'} pb-3 md:pb-4`}>
          <div className="min-h-[40px]">
            {!currentView ? null : currentView.type === 'current' ? (
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
                              {language === 'he' ? 'סעיף שמוצע למחיקה:' : language === 'ar' ? 'القسم المقترح حذفه:' : 'Section to be deleted:'}
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

          {/* כפתורי עריכה/מחיקה בתצוגה הנוכחית */}
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
                    if (!user) { base44.auth.redirectToLogin(window.location.href); return; }
                    onEditSection({ ...section, isDeletingSuggestion: true });
                  }}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity text-xs min-w-0"
                  title={language === 'he' ? 'הצע מחיקת סעיף' : 'Suggest Section Deletion'}
                >
                  <Trash2 className={`w-3.5 h-3.5 shrink-0 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                  <span className="hidden sm:inline">{language === 'he' ? 'הצעת מחיקה' : 'Suggest Delete'}</span>
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
                  <span className="hidden sm:inline">{language === 'he' ? 'מחק (מנהל)' : 'Delete (Admin)'}</span>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* כפתור ימין */}
        {hasSuggestions && (
          <button
            onClick={isRTL ? handlePrev : handleNext}
            className={nextBtnClass}
            aria-label={isRTL ? t('previousSuggestion') : t('nextSuggestion')}
          >
            {isRTL ? <ChevronLeft className="w-6 h-6 md:w-7 md:h-7" /> : <ChevronRight className="w-6 h-6 md:w-7 md:h-7" />}
            <span className="text-[9px] font-semibold opacity-60 leading-tight text-center">
              {isRTL
                ? (language === 'he' ? 'הקודם' : language === 'ar' ? 'السابق' : 'prev')
                : (language === 'he' ? 'הבא' : language === 'ar' ? 'التالي' : 'next')}
            </span>
          </button>
        )}
      </div>
      
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