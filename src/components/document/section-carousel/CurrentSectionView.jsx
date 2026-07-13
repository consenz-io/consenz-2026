import React from "react";
import { MessageSquare, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";
import TranslatableContent from "../TranslatableContent";
import DocumentTextContent from "../DocumentTextContent";
import SectionDeletionVoteBar from "../SectionDeletionVoteBar";
import CommentsSection from "../CommentsSection";
import PointsCostTooltip from "../PointsCostTooltip";

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
  sourceSuggestion,
}) {
  const { language } = useLanguage();
  const commentsKey = `section-${section.id}`;
  const commentCount = typeof getCommentsCount === 'function' ? getCommentsCount(activeCommentEntity.entityType, activeCommentEntity.entityId) : 0;
  const hasComments = commentCount > 0;

  const handleEditClick = () => {
    if (!user) {
      base44.auth.redirectToLogin(window.location.href);
      return;
    }
    if (!canParticipate) return;
    onEditSection(section);
  };

  // When a con-vote explanation comment is posted, open the comments section and
  // scroll to the newly created comment for immediate UX feedback.
  const [conCommentScrollId, setConCommentScrollId] = React.useState(null);

  const handleConCommentPosted = React.useCallback((commentId) => {
    setConCommentScrollId(commentId);
    if (!showComments[commentsKey]) {
      toggleComments(commentsKey);
    }
  }, [showComments, commentsKey, toggleComments]);

  // Clear the scroll target after the scroll has had time to complete
  React.useEffect(() => {
    if (!conCommentScrollId) return;
    const timer = setTimeout(() => setConCommentScrollId(null), 6000);
    return () => clearTimeout(timer);
  }, [conCommentScrollId]);

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
            onConCommentPosted={handleConCommentPosted}
            readOnly={!user}
            sourceSuggestion={sourceSuggestion}
          />
        </div>
      )}

      {/* Action buttons row — suggest edit + comments (mirrors SuggestionView layout) */}
      <div className={`flex items-center gap-2 flex-wrap mt-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <PointsCostTooltip
          gamificationEnabled={document?.gamificationEnabled}
          actionType="edit"
          language={language}
          isRTL={isRTL}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEditClick}
            className={`tutorial-suggest-edit-btn text-xs h-8 px-3 flex-shrink-0 ${isRTL ? 'ml-0 mr-auto' : 'mr-0 ml-auto'}`}
          >
            <Edit className={`w-3.5 h-3.5 shrink-0 ${isRTL ? 'ml-1' : 'mr-1'}`} />
            <span className="truncate">{t('suggestEditSection')}</span>
          </Button>
        </PointsCostTooltip>
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
          <CommentsSection
            entityType={activeCommentEntity.entityType}
            entityId={activeCommentEntity.entityId}
            user={user}
            scrollToCommentId={conCommentScrollId}
          />
        </div>
      )}
    </>
  );
});

export default CurrentSectionView;