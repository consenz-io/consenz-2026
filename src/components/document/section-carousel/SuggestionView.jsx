import React from "react";
import { Edit, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import SectionDiff from "../SectionDiff";
import TranslatableContent from "../TranslatableContent";
import DocumentTextContent from "../DocumentTextContent";
import VotingProgressSection from "../VotingProgressSection";
import CommentsSection from "../CommentsSection";
import { base44 } from "@/api/base44Client";

/**
 * Renders a suggestion view — proposed content (diff or new), voting buttons,
 * and comments. Extracted from SectionCarousel so it only re-renders when the
 * active suggestion data changes.
 */
const SuggestionView = React.memo(function SuggestionView({
  currentView,
  section,
  document,
  user,
  isRTL,
  language,
  t,
  canParticipate,
  isGhost,
  getUserVote,
  voteMutation,
  getUserName,
  onOpenSuggestionSidebar,
  onEditSuggestion,
  onNeedJoinGroup,
  getCommentsCount,
  toggleComments,
  showComments,
}) {
  const suggestion = currentView.data;
  const isDeleteType = suggestion.type === 'delete_section';
  const hasOriginalContent = suggestion.originalContent && !isGhost;

  const commentCount = typeof getCommentsCount === 'function' ? getCommentsCount('suggestion', suggestion.id) : 0;
  const hasComments = commentCount > 0;
  const commentsKey = `suggestion-${suggestion.id}`;

  return (
    <>
      {/* Suggestion content — diff or new content */}
      <div
        className="cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => onOpenSuggestionSidebar && onOpenSuggestionSidebar(suggestion.id)}
      >
        {isDeleteType ? (
          <div>
            <div className="p-3 md:p-4 bg-red-50 rounded border border-red-200">
              <div className="text-sm font-bold text-red-700 mb-2">
                {(language || 'he') === 'he' ? 'סעיף שמוצע למחיקה:' : (language || 'he') === 'ar' ? 'القسم المقترح حذفه:' : 'Section to be deleted:'}
              </div>
              <div
                className="prose prose-sm max-w-none text-slate-700 line-through opacity-60"
                dangerouslySetInnerHTML={{ __html: suggestion.originalContent }}
              />
            </div>
            {suggestion.explanation && (
              <div className="mt-3 p-3 bg-white/60 rounded-lg border border-red-100">
                <div className="text-sm font-bold text-slate-700 mb-1">{t('explanation')}:</div>
                <TranslatableContent
                  content={suggestion.explanation}
                  entity={suggestion}
                  entityType="Suggestion"
                  className="text-slate-700 text-sm whitespace-pre-wrap"
                />
              </div>
            )}
          </div>
        ) : hasOriginalContent ? (
          <div>
            <SectionDiff
              originalContent={suggestion.originalContent}
              newContent={suggestion.newContent}
              documentId={document?.id}
              sectionId={section?.id}
              suggestion={suggestion}
              section={section}
            />
            {suggestion.explanation && typeof suggestion.explanation === 'string' && (
              <div className="mt-3 text-sm">
                <div className="font-semibold text-slate-700 mb-1">{t('explanation')}:</div>
                <TranslatableContent
                  content={suggestion.explanation}
                  entity={suggestion}
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
                content={suggestion.newContent}
                entity={suggestion}
                entityType="Suggestion"
                className="prose prose-sm max-w-none"
                renderContent={(content) => (
                  <DocumentTextContent content={content} />
                )}
              />
            </div>
            {suggestion.explanation && typeof suggestion.explanation === 'string' && (
              <div className="mt-3 text-sm">
                <div className="font-semibold text-slate-700 mb-1">{t('explanation')}:</div>
                <TranslatableContent
                  content={suggestion.explanation}
                  entity={suggestion}
                  entityType="Suggestion"
                  className="text-slate-600"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Voting buttons + comments row */}
      <div className="mt-4 space-y-2">
        {document?.votingButtonsEnabled && (
          <div className="proposal-vote-buttons" onClick={(e) => e.stopPropagation()}>
            {user && canParticipate ? (
              <VotingProgressSection
                suggestion={suggestion}
                document={document}
                userVote={getUserVote(suggestion.id)}
                voteMutation={{
                  isPending: voteMutation.isPending,
                  mutate: (vote) => voteMutation.mutate({ suggestionId: suggestion.id, vote, currentVote: getUserVote(suggestion.id) }),
                }}
                isRTL={isRTL}
              />
            ) : (
              <VotingProgressSection
                suggestion={suggestion}
                document={document}
                userVote={null}
                voteMutation={{
                  isPending: false,
                  mutate: () => {
                    if (!user) base44.auth.redirectToLogin(window.location.href);
                    else if (!canParticipate) onNeedJoinGroup();
                  },
                }}
                isRTL={isRTL}
                readOnly={!user}
              />
            )}
          </div>
        )}

        {/* Action buttons + comments */}
        <div className={`flex items-center gap-2 flex-wrap mt-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <Button
            size="sm"
            variant="outline"
            className={`text-xs h-8 px-3 flex-shrink-0 ${isRTL ? 'mr-0 ml-auto' : 'ml-0 mr-auto'}`}
            onClick={() => onOpenSuggestionSidebar && onOpenSuggestionSidebar(suggestion.id)}
          >
            {t('viewDetails')}
          </Button>
          {user && isGhost && onEditSuggestion && suggestion.status === 'pending' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEditSuggestion(suggestion)}
              className={`h-8 text-xs px-2 flex-shrink-0 ${isRTL ? 'mr-0 ml-auto' : 'ml-0 mr-auto'}`}
            >
              <Edit className="w-4 h-4" />
              <span className="hidden sm:inline">{t('suggestEditSection')}</span>
            </Button>
          )}
          <Button
            variant={hasComments ? 'outline' : 'ghost'}
            size="sm"
            onClick={() => toggleComments(commentsKey)}
            className={`h-8 text-sm px-3 gap-1.5 relative flex-shrink-0 transition-all ${
              hasComments
                ? 'font-semibold text-blue-700 border-blue-300 bg-blue-50 hover:bg-blue-100'
                : 'text-slate-600 hover:text-blue-600'
            }`}
          >
            <MessageSquare className={`w-4 h-4 ${hasComments ? 'fill-blue-200' : ''}`} />
            {t('comments')}{hasComments ? ` (${commentCount})` : ''}
          </Button>
        </div>
        {showComments[commentsKey] && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <CommentsSection entityType="suggestion" entityId={suggestion.id} user={user} />
          </div>
        )}
      </div>
    </>
  );
});

export default SuggestionView;