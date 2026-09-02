import React from "react";
import { Button } from "@/components/ui/button";
import { Plus, GripVertical } from "lucide-react";
import { base44 } from "@/api/base44Client";
import LazySection from "@/components/document/LazySection";
import SectionCarousel from "@/components/document/SectionCarousel";
import InsertSectionButton from "@/components/document/InsertSectionButton";
import DraggableSuggestionCardWrapper from "@/components/document/DraggableSuggestionCardWrapper";
import SuggestionDropZone from "@/components/document/SuggestionDropZone";
import { computeDropPosition } from "@/components/document/utils/dropPosition";
import PointsCostTooltip from "@/components/document/PointsCostTooltip";
import { useDocContent } from "@/components/document/DocumentContentContext";

export default function SectionDraggable({ section, index, topic, topicSections, topicNewSectionSuggestions, provided }) {
  const {
    isRTL, isAdmin, t, language, document, user, canParticipate,
    getSuggestionsForSection,
    onEditSection, onEditSectionThenVote, onDirectEdit,
    getCommentsCount, getUserVote, voteMutation, getUserName,
    acceptedSuggestions, onOpenSuggestionSidebar,
    newlyCreatedSuggestion, onClearNewlyCreated, targetSuggestionId,
    publicProfiles, allSuggestionsBySectionId, sectionVotesBySectionId,
    sourceSuggestionBySectionId, targetSuggestionSectionId,
    onNewSection, reorderMutation, scrollToSectionId
  } = useDocContent();

  const allSectionSuggestions = getSuggestionsForSection(section.id);
  // New section suggestions rendered AFTER this section (pre-computed for insert button placement)
  const suggestionsAfterThisSection = topicNewSectionSuggestions.filter((s) => {
    const pos = s.insertPosition;
    // Exclude "before first section" slot (pos < 0, including -1 and fractional negatives)
    if (pos !== undefined && pos !== null && pos < 0) return false;
    const lowerBound = section.order + 1;
    const upperBound = index < topicSections.length - 1 ? topicSections[index + 1].order + 1 : Infinity;
    // In this section's slot (supports fractional insertPosition from admin reordering)
    if (pos !== undefined && pos !== null && pos >= lowerBound && pos < upperBound) return true;
    // After last section: undefined/null positions
    if (index === topicSections.length - 1 && (pos === undefined || pos === null)) return true;
    return false;
  });

  const handleInsertAt = (position) => {
    if (!user) {
      base44.auth.redirectToLogin(window.location.href);
      return;
    }
    if (!canParticipate) return;
    onNewSection(topic.id, position);
  };

  return (
    <>
      {/* intentionally empty - new section suggestions are rendered AFTER each section below */}

      {index > 0 && (
        <InsertSectionButton
          wrapperClassName="h-4 -my-2 -mb-4 z-10"
          onClick={() => handleInsertAt(topicSections[index - 1].order + 1)} />
      )}
      {index === 0 && (
        <InsertSectionButton
          wrapperClassName="h-4 -mt-2 -mb-2 z-10"
          onClick={() => handleInsertAt(-1)} />
      )}

      <div className="space-y-3 relative group/section">
        {isAdmin && (
          <div
            {...provided.dragHandleProps}
            className="absolute top-2 left-2 z-10 p-1 bg-white rounded border border-slate-300 cursor-move hover:bg-slate-50 transition-colors">
            <GripVertical className="w-4 h-4 text-slate-400" />
          </div>
        )}

        {/* הצעות להוספת סעיף לפני הסעיף הראשון */}
        {index === 0 && (() => {
          const beforeFirst = topicNewSectionSuggestions.filter((s) => {
            const pos = s.insertPosition;
            if (pos === undefined || pos === null) return false;
            return pos < (topicSections[0]?.order + 1 ?? Infinity);
          });
          return (
            <>
              {isAdmin && beforeFirst.length === 0 && (
                <SuggestionDropZone
                  getPosition={() => computeDropPosition(null, section.order)}
                  onDrop={(id, pos) => reorderMutation.mutate({ suggestionId: id, newInsertPosition: pos })}
                  isAdmin={isAdmin} />
              )}
              {beforeFirst.map((suggestion, suggIdx) => (
                <DraggableSuggestionCardWrapper
                  key={suggestion.id}
                  suggestion={suggestion}
                  abovePos={suggIdx === 0 ? null : beforeFirst[suggIdx - 1].insertPosition}
                  belowPos={suggIdx === beforeFirst.length - 1 ? section.order : beforeFirst[suggIdx + 1].insertPosition} />
              ))}
            </>
          );
        })()}

        <LazySection
          forceMount={section.id === targetSuggestionSectionId || newlyCreatedSuggestion?.sectionId === section.id || section.id === scrollToSectionId}
          estimatedHeight={250}>
          <SectionCarousel
            section={section}
            pendingSuggestions={allSectionSuggestions}
            document={document}
            user={user}
            canParticipate={canParticipate}
            onEditSection={onEditSection}
            onEditSectionThenVote={onEditSectionThenVote}
            onDirectEdit={onDirectEdit}
            getCommentsCount={getCommentsCount}
            getUserVote={getUserVote}
            voteMutation={voteMutation}
            getUserName={getUserName}
            acceptedSuggestions={acceptedSuggestions}
            sectionIndex={index}
            isAdmin={isAdmin}
            onOpenSuggestionSidebar={onOpenSuggestionSidebar}
            newlyCreatedSuggestionId={newlyCreatedSuggestion?.sectionId === section.id ? newlyCreatedSuggestion?.suggestionId : null}
            onClearNewlyCreated={onClearNewlyCreated}
            targetSuggestionId={targetSuggestionId}
            publicProfiles={publicProfiles}
            sectionSuggestions={allSuggestionsBySectionId.get(section.id) || []}
            sectionVotes={sectionVotesBySectionId.get(section.id) || []}
            sourceSuggestion={sourceSuggestionBySectionId.get(section.id)} />
        </LazySection>
      </div>

      {/* Show new section suggestions in their correct position:
          - BEFORE the first section (index=0): insertPosition === -1
          - AFTER section at index i: insertPosition === topicSections[i].order
          - AFTER the last section: insertPosition is null/undefined or doesn't match any section order */}
      {suggestionsAfterThisSection.map((suggestion, suggIdx) => (
        <DraggableSuggestionCardWrapper
          key={suggestion.id}
          suggestion={suggestion}
          abovePos={suggIdx === 0 ? section.order + 1 : suggestionsAfterThisSection[suggIdx - 1].insertPosition}
          belowPos={suggIdx === suggestionsAfterThisSection.length - 1
            ? index < topicSections.length - 1 ? topicSections[index + 1].order : null
            : suggestionsAfterThisSection[suggIdx + 1].insertPosition} />
      ))}
      {isAdmin && suggestionsAfterThisSection.length === 0 && (
        <SuggestionDropZone
          getPosition={() => computeDropPosition(
            section.order + 1,
            index < topicSections.length - 1 ? topicSections[index + 1].order : null
          )}
          onDrop={(id, pos) => reorderMutation.mutate({ suggestionId: id, newInsertPosition: pos })}
          isAdmin={isAdmin} />
      )}

      {/* Insert button after new section suggestion cards — maintains order by
          using the same insertPosition; newer suggestions sort after older ones */}
      {suggestionsAfterThisSection.length > 0 && (
        <InsertSectionButton
          onClick={() => handleInsertAt(section.order + 1)} />
      )}

      {/* After last section: special double insert button (tutorial-aware + section-hover) */}
      {index === topicSections.length - 1 && (
        <>
          <div className="section-insert-space group relative h-4 flex items-center justify-center mt-2">
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 tutorial-force-insert-btn transition-opacity">
              <div className="h-full flex items-center justify-center">
                <PointsCostTooltip gamificationEnabled={document?.gamificationEnabled} actionType="new" language={language} isRTL={isRTL}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleInsertAt(section.order + 1)}
                    className="bg-white shadow-md border-blue-300 text-blue-600 hover:bg-blue-50">
                    <Plus className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                    {t('insertSectionHere')}
                  </Button>
                </PointsCostTooltip>
              </div>
            </div>
          </div>
          <div className="opacity-0 group-hover/section:opacity-100 transition-opacity absolute -bottom-4 left-1/2 -translate-x-1/2 z-10">
            <PointsCostTooltip gamificationEnabled={document?.gamificationEnabled} actionType="new" language={language} isRTL={isRTL}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleInsertAt(section.order + 1)}
                className="bg-white shadow-md border-blue-300 text-blue-600 hover:bg-blue-50">
                <Plus className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                {t('insertSectionHere')}
              </Button>
            </PointsCostTooltip>
          </div>
        </>
      )}
    </>
  );
}