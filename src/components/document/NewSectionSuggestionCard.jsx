import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown, Plus, MessageSquare, Trash2, Edit2, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import VotesNeededCounter from "./VotesNeededCounter";
import TranslatableContent from "./TranslatableContent";
import CommentsSection from "./CommentsSection";
import DocumentTextContent from "./DocumentTextContent";
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
  targetSuggestionId
}) {
  const { t, isRTL, language: rawLanguage } = useLanguage();
  const language = rawLanguage || 'he';
  const queryClient = useQueryClient();
  const [currentVersionId, setCurrentVersionId] = React.useState('original');
  const [justAccepted, setJustAccepted] = React.useState(false);
  const [animationPhase, setAnimationPhase] = React.useState('none'); // 'none' | 'announcing' | 'celebrating' | 'done'
  const prevStatusRef = React.useRef(suggestion.status);

  // Detect transition to accepted and trigger animation
  React.useEffect(() => {
    if (prevStatusRef.current !== 'accepted' && suggestion.status === 'accepted') {
      setJustAccepted(true);
      setAnimationPhase('announcing');
      setTimeout(() => setAnimationPhase('celebrating'), 1000);
      setTimeout(() => setAnimationPhase('done'), 3500);
      // After animation completes, allow normal hide logic
      setTimeout(() => setJustAccepted(false), 4500);
    }
    prevStatusRef.current = suggestion.status;
  }, [suggestion.status]);

  const deleteSuggestionMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Suggestion.delete(suggestion.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions', doc.id] });
    },
  });

  const canDelete = user && (isAdmin || user.email === suggestion.created_by) && suggestion.status !== 'accepted';

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

  // Navigate when targetSuggestionId changes (from floating nav buttons or other sources)
  React.useEffect(() => {
    if (targetSuggestionId) {
      // Check if this suggestion or any of its versions is the target
      const isTarget = suggestionChain.some(s => s.id === targetSuggestionId);
      if (isTarget) {
        console.log('[NEW SECTION CARD] Navigating to target suggestion:', targetSuggestionId);
        // Find which specific version is the target
        const targetVersion = suggestionChain.find(s => s.id === targetSuggestionId);
        if (targetVersion) {
          setCurrentVersionId(targetVersion.id === suggestion.id ? 'original' : targetVersion.id);
        }
      }
    }
  }, [targetSuggestionId, suggestionChain, suggestion.id]);

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

  // Hide if accepted and converted to edit_section - will appear in section carousel
  if (suggestion.type === 'edit_section' && suggestion.status === 'accepted') {
    return null;
  }
  
  // Hide if accepted - but only after animation completes
  if (suggestion.status === 'accepted' && !justAccepted) {
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

  return (
    <div 
      id={`suggestion-${suggestion.id}`}
      className="group relative p-3 md:p-6 border-2 rounded-lg transition-all scroll-mt-24 border-amber-300 hover:border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-50"
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
                <span className="font-bold text-amber-700 text-lg">{allViews.length - 1}</span> <span className="font-bold text-slate-800">{language === 'he' ? 'הצעות עריכה' : language === 'ar' ? 'اقتراحات تعديل' : 'Edit Suggestions'}</span>
              </p>
            ) : (
              <button 
                onClick={() => setCurrentVersionId('original')}
                className="text-sm font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer transition-colors"
              >
                {`${language === 'he' ? 'עריכה מאת' : language === 'ar' ? 'تعديل بواسطة' : 'Edit by'} ${getUserName(currentVersion.created_by)}`}
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

      {/* כותרת עם אינדיקטור של הצעה חדשה */}
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
            <Plus className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm md:text-base font-semibold text-slate-900 break-words">
              {language === 'he'
                ? `הצעה לסעיף חדש מאת ${getUserName(currentVersion.created_by)}`
                : language === 'ar'
                ? `اقتراح قسم جديد بواسطة ${getUserName(currentVersion.created_by)}`
                : `New section suggestion by ${getUserName(currentVersion.created_by)}`}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {currentVersion.created_date && new Date(currentVersion.created_date).toLocaleDateString(language === 'he' ? 'he-IL' : language === 'ar' ? 'ar-SA' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>

      {/* תוכן ההצעה */}
      <div className="min-h-[100px]">
        {currentVersion.explanation && typeof currentVersion.explanation === 'string' && (
          <div className="mb-3 text-sm">
            <div className="font-semibold text-slate-700 mb-1">{language === 'he' ? 'הסבר:' : language === 'ar' ? 'الشرح:' : 'Explanation:'}</div>
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
              <DocumentTextContent content={content} />
            )}
          />
        </div>
      </div>

      {/* כפתורי הצבעה והערות */}
      <div className="flex items-center gap-2 md:gap-4 mt-4 text-sm flex-wrap">
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
        ) : null}
        {doc?.votingButtonsEnabled && (
          <div className="flex-shrink-0">
            <VotesNeededCounter 
              suggestion={currentVersion}
              document={doc}
              acceptedSuggestions={acceptedSuggestions}
            />
          </div>
        )}
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
        {(() => {
          const count = getCommentsCount ? getCommentsCount('suggestion', currentVersion.id) : 0;
          const hasComments = count > 0;
          return (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                toggleComments && toggleComments(`suggestion-${currentVersion.id}`);
              }}
              className={`h-7 md:h-8 text-xs px-2 transition-all ${
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