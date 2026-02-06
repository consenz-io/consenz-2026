import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown, Plus, MessageSquare, Trash2, CheckCircle, Edit2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import VotesNeededCounter from "./VotesNeededCounter";
import TranslatableContent from "./TranslatableContent";
import CommentsSection from "./CommentsSection";
import { motion, AnimatePresence } from "framer-motion";

const NewSectionSuggestionCard = React.memo(function NewSectionSuggestionCard({ 
  suggestion, 
  document: doc,
  getUserName,
  acceptedSuggestions,
  user,
  getUserVote,
  voteMutation,
  onOpenSidebar,
  getCommentsCount,
  toggleComments,
  showComments,
  isAdmin,
  onEditSuggestion,
  allDocumentSuggestions,
  isAutoAccepting = false,
  targetSuggestionId
}) {
  const { t, isRTL, language: rawLanguage } = useLanguage();
  const language = rawLanguage || 'he';
  const queryClient = useQueryClient();
  const [currentVersionId, setCurrentVersionId] = React.useState('latest');

  const deleteSuggestionMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Suggestion.delete(suggestion.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions', doc.id] });
    },
  });

  const canDelete = user && (isAdmin || user.email === suggestion.created_by) && suggestion.status !== 'accepted';
  const [animationPhase, setAnimationPhase] = React.useState('none');
  const prevStatusRef = React.useRef(suggestion.status);
  const hasAnimatedRef = React.useRef(false);

  // Build version chain for this suggestion (new_section + edit_suggestion types)
  const suggestionChain = React.useMemo(() => {
    if (!allDocumentSuggestions || allDocumentSuggestions.length === 0) return [suggestion];

    let chain = [];
    let current = allDocumentSuggestions.find(s => s.id === suggestion.id);
    if (!current) return [suggestion];

    // Go up to find the root
    while (current && current.parentSuggestionId) {
      const parent = allDocumentSuggestions.find(s => s.id === current.parentSuggestionId);
      if (!parent || chain.some(item => item.id === parent.id)) break;
      chain.unshift(parent);
      current = parent;
    }
    
    if (current && !chain.some(item => item.id === current.id)) {
      chain.unshift(current);
    }

    const root = chain[0];
    if (!root) return [suggestion];

    // Go down to find all descendants in a linear path
    let fullChain = [...chain];
    let head = chain[chain.length - 1];
    let visitedIds = new Set(fullChain.map(s => s.id));

    while (head) {
      const nextInChain = allDocumentSuggestions
        .filter(s => s.parentSuggestionId === head.id && (s.type === 'new_section' || s.type === 'edit_suggestion' || s.type === 'edit_section'))
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0];

      if (nextInChain && !visitedIds.has(nextInChain.id)) {
        fullChain.push(nextInChain);
        visitedIds.add(nextInChain.id);
        head = nextInChain;
      } else {
        head = null;
      }
    }

    // Filter to only show new_section, edit_suggestion, and edit_section types (after conversion), keep all statuses
    const filtered = fullChain.filter(s => s.type === 'new_section' || s.type === 'edit_suggestion' || s.type === 'edit_section');
    console.log('[SUGGESTION CHAIN] Built chain:', filtered.map(s => ({ id: s.id, type: s.type, status: s.status })));
    return filtered;
  }, [suggestion, allDocumentSuggestions]);

  // Build all views: original + versions (circular navigation)
  const allViews = React.useMemo(() => {
    return [
      { type: 'original', data: suggestionChain[0], id: suggestionChain[0]?.id || suggestion.id },
      ...suggestionChain.slice(1).map(s => ({ type: 'version', data: s, id: s.id }))
    ];
  }, [suggestionChain, suggestion]);

  const currentViewIndex = React.useMemo(() => {
    if (currentVersionId === 'latest') {
      return allViews.length - 1;
    }
    if (currentVersionId === 'original') {
      return 0;
    }
    const idx = allViews.findIndex(v => v.id === currentVersionId);
    return idx >= 0 ? idx : allViews.length - 1;
  }, [currentVersionId, allViews]);

  const currentView = allViews[currentViewIndex] || allViews[0];
  const currentVersion = currentView?.data || suggestion;

  // Auto-navigate to newest version when chain updates (only on mount)
  const hasInitializedRef = React.useRef(false);
  React.useEffect(() => {
    if (!hasInitializedRef.current && suggestionChain.length > 0) {
      hasInitializedRef.current = true;
      setCurrentVersionId('latest');
    }
  }, [suggestionChain.length]);

  // Navigate when targetSuggestionId changes (from floating nav buttons)
  React.useEffect(() => {
    if (targetSuggestionId) {
      // Check if this suggestion or any of its versions is the target
      const isTarget = suggestionChain.some(s => s.id === targetSuggestionId);
      if (isTarget) {
        console.log('[NEW SECTION CARD] Navigating to target suggestion:', targetSuggestionId);
        setCurrentVersionId('latest');
      }
    }
  }, [targetSuggestionId, suggestionChain]);

  // Truncate content for preview
  const getContentPreview = (html) => {
    if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.createElement) {
      const div = document.createElement('div');
      div.innerHTML = html;
      const text = div.textContent || div.innerText || '';
      return text.length > 150 ? text.substring(0, 150) + '...' : text;
    }
    return html;
  };

  // מעקב אחרי שינוי סטטוס להצגת אנימציה - רק פעם אחת
  // CRITICAL: וידוא שההצעה באמת התקבלה ברמת השרת ולא רק עדכון אופטימיסטי
  React.useEffect(() => {
    const isReallyAccepted = currentVersion.status === 'accepted' && 
                             currentVersion.suggestionConsensus !== undefined && 
                             currentVersion.participantsAtAcceptance !== undefined;
    
    if (prevStatusRef.current === 'pending' && isReallyAccepted && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;
      console.log('[ANIMATION] ✅ Suggestion was REALLY accepted by server, starting celebration:', currentVersion.id);
      console.log('[ANIMATION] - suggestionConsensus:', currentVersion.suggestionConsensus);
      console.log('[ANIMATION] - participantsAtAcceptance:', currentVersion.participantsAtAcceptance);
      setAnimationPhase('celebrating');
      
      // שלב 1: חגיגה (3 שניות)
      setTimeout(() => {
        console.log('[ANIMATION] Transitioning to white for suggestion:', currentVersion.id);
        setAnimationPhase('transitioning');
      }, 3000);
      
      // שלב 2: דהייה והעלמה (אחרי עוד 2 שניות - סה"כ 5 שניות)
      setTimeout(() => {
        console.log('[ANIMATION] Fading out suggestion:', currentVersion.id);
        setAnimationPhase('fading');
      }, 5000);
      
      // שלב 3: העלמה סופית (אחרי עוד 1 שניה - סה"כ 6 שניות)
      setTimeout(() => {
        console.log('[ANIMATION] Hiding suggestion:', currentVersion.id);
        setAnimationPhase('hidden');
      }, 6000);
    } else if (prevStatusRef.current === 'pending' && currentVersion.status === 'accepted' && !isReallyAccepted) {
      console.log('[ANIMATION] ⚠️ Status changed to accepted but missing server fields - likely optimistic update, waiting for real update...');
    }
    prevStatusRef.current = currentVersion.status;
  }, [currentVersion.status, currentVersion.suggestionConsensus, currentVersion.participantsAtAcceptance]);

  // אם בשלב העלמה סופית - אל תציג כלום
  if (animationPhase === 'hidden') {
    return null;
  }

  // CRITICAL: בדיקה על ההצעה המקורית (suggestion prop), לא על currentVersion
  // כי suggestion היא ההצעה שמוצגת ע"י DocumentContent
  // אם ההצעה המקורית התקבלה והומרה ל-edit_section (כלומר הסעיף כבר נוצר),
  // אסור להציג אותה כהצעה חדשה - היא תופיע בקרוסלה של הסעיף
  if (suggestion.type === 'edit_section' && suggestion.status === 'accepted' && animationPhase === 'none') {
    console.log('[NEW SECTION CARD] Suggestion converted to edit_section, hiding from new section view:', suggestion.id);
    return null;
  }

  const handlePrev = () => {
    if (!allViews || allViews.length === 0) return;
    const prevIndex = (currentViewIndex - 1 + allViews.length) % allViews.length;
    const prevView = allViews[prevIndex];
    setCurrentVersionId(prevView.type === 'original' ? 'original' : prevView.id);
  };

  const handleNext = () => {
    if (!allViews || allViews.length === 0) return;
    const nextIndex = (currentViewIndex + 1) % allViews.length;
    const nextView = allViews[nextIndex];
    setCurrentVersionId(nextView.type === 'original' ? 'original' : nextView.id);
  };

  // שלב החגיגה - מסגרת ירוקה ואייקון (3 שניות)
  if (animationPhase === 'celebrating') {
    return (
      <motion.div
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        <Card 
          className="relative overflow-hidden"
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
          <CardContent className="p-4 md:p-6 relative z-10">
            <div className="flex items-start gap-3 mb-3">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", duration: 0.6 }}
                className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0"
              >
                <CheckCircle className="w-5 h-5 text-white" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-lg font-bold text-green-700 mb-1"
                >
                  ההצעה התקבלה!
                </motion.div>
                {currentVersion.explanation && typeof currentVersion.explanation === 'string' && (
                  <div className="text-xs md:text-sm mb-2">
                    <TranslatableContent
                      content={currentVersion.explanation}
                      entity={currentVersion}
                      entityType="Suggestion"
                      className="text-slate-600 break-words"
                    />
                  </div>
                )}
                <div className="text-sm bg-white/80 p-3 rounded border border-green-200">
                  <TranslatableContent
                    content={getContentPreview(currentVersion.newContent)}
                    entity={currentVersion}
                    entityType="Suggestion"
                    className="text-slate-700"
                  />
                </div>
              </div>
            </div>
          </CardContent>
          </Card>
      </motion.div>
    );
  }

  // שלב המעבר - מעבר הדרגתי למראה של סעיף רגיל (2 שניות)
  if (animationPhase === 'transitioning') {
    return (
      <Card 
        className="relative overflow-hidden transition-all duration-[2000ms] ease-out"
        style={{
          background: 'rgb(255 255 255)',
          border: '1px solid rgb(226 232 240)',
        }}
      >
        <CardContent className="p-4 md:p-6">
          <div className="prose prose-sm max-w-none">
            <TranslatableContent
              content={suggestion.newContent}
              entity={suggestion}
              entityType="Suggestion"
              className="text-slate-700"
              renderContent={(html) => <div dangerouslySetInnerHTML={{ __html: html }} />}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  // שלב הדהייה - דהייה חלקה (1 שניה)
  if (animationPhase === 'fading') {
    return (
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 1 }}
      >
        <Card 
          className="relative overflow-hidden"
          style={{
            background: 'rgb(255 255 255)',
            border: '1px solid rgb(226 232 240)',
          }}
        >
          <CardContent className="p-4 md:p-6">
            <div className="prose prose-sm max-w-none">
              <TranslatableContent
                content={currentVersion.newContent}
                entity={currentVersion}
                entityType="Suggestion"
                className="text-slate-700"
                renderContent={(html) => <div dangerouslySetInnerHTML={{ __html: html }} />}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <div 
      id={`suggestion-${suggestion.id}`}
      className={`group relative p-3 md:p-6 border-2 rounded-lg transition-all scroll-mt-24 ${
        isAutoAccepting 
          ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-cyan-50 ring-2 ring-blue-300 ring-offset-1' 
          : currentView.type === 'original'
            ? 'border-amber-300 hover:border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-50'
            : 'border-blue-300 hover:border-blue-400 bg-gradient-to-br from-blue-50 to-cyan-50'
      }`}
    >
      {/* כפתורי דפדוף בין גרסאות - מעגלי כמו SectionCarousel */}
      {allViews.length > 1 && (
        <div className="flex items-center justify-between mb-4 pb-4 border-b-2 p-3 rounded-lg shadow-sm border-amber-400 bg-gradient-to-r from-amber-100 to-orange-100">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            className="flex items-center bg-white"
          >
            {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>

          <div className="text-center">
            {currentView.type === 'original' ? (
              <p className="text-sm">
                <span className="font-bold text-amber-700 text-lg">{allViews.length - 1}</span> <span className="font-bold text-slate-800">{isRTL ? 'הצעות עריכה' : 'Edit Suggestions'}</span>
              </p>
            ) : (
              <button 
                onClick={() => setCurrentVersionId('original')}
                className="text-sm font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer transition-colors"
              >
                {`${isRTL ? 'עריכה מאת' : 'Edit by'} ${getUserName(currentVersion.created_by)}`}
              </button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            className="flex items-center bg-white"
          >
            {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      )}

      {/* כותרת עם אינדיקטור של הצעה חדשה או גרסה */}
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
          {isAutoAccepting ? (
            <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin text-blue-600 flex-shrink-0" />
          ) : currentView.type === 'original' ? (
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
              <Plus className="w-5 h-5 text-white" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
              <Edit2 className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="text-sm md:text-base font-semibold text-slate-900 break-words">
            {isAutoAccepting 
              ? 'מעבד הצעה...' 
              : currentView.type === 'original'
                ? `הצעה לסעיף חדש מאת ${getUserName(currentVersion.created_by)}`
                : `${isRTL ? 'עריכה מאת' : 'Edit by'} ${getUserName(currentVersion.created_by)}`
            }
          </div>
        </div>
      </div>

      {/* תוכן ההצעה */}
      <div className="min-h-[100px]">
        {currentVersion.explanation && typeof currentVersion.explanation === 'string' && (
          <div className="mb-3 text-sm">
            <div className="font-semibold text-slate-700 mb-1">הסבר:</div>
            <TranslatableContent
              content={currentVersion.explanation}
              entity={currentVersion}
              entityType="Suggestion"
              className="text-slate-600"
            />
          </div>
        )}
        
        <div className="p-3 md:p-4 bg-white/80 rounded border border-amber-200">
          <TranslatableContent
            content={currentVersion.newContent}
            entity={currentVersion}
            entityType="Suggestion"
            className="prose prose-sm max-w-none"
            renderContent={(content) => (
              <div dangerouslySetInnerHTML={{ __html: content }} />
            )}
          />
        </div>
      </div>

      {/* כפתורי הצבעה והערות */}
      <div className="flex items-center gap-2 md:gap-4 mt-4 text-sm flex-wrap relative">
        {voteMutation.isPending && (
          <div className="absolute inset-0 bg-white/50 rounded-lg flex items-center justify-center z-10">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          </div>
        )}
        {doc?.votingButtonsEnabled ? (
          <>
            <Button
              variant={getUserVote(currentVersion.id)?.vote === 'pro' ? 'default' : 'outline'}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (!user) {
                  base44.auth.redirectToLogin(window.location.href);
                  return;
                }
                voteMutation.mutate({
                  suggestionId: currentVersion.id,
                  vote: 'pro',
                  currentVote: getUserVote(currentVersion.id)
                });
              }}
              disabled={voteMutation.isPending}
              className={`text-xs px-2 md:px-3 ${getUserVote(currentVersion.id)?.vote === 'pro' ? 'bg-green-600 hover:bg-green-700' : ''}`}
            >
              <ThumbsUp className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
              {currentVersion.proVotes || 0}
            </Button>
            <Button
              variant={getUserVote(currentVersion.id)?.vote === 'con' ? 'default' : 'outline'}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (!user) {
                  base44.auth.redirectToLogin(window.location.href);
                  return;
                }
                voteMutation.mutate({
                  suggestionId: currentVersion.id,
                  vote: 'con',
                  currentVote: getUserVote(currentVersion.id)
                });
              }}
              disabled={voteMutation.isPending}
              className={`text-xs px-2 md:px-3 ${getUserVote(currentVersion.id)?.vote === 'con' ? 'bg-red-600 hover:bg-red-700' : ''}`}
            >
              <ThumbsDown className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
              {currentVersion.conVotes || 0}
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1 text-green-600 text-xs md:text-sm">
              <ThumbsUp className="w-3 h-3 md:w-4 md:h-4" />
              <span className="font-medium">{currentVersion.proVotes || 0}</span>
            </div>
            <div className="flex items-center gap-1 text-red-600 text-xs md:text-sm">
              <ThumbsDown className="w-3 h-3 md:w-4 md:h-4" />
              <span className="font-medium">{currentVersion.conVotes || 0}</span>
            </div>
          </>
        )}
        <div className="flex-shrink-0">
          <VotesNeededCounter 
            suggestion={currentVersion}
            document={doc}
            acceptedSuggestions={acceptedSuggestions}
          />
        </div>
        <Button 
          size="sm" 
          variant="outline" 
          className="text-[10px] md:text-xs h-7 md:h-8 px-2 md:px-3 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onOpenSidebar && onOpenSidebar(currentVersion.id);
          }}
        >
          {t('viewDetails')}
        </Button>
        {user && currentVersion.status === 'pending' && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEditSuggestion && onEditSuggestion(currentVersion);
            }}
            className="h-7 md:h-8 text-xs px-2"
          >
            <Edit2 className="w-3 h-3 md:w-4 md:h-4" />
          </Button>
        )}
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(t('confirmDeleteSuggestion'))) {
                deleteSuggestionMutation.mutate();
              }
            }}
            disabled={deleteSuggestionMutation.isPending}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 md:h-8 text-xs px-2"
          >
            <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
          </Button>
        )}
      </div>

      {/* תגובות */}
      <div className="mt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            toggleComments && toggleComments(`suggestion-${currentVersion.id}`);
          }}
          className="h-7 md:h-8 text-xs px-2"
        >
          <MessageSquare className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
          {t('comments')} ({getCommentsCount ? getCommentsCount('suggestion', currentVersion.id) : 0})
        </Button>
      </div>
      {showComments && showComments[`suggestion-${currentVersion.id}`] && (
        <div className="mt-4 pt-4 border-t border-amber-200">
          <CommentsSection
            entityType="suggestion"
            entityId={currentVersion.id}
            user={user}
          />
        </div>
      )}
    </div>
  );
});

export default NewSectionSuggestionCard;