import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown, Plus, MessageSquare, Trash2, CheckCircle } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import VotesNeededCounter from "./VotesNeededCounter";
import TranslatableContent from "./TranslatableContent";
import CommentsSection from "./CommentsSection";
import { motion, AnimatePresence } from "framer-motion";

export default function NewSectionSuggestionCard({ 
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
  isAdmin
}) {
  const { t, isRTL, language: rawLanguage } = useLanguage();
  const language = rawLanguage || 'he';
  const queryClient = useQueryClient();

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
    const isReallyAccepted = suggestion.status === 'accepted' && 
                             suggestion.suggestionConsensus !== undefined && 
                             suggestion.participantsAtAcceptance !== undefined;
    
    if (prevStatusRef.current === 'pending' && isReallyAccepted && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;
      console.log('[ANIMATION] ✅ Suggestion was REALLY accepted by server, starting celebration:', suggestion.id);
      console.log('[ANIMATION] - suggestionConsensus:', suggestion.suggestionConsensus);
      console.log('[ANIMATION] - participantsAtAcceptance:', suggestion.participantsAtAcceptance);
      setAnimationPhase('celebrating');
      
      // שלב 1: חגיגה (3 שניות)
      setTimeout(() => {
        console.log('[ANIMATION] Transitioning to white for suggestion:', suggestion.id);
        setAnimationPhase('transitioning');
      }, 3000);
      
      // שלב 2: דהייה והעלמה (אחרי עוד 2 שניות - סה"כ 5 שניות)
      setTimeout(() => {
        console.log('[ANIMATION] Fading out suggestion:', suggestion.id);
        setAnimationPhase('fading');
      }, 5000);
      
      // שלב 3: העלמה סופית (אחרי עוד 1 שניה - סה"כ 6 שניות)
      setTimeout(() => {
        console.log('[ANIMATION] Hiding suggestion:', suggestion.id);
        setAnimationPhase('hidden');
      }, 6000);
    } else if (prevStatusRef.current === 'pending' && suggestion.status === 'accepted' && !isReallyAccepted) {
      console.log('[ANIMATION] ⚠️ Status changed to accepted but missing server fields - likely optimistic update, waiting for real update...');
    }
    prevStatusRef.current = suggestion.status;
  }, [suggestion.status, suggestion.suggestionConsensus, suggestion.participantsAtAcceptance]);

  // אם בשלב העלמה סופית - אל תציג כלום
  if (animationPhase === 'hidden') {
    return null;
  }

  // אם ההצעה התקבלה אבל האנימציה לא התחילה - אל תציג
  if (suggestion.status === 'accepted' && animationPhase === 'none') {
    return null;
  }

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
                {suggestion.explanation && typeof suggestion.explanation === 'string' && (
                  <div className="text-xs md:text-sm mb-2">
                    <TranslatableContent
                      content={suggestion.explanation}
                      entity={suggestion}
                      entityType="Suggestion"
                      className="text-slate-600 break-words"
                    />
                  </div>
                )}
                <div className="text-sm bg-white/80 p-3 rounded border border-green-200">
                  <TranslatableContent
                    content={getContentPreview(suggestion.newContent)}
                    entity={suggestion}
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
                content={suggestion.newContent}
                entity={suggestion}
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
      className="group relative p-3 md:p-6 border-2 border-amber-300 rounded-lg hover:border-amber-400 transition-all bg-gradient-to-br from-amber-50 to-yellow-50 scroll-mt-24"
    >
      {/* כותרת עם אינדיקטור של הצעה חדשה */}
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
            <Plus className="w-5 h-5 text-white" />
          </div>
          <div className="text-sm md:text-base font-semibold text-slate-900">
            הצעה לסעיף חדש מאת {getUserName(suggestion.created_by)}
          </div>
        </div>
      </div>

      {/* תוכן ההצעה */}
      <div className="min-h-[100px]">
        {suggestion.explanation && typeof suggestion.explanation === 'string' && (
          <div className="mb-3 text-sm">
            <div className="font-semibold text-slate-700 mb-1">הסבר:</div>
            <TranslatableContent
              content={suggestion.explanation}
              entity={suggestion}
              entityType="Suggestion"
              className="text-slate-600"
            />
          </div>
        )}
        
        <div className="p-3 md:p-4 bg-white/80 rounded border border-amber-200">
          <TranslatableContent
            content={suggestion.newContent}
            entity={suggestion}
            entityType="Suggestion"
            className="prose prose-sm max-w-none"
            renderContent={(content) => (
              <div dangerouslySetInnerHTML={{ __html: content }} />
            )}
          />
        </div>
      </div>

      {/* כפתורי הצבעה והערות */}
      <div className="flex items-center gap-2 md:gap-4 mt-4 text-sm flex-wrap">
        {doc?.votingButtonsEnabled ? (
          <>
            <Button
              variant={getUserVote(suggestion.id)?.vote === 'pro' ? 'default' : 'outline'}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (!user) {
                  base44.auth.redirectToLogin(window.location.href);
                  return;
                }
                voteMutation.mutate({
                  suggestionId: suggestion.id,
                  vote: 'pro',
                  currentVote: getUserVote(suggestion.id)
                });
              }}
              disabled={voteMutation.isPending}
              className={`text-xs px-2 md:px-3 ${getUserVote(suggestion.id)?.vote === 'pro' ? 'bg-green-600 hover:bg-green-700' : ''}`}
            >
              <ThumbsUp className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
              {suggestion.proVotes || 0}
            </Button>
            <Button
              variant={getUserVote(suggestion.id)?.vote === 'con' ? 'default' : 'outline'}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (!user) {
                  base44.auth.redirectToLogin(window.location.href);
                  return;
                }
                voteMutation.mutate({
                  suggestionId: suggestion.id,
                  vote: 'con',
                  currentVote: getUserVote(suggestion.id)
                });
              }}
              disabled={voteMutation.isPending}
              className={`text-xs px-2 md:px-3 ${getUserVote(suggestion.id)?.vote === 'con' ? 'bg-red-600 hover:bg-red-700' : ''}`}
            >
              <ThumbsDown className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
              {suggestion.conVotes || 0}
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1 text-green-600 text-xs md:text-sm">
              <ThumbsUp className="w-3 h-3 md:w-4 md:h-4" />
              <span className="font-medium">{suggestion.proVotes || 0}</span>
            </div>
            <div className="flex items-center gap-1 text-red-600 text-xs md:text-sm">
              <ThumbsDown className="w-3 h-3 md:w-4 md:h-4" />
              <span className="font-medium">{suggestion.conVotes || 0}</span>
            </div>
          </>
        )}
        <div className="flex-shrink-0">
          <VotesNeededCounter 
            suggestion={suggestion}
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
            onOpenSidebar && onOpenSidebar(suggestion.id);
          }}
        >
          {t('viewDetails')}
        </Button>
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
            toggleComments && toggleComments(`suggestion-${suggestion.id}`);
          }}
          className="h-7 md:h-8 text-xs px-2"
        >
          <MessageSquare className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
          {t('comments')} ({getCommentsCount ? getCommentsCount('suggestion', suggestion.id) : 0})
        </Button>
      </div>
      {showComments && showComments[`suggestion-${suggestion.id}`] && (
        <div className="mt-4 pt-4 border-t border-amber-200">
          <CommentsSection
            entityType="suggestion"
            entityId={suggestion.id}
            user={user}
          />
        </div>
      )}
    </div>
  );
}