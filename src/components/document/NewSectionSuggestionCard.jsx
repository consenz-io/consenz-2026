import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown, Plus, MessageSquare, Trash2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import VotesNeededCounter from "./VotesNeededCounter";
import TranslatableContent from "./TranslatableContent";
import CommentsSection from "./CommentsSection";

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

  // Truncate content for preview
  const getContentPreview = (html) => {
    const div = window.document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || div.innerText || '';
    return text.length > 150 ? text.substring(0, 150) + '...' : text;
  };

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