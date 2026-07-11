import React from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import TranslatableContent from "../TranslatableContent";
import DocumentTextContent from "../DocumentTextContent";
import SectionDeletionVoteBar from "../SectionDeletionVoteBar";
import CommentsSection from "../CommentsSection";

/**
 * Renders the "current section" view — the live section content, deletion vote bar,
 * and comments. Extracted from SectionCarousel so it only re-renders when the
 * current-section data changes, not when carousel position changes.
 */
const CurrentSectionView = React.memo(function CurrentSectionView({
  section,
  document,
  user,
  isRTL,
  t,
  sectionVotes,
  canParticipate,
  onEditSection,
  onEditSectionThenVote,
  onNeedJoinGroup,
  activeCommentEntity,
  getCommentsCount,
  toggleComments,
  showComments,
}) {
  const commentsKey = `section-${section.id}`;
  const commentCount = typeof getCommentsCount === 'function' ? getCommentsCount(activeCommentEntity.entityType, activeCommentEntity.entityId) : 0;
  const hasComments = commentCount > 0;

  return (
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
      <div className="text-[10px] md:text-xs text-slate-400 mb-4">
        {t('lastEdited')} {new Date(section.updated_date).toLocaleDateString('en-GB')}
      </div>

      {/* Section deletion vote bar */}
      {document?.votingButtonsEnabled && (
        <div className="proposal-vote-buttons mb-4" onClick={(e) => e.stopPropagation()}>
          <SectionDeletionVoteBar
            section={section}
            document={document}
            user={user}
            isRTL={isRTL}
            initialVotes={sectionVotes}
            canParticipate={canParticipate}
            onCannotParticipate={onNeedJoinGroup}
            onSuggestEdit={onEditSection}
            onSuggestEditThenVote={onEditSectionThenVote}
            readOnly={!user}
          />
        </div>
      )}

      {/* Comments button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => toggleComments(commentsKey)}
        className={`h-7 md:h-8 text-xs px-2 transition-all ${
          hasComments
            ? 'font-bold text-blue-700 border border-blue-300 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 shadow-sm'
            : 'text-slate-600 hover:text-blue-600'
        }`}
      >
        <MessageSquare className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-1' : 'mr-1'} ${hasComments ? 'fill-blue-200' : ''}`} />
        {t('comments')}{hasComments ? ` (${commentCount})` : ''}
      </Button>
      {showComments[commentsKey] && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <CommentsSection
            entityType={activeCommentEntity.entityType}
            entityId={activeCommentEntity.entityId}
            user={user}
          />
        </div>
      )}
    </>
  );
});

export default CurrentSectionView;