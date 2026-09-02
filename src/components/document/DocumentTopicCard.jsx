import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Loader2, Languages, GripVertical } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import TopicTitleCarousel from "@/components/document/TopicTitleCarousel";
import TopicSections from "@/components/document/TopicSections";
import InsertSectionButton from "@/components/document/InsertSectionButton";
import GhostSlot from "@/components/document/GhostSlot";
import DraggableSuggestionCardWrapper from "@/components/document/DraggableSuggestionCardWrapper";
import SuggestionDropZone from "@/components/document/SuggestionDropZone";
import { computeDropPosition } from "@/components/document/utils/dropPosition";
import { useDocContent } from "@/components/document/DocumentContentContext";

export default function DocumentTopicCard({ topic, topicIndex, topicProvided }) {
  const {
    isRTL, isAdmin, t, language, document, user, canParticipate,
    getSectionsForTopic, getGhostSlotsForTopic, getNewSectionSuggestionsForTopic,
    getTopicEditSuggestions, getUserTopicVote, voteTopicEditMutation,
    getUserName, publicProfiles, showTranslatedTopics, setShowTranslatedTopics,
    translateTopicMutation, setEditingTopic, handleDeleteTopic,
    onNewSection, reorderMutation
  } = useDocContent();

  const topicSections = getSectionsForTopic(topic.id);
  const topicGhostSlots = getGhostSlotsForTopic(topic.id);
  const topicNewSectionSuggestions = getNewSectionSuggestionsForTopic(topic.id);

  return (
    <Card className="bg-white border-slate-200 w-full overflow-hidden">
      <CardHeader className="border-b border-slate-100 md:p-6 px-4">
        <div className={`flex items-start gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {/* Drag handle - only for admin */}
          {isAdmin && (
            <div
              {...topicProvided.dragHandleProps}
              className="p-1 bg-white rounded border border-slate-300 cursor-move hover:bg-slate-50 transition-colors flex-shrink-0 mt-1">
              <GripVertical className="w-5 h-5 text-slate-400" />
            </div>
          )}

          {/* Title with carousel for suggestions */}
          <div className="flex-1 min-w-0">
            <TopicTitleCarousel
              topic={topic}
              topicEditSuggestions={getTopicEditSuggestions(topic.id)}
              document={document}
              user={user}
              getUserTopicVote={getUserTopicVote}
              voteTopicEditMutation={voteTopicEditMutation}
              getUserName={getUserName}
              isAdmin={isAdmin}
              publicProfiles={publicProfiles}
              showTranslatedTopics={showTranslatedTopics}
              setShowTranslatedTopics={setShowTranslatedTopics}
              translateTopicMutation={translateTopicMutation}
              setEditingTopic={setEditingTopic}
              language={language}
              isRTL={isRTL} />
          </div>

          {/* Action buttons - fixed on the side */}
          <div className={`flex items-center gap-1 flex-shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {/* Translate button - always visible */}
            {translateTopicMutation.isPending && translateTopicMutation.variables?.id === topic.id ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 flex-shrink-0" />
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (showTranslatedTopics[topic.id] && topic.translations?.[language]?.title) {
                    setShowTranslatedTopics((prev) => ({ ...prev, [topic.id]: false }));
                  } else if (topic.translations?.[language]?.title) {
                    setShowTranslatedTopics((prev) => ({ ...prev, [topic.id]: true }));
                  } else {
                    translateTopicMutation.mutate(topic);
                  }
                }}
                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                title={showTranslatedTopics[topic.id] ? t('showOriginal') : t('translate')}>
                <Languages className="w-4 h-4" />
              </Button>
            )}

            {/* Edit button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!user) {
                  base44.auth.redirectToLogin(window.location.href);
                  return;
                }
                if (!canParticipate) {
                  toast.error(language === 'he' ? 'אינך חבר בקבוצה זו' : language === 'ar' ? 'لست عضوًا في هذه المجموعة' : 'You are not a member of this group');
                  return;
                }
                setEditingTopic(topic);
              }}
              className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
              title="הצע עריכה לכותרת">
              <Edit className="w-4 h-4" />
            </Button>

            {/* Delete button - only for admin */}
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteTopic(topic.id, topic.title)}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                title="מחק נושא">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 md:p-6 space-y-3 md:space-y-4 overflow-x-hidden">
        {topicSections.length === 0 ? (
          <>
            <div className="text-center py-6 md:py-8 text-slate-500 text-sm md:text-base">
              {t('noSectionsYet')}
            </div>
            {/* Show new section suggestions when there are no sections */}
            {(() => {
              const noSectionSuggs = getNewSectionSuggestionsForTopic(topic.id);
              return (
                <>
                  {isAdmin && noSectionSuggs.length === 0 && (
                    <SuggestionDropZone
                      getPosition={() => computeDropPosition(null, null)}
                      onDrop={(id, pos) => reorderMutation.mutate({ suggestionId: id, newInsertPosition: pos })}
                      isAdmin={isAdmin} />
                  )}
                  {noSectionSuggs.map((suggestion, suggIdx) => (
                    <DraggableSuggestionCardWrapper
                      key={suggestion.id}
                      suggestion={suggestion}
                      abovePos={suggIdx === 0 ? null : noSectionSuggs[suggIdx - 1].insertPosition}
                      belowPos={suggIdx === noSectionSuggs.length - 1 ? null : noSectionSuggs[suggIdx + 1].insertPosition} />
                  ))}
                </>
              );
            })()}
            {/* Ghost slots for deleted sections that still have open proposals */}
            {topicGhostSlots.map((ghost) => (
              <GhostSlot key={`ghost-${ghost.sectionId}`} ghost={ghost} />
            ))}
            {/* Insert button when there are no existing sections — only suggestions */}
            <InsertSectionButton
              onClick={() => {
                if (!user) {
                  base44.auth.redirectToLogin(window.location.href);
                  return;
                }
                if (!canParticipate) return;
                const allSugg = getNewSectionSuggestionsForTopic(topic.id);
                const maxPos = allSugg.reduce((max, s) => {
                  const p = s.insertPosition;
                  if (p === undefined || p === null || p === -1) return max;
                  return Math.max(max, p);
                }, -1);
                onNewSection(topic.id, maxPos + 1);
              }} />
          </>
        ) : (
          <TopicSections
            topic={topic}
            topicSections={topicSections}
            topicGhostSlots={topicGhostSlots}
            topicNewSectionSuggestions={topicNewSectionSuggestions} />
        )}
      </CardContent>
    </Card>
  );
}