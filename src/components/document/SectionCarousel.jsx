import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, History, Edit, MessageSquare, ThumbsUp, ThumbsDown, Languages, Loader2, Trash2, CheckCircle, Sparkles } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { base44 } from "@/api/base44Client";
import DeleteSectionDialog from "./DeleteSectionDialog";
import SectionHistorySidebar from "./SectionHistorySidebar";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import SectionDiff from "./SectionDiff";
import VotesNeededCounter from "./VotesNeededCounter";
import CommentsSection from "./CommentsSection";
import TranslatableContent from "./TranslatableContent";
import DocumentTextContent from "./DocumentTextContent";
import { motion } from "framer-motion";
import { toast } from "sonner";

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
  onClearNewlyCreated,
  targetSuggestionId,
  publicProfiles
}) {
  const { t, isRTL, language: rawLanguage } = useLanguage();
  const language = rawLanguage || 'he';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // שליפת כל ההצעות של הסעיף (לא רק pending) כדי לעקוב אחרי שינויי סטטוס
  const { data: allSectionSuggestions = [] } = useQuery({
    queryKey: ['suggestions', document?.id],
    enabled: false,
    select: (data) => {
      if (!data) return [];
      
      // הצעות ישירות לסעיף הזה
      const directSuggestions = data.filter(s => 
        s.sectionId === section.id && 
        (s.type === 'edit_section' || s.type === 'delete_section')
      );
      
      // מצא IDs של ההצעות השייכות לסעיף
      const sectionSuggestionIds = new Set(directSuggestions.map(s => s.id));
      
      // הצעות edit_suggestion שמקושרות להצעות של הסעיף הזה
      const editSuggestions = data.filter(s => 
        s.type === 'edit_suggestion' && 
        s.parentSuggestionId && 
        sectionSuggestionIds.has(s.parentSuggestionId)
      );
      
      return [...directSuggestions, ...editSuggestions];
    },
    staleTime: 0,
  });
  
  // שומר את ה-ID של ההצעה הנוכחית במקום index
  const [currentSuggestionId, setCurrentSuggestionId] = useState(null);
  
  // שומר הצעות שהתקבלו בזמן שהיוזר צופה בהן - כדי שלא ייעלמו פתאום
  const [recentlyAcceptedSuggestions, setRecentlyAcceptedSuggestions] = useState({});
  
  // מעקב אחרי אנימציות של הצעות מקובלות
  const [animationPhases, setAnimationPhases] = useState({});
  const [recentlyUpdatedSections, setRecentlyUpdatedSections] = useState({});
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
  
  // מעקב אחרי שינוי סטטוס להצגת אנימציה - עובד על כל ההצעות
  React.useEffect(() => {
    if (!allSectionSuggestions || allSectionSuggestions.length === 0 || !document?.id) return;
    
    allSectionSuggestions.forEach(sug => {
      const prevStatus = prevSuggestionsStatusRef.current[sug.id];
      
      // זיהוי מעבר מ-pending ל-accepted
      if (prevStatus === 'pending' && sug.status === 'accepted' && !hasAnimatedRef.current.has(sug.id)) {
        hasAnimatedRef.current.add(sug.id);
        console.log('[EDIT ANIMATION] Starting celebration for suggestion:', sug.id);
        
        // אם המשתמש לא צופה בהצעה הזו - מעביר אותו אליה
        if (currentSuggestionId !== sug.id) {
          setCurrentSuggestionId(sug.id);
        }
        
        // שלב 0: הכרזה (1 שניה)
        setAnimationPhases(prev => ({ ...prev, [sug.id]: 'announcing' }));
        
        setTimeout(() => {
          console.log('[EDIT ANIMATION] Starting celebration for suggestion:', sug.id);
          setAnimationPhases(prev => ({ ...prev, [sug.id]: 'celebrating' }));
        }, 1000);
        
        // שלב 1: חגיגה (2.5 שניות)
        setTimeout(() => {
          console.log('[EDIT ANIMATION] Transitioning to normal for suggestion:', sug.id);
          setAnimationPhases(prev => ({ ...prev, [sug.id]: 'transitioning' }));
        }, 3500);
        
        // שלב 2: מיד חזרה לסעיף עם תוכן מעודכן
        setTimeout(() => {
        console.log('[EDIT ANIMATION] Completed, showing as updated section:', sug.id);
        setAnimationPhases(prev => ({ ...prev, [sug.id]: 'completed' }));
        // סימון הסעיף כעדכן לאחרונה
        setRecentlyUpdatedSections(prev => ({ ...prev, [section.id]: Date.now() }));
        // חוזרים לתצוגת הסעיף הנוכחי - עכשיו הוא מעודכן
        setCurrentSuggestionId('current');
        // רענון הסעיפים כדי לקבל את השינוי
        queryClient.invalidateQueries({ queryKey: ['sections', document.id] });
        }, 1000);
        
        // שלב 3: הסרת badge "עודכן עכשיו" (אחרי 10 שניות מהתחלה)
        setTimeout(() => {
          setRecentlyUpdatedSections(prev => {
            const updated = { ...prev };
            delete updated[section.id];
            return updated;
          });
        }, 10000);
      }
      
      prevSuggestionsStatusRef.current[sug.id] = sug.status;
    });
  }, [allSectionSuggestions, currentSuggestionId, document.id, queryClient]);

  // רשימת כל ה"עמודים": תוכן נוכחי + הצעות ממויינות + הצעות באנימציה
  const allViews = React.useMemo(() => {
    const views = [
      { type: 'current', data: section, id: 'current' },
      ...sortedSuggestions.map(s => ({ type: 'suggestion', data: s, id: s.id }))
    ];
    
    // אם יש הצעה באנימציה שכבר לא ב-pending - נוסיף אותה לתצוגה
    if (allSectionSuggestions && allSectionSuggestions.length > 0) {
      allSectionSuggestions.forEach(sug => {
        const animationPhase = animationPhases[sug.id];
        if (animationPhase && animationPhase !== 'hidden' && !views.find(v => v.id === sug.id)) {
          views.push({
            type: 'suggestion',
            data: sug,
            id: sug.id
          });
        }
      });
    }
    
    return views;
  }, [section, sortedSuggestions, allSectionSuggestions, animationPhases]);
  
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

      // Always save the section as deleted (empty content) to version history
      await base44.entities.DocumentVersion.create({
        documentId: section.documentId,
        sectionId: section.id,
        content: '',
        changeDescription: saveToHistory ? t('deleteSection') : 'Section deletion',
        version: nextVersion,
        changeType: 'direct_edit',
      });

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

  return (
    <div id={currentSuggestionDisplayId} className="group relative p-3 md:p-6 border-2 border-slate-300 rounded-lg hover:border-blue-400 hover:shadow-md transition-all bg-gradient-to-br from-white to-slate-50/30">
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

      {/* כפתורי דפדוף - רק אם לא באנימציה */}
      {allViews.length > 1 && !['announcing', 'celebrating', 'transitioning', 'completed'].includes(animationPhases[currentView?.data?.id]) && (
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
                 : `${(language || 'he') === 'he' ? 'הצעת עריכה מאת' : (language || 'he') === 'ar' ? 'اقتراح تعديل بواسطة' : 'Edit suggestion by'} ${getUserName(currentView?.data?.created_by)}`
                }
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
            {recentlyUpdatedSections[section.id] && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-sm font-medium text-green-700"
              >
                <Sparkles className="w-4 h-4" />
                עודכן עכשיו ✓
              </motion.div>
            )}
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
                onClick={() => {
                  if (!showComments[`section-${section.id}`]) {
                    toggleComments(`section-${section.id}`);
                  } else {
                    toggleComments(`section-${section.id}`);
                  }
                }}
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
                  relatedSuggestionIds={(allSectionSuggestions || []).map(s => s.id)}
                  key={`section-${section.id}-all-comments`}
                />
              </div>
            )}
          </>
        ) : (
          // תצוגת הצעה - diff או אנימציה
          <>
            {(() => {
              const animationPhase = animationPhases[currentView.data.id] || 'none';
              
              // שלב ההכרזה - הודעה גדולה (1 שניה)
              if (animationPhase === 'announcing') {
                return (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="relative overflow-hidden rounded-lg p-8 text-center"
                    style={{
                      background: 'linear-gradient(135deg, rgb(240 253 244) 0%, rgb(220 252 231) 100%)',
                      border: '2px solid rgb(34 197 94)',
                    }}
                  >
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2, duration: 0.4 }}
                      className="text-2xl font-bold text-green-700"
                    >
                      🎉 ההצעה עברה את סף התמיכה!
                    </motion.div>
                  </motion.div>
                );
              }
              
              // שלב החגיגה - מסגרת ירוקה ואייקון (2.5 שניות)
              if (animationPhase === 'celebrating') {
                return (
                  <motion.div
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                    className="relative overflow-hidden rounded-lg p-4"
                    style={{
                      background: 'linear-gradient(135deg, rgb(240 253 244) 0%, rgb(220 252 231) 100%)',
                      border: '2px solid rgb(34 197 94)',
                    }}
                  >
                    <motion.div
                      className="absolute inset-0 bg-green-500/10"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 0.3, 0.1] }}
                      transition={{ duration: 1 }}
                    />
                    <div className="relative z-10">
                      <div className="flex items-start gap-3 mb-3">
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: "spring", duration: 0.6 }}
                          className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0"
                        >
                          <CheckCircle className="w-5 h-5 text-white" />
                        </motion.div>
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className="text-lg font-bold text-green-700"
                        >
                          ההצעה התקבלה!
                        </motion.div>
                      </div>
                      <div className="prose prose-sm max-w-none">
                        <DocumentTextContent content={currentView.data.newContent} className="text-slate-700" />
                      </div>
                    </div>
                  </motion.div>
                );
              }
              
              // שלב המעבר - מעבר הדרגתי למראה של סעיף רגיל (1.5 שניות)
              if (animationPhase === 'transitioning') {
                return (
                  <motion.div
                    initial={{ 
                      background: 'linear-gradient(135deg, rgb(240 253 244) 0%, rgb(220 252 231) 100%)',
                      borderColor: 'rgb(34 197 94)',
                    }}
                    animate={{ 
                      background: 'rgb(255 255 255)',
                      borderColor: 'rgb(226 232 240)',
                    }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                    className="relative overflow-hidden rounded-lg p-4 border-2"
                  >
                    <div className="prose prose-sm max-w-none">
                      <DocumentTextContent content={currentView.data.newContent} className="text-slate-700" />
                    </div>
                  </motion.div>
                );
              }
              
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
                      />
                    </div>
                  )}
                </div>
              );
            })()}

            {/* כפתורי הצבעה והערות - רק אם לא באנימציה */}
            {!['announcing', 'celebrating', 'transitioning', 'completed'].includes(animationPhases[currentView.data.id]) && (
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
                {(() => {
                  const creatorEmail = currentView?.data?.created_by;
                  if (!creatorEmail) return null;
                  const userId = users?.find(u => u.email === creatorEmail)?.id;
                  if (!userId) return (
                    <Badge variant="outline" className="text-[10px] md:text-xs whitespace-nowrap">
                      {t('by')} {getUserName(creatorEmail)}
                    </Badge>
                  );
                  return (
                    <Link to={`${createPageUrl("Profile")}?userId=${userId}`} className="flex-shrink-0">
                      <Badge variant="outline" className="text-[10px] md:text-xs hover:bg-slate-50 cursor-pointer whitespace-nowrap">
                        {t('by')} {getUserName(creatorEmail)}
                      </Badge>
                    </Link>
                  );
                })()}
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

            {/* תגובות להצעה - רק אם לא באנימציה */}
            {currentView?.data?.id && !['announcing', 'celebrating', 'transitioning', 'completed'].includes(animationPhases[currentView.data.id]) && (
              <>
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
              className="text-red-600 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
              title={(language || 'he') === 'he' ? 'הצע מחיקת סעיף' : 'Suggest Section Deletion'}
            >
              <Trash2 className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
              <span className="hidden md:inline">{(language || 'he') === 'he' ? 'הצע מחיקה' : 'Suggest Delete'}</span>
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="text-red-700 hover:text-red-900 hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-opacity"
              title={t('deleteSection')}
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden md:inline text-xs">{(language || 'he') === 'he' ? 'מחק (מנהל)' : 'Delete (Admin)'}</span>
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