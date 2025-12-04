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

export default function SectionCarousel({
  section,
  pendingSuggestions,
  document,
  user,
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
  onClearNewlyCreated
}) {
  const { t, isRTL, language } = useLanguage();
  const navigate = useNavigate();
  
  // שומר את ה-ID של ההצעה הנוכחית במקום index
  const [currentSuggestionId, setCurrentSuggestionId] = useState(null);
  
  // שומר הצעות שהתקבלו בזמן שהיוזר צופה בהן - כדי שלא ייעלמו פתאום
  const [recentlyAcceptedSuggestions, setRecentlyAcceptedSuggestions] = useState({});
  
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
  
  // אם היוזר צופה בהצעה שהתקבלה - נשמור אותה כדי להמשיך להציג
  React.useEffect(() => {
    if (currentSuggestionId && currentSuggestionId !== 'current') {
      // בדוק אם ההצעה הנוכחית כבר לא ב-pending אבל היוזר עדיין צופה בה
      const suggestionInPending = pendingSuggestions.find(s => s.id === currentSuggestionId);
      if (!suggestionInPending && !recentlyAcceptedSuggestions[currentSuggestionId]) {
        // ההצעה נעלמה מה-pending - כנראה התקבלה
        // נחפש אותה בקאש או נשמור גרסה אחרונה שראינו
        const lastKnownVersion = allViews.find(v => v.id === currentSuggestionId)?.data;
        if (lastKnownVersion) {
          setRecentlyAcceptedSuggestions(prev => ({
            ...prev,
            [currentSuggestionId]: { ...lastKnownVersion, status: 'accepted' }
          }));
        }
      }
    }
  }, [pendingSuggestions, currentSuggestionId]);

  // רשימת כל ה"עמודים": תוכן נוכחי + הצעות ממויינות + הצעות שהתקבלו אבל היוזר עדיין צופה בהן
  const allViews = React.useMemo(() => {
    const views = [
      { type: 'current', data: section, id: 'current' },
      ...sortedSuggestions.map(s => ({ type: 'suggestion', data: s, id: s.id }))
    ];
    
    // אם היוזר צופה בהצעה שהתקבלה ועדיין לא נמצאת ברשימה - נוסיף אותה
    if (currentSuggestionId && 
        currentSuggestionId !== 'current' && 
        !views.find(v => v.id === currentSuggestionId) &&
        recentlyAcceptedSuggestions[currentSuggestionId]) {
      views.push({
        type: 'suggestion',
        data: recentlyAcceptedSuggestions[currentSuggestionId],
        id: currentSuggestionId
      });
    }
    
    return views;
  }, [section, sortedSuggestions, currentSuggestionId, recentlyAcceptedSuggestions]);
  
  // מחשב את ה-index הנוכחי לפי ה-ID
  const currentIndex = React.useMemo(() => {
    if (!currentSuggestionId) return 0;
    const idx = allViews.findIndex(v => v.id === currentSuggestionId);
    return idx >= 0 ? idx : 0;
  }, [currentSuggestionId, allViews]);
  const [showTranslated, setShowTranslated] = useState({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  
  // Effect to scroll to newly created suggestion
  React.useEffect(() => {
    if (newlyCreatedSuggestionId && sortedSuggestions.length > 0) {
      const suggestion = sortedSuggestions.find(s => s.id === newlyCreatedSuggestionId);
      if (suggestion) {
        setCurrentSuggestionId(newlyCreatedSuggestionId);
        // Clear the flag after navigating
        if (onClearNewlyCreated) {
          setTimeout(() => onClearNewlyCreated(), 100);
        }
      }
    }
  }, [newlyCreatedSuggestionId, sortedSuggestions, onClearNewlyCreated]);
  
  // Reset if current suggestion no longer exists
  const safeIndex = currentIndex >= allViews.length ? 0 : currentIndex;
  const currentView = allViews[safeIndex] || allViews[0];

  // דפדוף מעגלי - משתמש ב-ID במקום index
  const handleNext = () => {
    const nextIndex = (currentIndex + 1) % allViews.length;
    setCurrentSuggestionId(allViews[nextIndex].id);
  };

  const handlePrev = () => {
    const prevIndex = (currentIndex - 1 + allViews.length) % allViews.length;
    setCurrentSuggestionId(allViews[prevIndex].id);
  };

  const isFirstView = currentIndex === 0;
  const isLastView = currentIndex === allViews.length - 1;

  const queryClient = useQueryClient();

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
      if (saveToHistory) {
        // Get existing versions to calculate next version number
        const versions = await base44.entities.DocumentVersion.filter({ sectionId: section.id });
        const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version)) + 1 : 1;
        
        // Save current content to version history before deletion
        await base44.entities.DocumentVersion.create({
          documentId: section.documentId,
          sectionId: section.id,
          content: section.content,
          changeDescription: t('deleteSection'),
          version: nextVersion,
          changeType: 'direct_edit',
        });
      }
      
      // Delete the section
      await base44.entities.Section.delete(section.id);
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

  return (
    <div id={`section-${section.id}`} className="group relative p-3 md:p-6 border-2 border-slate-300 rounded-lg hover:border-blue-400 hover:shadow-md transition-all bg-gradient-to-br from-white to-slate-50/30">
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
        <div className="flex items-center gap-1 md:gap-2">
          {/* כפתור היסטוריה - פותח sidebar */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistorySidebar(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-blue-600 h-7 md:h-8 px-2 md:px-3"
          >
            <History className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
            <span className="hidden md:inline">{t('history')}</span>
          </Button>
        </div>
      </div>

      {/* כפתורי דפדוף */}
      {allViews.length > 1 && (
        <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 p-3 rounded-lg shadow-sm">
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
              <button 
                onClick={() => setCurrentSuggestionId('current')}
                className="text-sm font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer transition-colors"
              >
                {t('viewCurrentVersion')}
              </button>
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
      <div className="min-h-[200px]">
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleComments(`section-${section.id}`)}
                className="text-slate-600 hover:text-blue-600 h-7 md:h-8 text-xs px-2"
              >
                <MessageSquare className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                {t('comments')} ({getCommentsCount('section', section.id)})
              </Button>
            </div>
            {showComments[`section-${section.id}`] && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <CommentsSection
                  entityType="section"
                  entityId={section.id}
                  user={user}
                />
              </div>
            )}
          </>
        ) : (
          // תצוגת הצעה - diff
          <>
            <div 
              className="cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => onOpenSuggestionSidebar && onOpenSuggestionSidebar(currentView.data.id)}
            >
              {currentView.data.explanation && typeof currentView.data.explanation === 'string' && (
                <div className="mb-3 text-sm">
                  <TranslatableContent
                    content={currentView.data.explanation}
                    entity={currentView.data}
                    entityType="Suggestion"
                    className="text-slate-600"
                  />
                </div>
              )}
              
              {currentView.data.originalContent ? (
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
                  />
                </div>
              )}
            </div>

            {/* כפתורי הצבעה והערות */}
            <div className="flex items-center gap-2 md:gap-4 mt-4 text-sm flex-wrap">
              {document?.votingButtonsEnabled ? (
                <>
                  <Button
                    variant={getUserVote(currentView.data.id)?.vote === 'pro' ? 'default' : 'outline'}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!user) {
                        base44.auth.redirectToLogin(window.location.href);
                        return;
                      }
                      voteMutation.mutate({
                        suggestionId: currentView.data.id,
                        vote: 'pro',
                        currentVote: getUserVote(currentView.data.id)
                      });
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
                      if (!user) {
                        base44.auth.redirectToLogin(window.location.href);
                        return;
                      }
                      voteMutation.mutate({
                        suggestionId: currentView.data.id,
                        vote: 'con',
                        currentVote: getUserVote(currentView.data.id)
                      });
                    }}
                    disabled={voteMutation.isPending}
                    className={`text-xs px-2 md:px-3 ${getUserVote(currentView.data.id)?.vote === 'con' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                  >
                    <ThumbsDown className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                    {currentView.data.conVotes || 0}
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1 text-green-600 text-xs md:text-sm">
                    <ThumbsUp className="w-3 h-3 md:w-4 md:h-4" />
                    <span className="font-medium">{currentView.data.proVotes || 0}</span>
                  </div>
                  <div className="flex items-center gap-1 text-red-600 text-xs md:text-sm">
                    <ThumbsDown className="w-3 h-3 md:w-4 md:h-4" />
                    <span className="font-medium">{currentView.data.conVotes || 0}</span>
                  </div>
                </>
              )}
              <div className="flex-shrink-0">
                <VotesNeededCounter 
                  suggestion={currentView.data} 
                  document={document} 
                  acceptedSuggestions={acceptedSuggestions}
                  sectionId={section.id}
                />
              </div>
              <Link to={`${createPageUrl("Profile")}?userId=${users?.find(u => u.email === currentView.data.created_by)?.id}`} className="flex-shrink-0">
                <Badge variant="outline" className="text-[10px] md:text-xs hover:bg-slate-50 cursor-pointer whitespace-nowrap">
                  {t('by')} {getUserName(currentView.data.created_by)}
                </Badge>
              </Link>
              <Button 
                size="sm" 
                variant="outline" 
                className="text-[10px] md:text-xs h-7 md:h-8 px-2 md:px-3 flex-shrink-0"
                onClick={() => onOpenSuggestionSidebar && onOpenSuggestionSidebar(currentView.data.id)}
              >
                {t('viewDetails')}
              </Button>
            </div>

            {/* תגובות להצעה */}
            <div className="mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleComments(`suggestion-${currentView.data.id}`)}
                className="h-7 md:h-8 text-xs px-2"
              >
                <MessageSquare className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                {t('comments')} ({getCommentsCount('suggestion', currentView.data.id)})
              </Button>
            </div>
            {showComments[`suggestion-${currentView.data.id}`] && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <CommentsSection
                  entityType="suggestion"
                  entityId={currentView.data.id}
                  user={user}
                  sectionId={section?.id}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* כפתורים מרכזיים - ערוך/תגובה בתצוגה נוכחית */}
      {isFirstView && (
        <div className={`flex gap-2 mt-4 pt-4 border-t border-slate-200 ${isRTL ? 'justify-end' : 'justify-start'}`}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (!user) {
                base44.auth.redirectToLogin(window.location.href);
                return;
              }
              onEditSection(section);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Edit className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
            {t('suggestEditSection')}
          </Button>
          {isAdmin && onDirectEdit && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onDirectEdit(section)}
              className="bg-purple-600 hover:bg-purple-700 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Edit className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
              עריכה ישירה
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
              title={t('deleteSection')}
            >
              <Trash2 className="w-4 h-4" />
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
    </div>
  );
}