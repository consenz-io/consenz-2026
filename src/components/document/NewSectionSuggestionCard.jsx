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
  const { t, isRTL } = useLanguage();
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
  const [animationPhase, setAnimationPhase] = React.useState(
    suggestion.status === 'accepted' ? 'none' : 'none'
  ); // 'none', 'celebrating', 'transitioning', 'fading'
  const prevStatusRef = React.useRef(suggestion.status);

  // Truncate content for preview
  const getContentPreview = (html) => {
    const div = window.document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || div.innerText || '';
    return text.length > 150 ? text.substring(0, 150) + '...' : text;
  };

  // מעקב אחרי שינוי סטטוס להצגת אנימציה
  React.useEffect(() => {
    if (prevStatusRef.current === 'pending' && suggestion.status === 'accepted') {
      console.log('[ANIMATION] Starting celebration for suggestion:', suggestion.id);
      setAnimationPhase('celebrating');
      
      // שלב 1: חגיגה (3 שניות)
      setTimeout(() => {
        console.log('[ANIMATION] Transitioning to white for suggestion:', suggestion.id);
        setAnimationPhase('transitioning');
      }, 3000);
      
      // שלב 2: התחלת דהייה (אחרי עוד 2 שניות - סה"כ 5 שניות)
      setTimeout(() => {
        console.log('[ANIMATION] Starting fade for suggestion:', suggestion.id);
        setAnimationPhase('fading');
      }, 5000);
    }
    prevStatusRef.current = suggestion.status;
  }, [suggestion.status]);

  // אם בשלב דהייה והסעיף כבר קיים במסמך - אל תציג
  if (animationPhase === 'fading') {
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
      <motion.div
        initial={{ 
          background: 'linear-gradient(135deg, rgb(220 252 231) 0%, rgb(255 255 255) 100%)'
        }}
        animate={{
          background: 'rgb(255 255 255)'
        }}
        transition={{ duration: 2 }}
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
    <Card 
      className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-dashed border-amber-300 hover:border-amber-400 transition-all hover:shadow-lg"
    >
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
            <Plus className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="text-sm md:text-base font-semibold text-slate-900">
                הצעה לסעיף חדש מאת {getUserName(suggestion.created_by)}
              </span>
            </div>
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
            <div className="text-sm bg-white/60 p-3 rounded border border-amber-200 mb-3">
              <TranslatableContent
                content={getContentPreview(suggestion.newContent)}
                entity={suggestion}
                entityType="Suggestion"
                className="text-slate-700"
              />
            </div>
          </div>
        </div>

        <div className={`flex items-center justify-between gap-3 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="flex items-center gap-3 text-sm flex-wrap">
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
                  className={`text-xs ${getUserVote(suggestion.id)?.vote === 'pro' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                >
                  <ThumbsUp className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
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
                  className={`text-xs ${getUserVote(suggestion.id)?.vote === 'con' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                >
                  <ThumbsDown className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                  {suggestion.conVotes || 0}
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1 text-green-600">
                  <ThumbsUp className="w-4 h-4" />
                  <span className="font-medium">{suggestion.proVotes || 0}</span>
                </div>
                <div className="flex items-center gap-1 text-red-600">
                  <ThumbsDown className="w-4 h-4" />
                  <span className="font-medium">{suggestion.conVotes || 0}</span>
                </div>
              </>
            )}
            <VotesNeededCounter 
              suggestion={suggestion}
              document={doc}
              acceptedSuggestions={acceptedSuggestions}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="text-xs h-7 px-3"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSidebar && onOpenSidebar(suggestion.id);
              }}
            >
              {t('viewDetails')}
            </Button>
            {canDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(t('confirmDeleteSuggestion'))) {
                    deleteSuggestionMutation.mutate();
                  }
                }}
                disabled={deleteSuggestionMutation.isPending}
                className="text-xs h-7 px-3"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* תגובות */}
        <div className="mt-3 pt-3 border-t border-amber-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              toggleComments && toggleComments(`suggestion-${suggestion.id}`);
            }}
            className="h-7 text-xs px-2"
          >
            <MessageSquare className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
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
      </CardContent>
    </Card>
  );
}