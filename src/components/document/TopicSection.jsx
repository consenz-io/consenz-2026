import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, GripVertical, Languages, Loader2, Trash2 } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import TopicTitleCarousel from "./TopicTitleCarousel";
import SectionCarousel from "./SectionCarousel";
import NewSectionSuggestionCard from "./NewSectionSuggestionCard";

export default function TopicSection({
  topic,
  topicIndex,
  topicProvided,
  topicSnapshot,
  sections,
  newSectionSuggestions,
  document,
  user,
  isAdmin,
  getTopicEditSuggestions,
  getUserTopicVote,
  voteTopicEditMutation,
  getUserName,
  users,
  publicProfiles,
  showTranslatedTopics,
  setShowTranslatedTopics,
  translateTopicMutation,
  setEditingTopic,
  handleDeleteTopic,
  onNewSection,
  getSuggestionsForSection,
  suggestions,
  getUserVote,
  voteMutation,
  onEditSection,
  onDirectEdit,
  toggleComments,
  showComments,
  getCommentsCount,
  onOpenSuggestionSidebar,
  newlyCreatedSuggestion,
  onClearNewlyCreated,
  targetSuggestionId,
  onEditSuggestion,
  autoAcceptingIds,
  handleSectionDragEnd,
  language,
  isRTL,
  t,
  languageNames
}) {
  const topicSections = sections.filter(s => s.topicId === topic.id).sort((a, b) => a.order - b.order);

  return (
    <div
      ref={topicProvided.innerRef}
      {...topicProvided.draggableProps}
      className={topicSnapshot.isDragging ? 'opacity-70' : ''}
    >
      <Card className="bg-white border-slate-200 w-full overflow-hidden">
        <CardHeader className="border-b border-slate-100 p-4 md:p-6">
          <div className={`flex items-start gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {isAdmin && (
              <div 
                {...topicProvided.dragHandleProps}
                className="p-1 bg-white rounded border border-slate-300 cursor-move hover:bg-slate-50 transition-colors flex-shrink-0 mt-1"
              >
                <GripVertical className="w-5 h-5 text-slate-400" />
              </div>
            )}
            
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
                users={users}
                publicProfiles={publicProfiles}
                showTranslatedTopics={showTranslatedTopics}
                setShowTranslatedTopics={setShowTranslatedTopics}
                translateTopicMutation={translateTopicMutation}
                setEditingTopic={setEditingTopic}
                language={language}
                isRTL={isRTL}
              />
            </div>
            
            <div className={`flex items-center gap-1 flex-shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {(() => {
                const detectLang = (text) => {
                  const hebrewPattern = /[\u0590-\u05FF]/;
                  const arabicPattern = /[\u0600-\u06FF]/;
                  if (hebrewPattern.test(text)) return 'he';
                  if (arabicPattern.test(text)) return 'ar';
                  return 'en';
                };
                const topicOriginalLang = topic.originalLanguage || detectLang(topic.title);
                const needsTranslation = topicOriginalLang !== language;
                
                if (!needsTranslation) return null;
                
                if (translateTopicMutation.isPending && translateTopicMutation.variables?.id === topic.id) {
                  return <Loader2 className="w-4 h-4 animate-spin text-blue-600 flex-shrink-0" />;
                }
                
                return (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (showTranslatedTopics[topic.id] && topic.translations?.[language]?.title) {
                        setShowTranslatedTopics(prev => ({ ...prev, [topic.id]: false }));
                      } else if (topic.translations?.[language]?.title) {
                        setShowTranslatedTopics(prev => ({ ...prev, [topic.id]: true }));
                      } else {
                        translateTopicMutation.mutate(topic);
                      }
                    }}
                    className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    title={showTranslatedTopics[topic.id] && topic.translations?.[language]?.title ? `${languageNames[topicOriginalLang]} (מקור)` : `תרגם ל${languageNames[language]}`}
                  >
                    <Languages className="w-4 h-4" />
                  </Button>
                );
              })()}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingTopic(topic)}
                className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                title="הצע עריכה לכותרת"
              >
                <Edit className="w-4 h-4" />
              </Button>
              
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteTopic(topic.id, topic.title)}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="מחק נושא"
                >
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
              {newSectionSuggestions.filter(s => s.topicId === topic.id).map((suggestion) => (
                <NewSectionSuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  document={document}
                  getUserName={getUserName}
                  acceptedSuggestions={suggestions.filter(s => s.status === 'accepted')}
                  user={user}
                  getUserVote={getUserVote}
                  voteMutation={voteMutation}
                  onOpenSidebar={onOpenSuggestionSidebar}
                  getCommentsCount={getCommentsCount}
                  toggleComments={toggleComments}
                  showComments={showComments}
                  isAdmin={isAdmin}
                  onEditSuggestion={onEditSuggestion}
                  allDocumentSuggestions={suggestions}
                  isAutoAccepting={!!autoAcceptingIds[suggestion.id]}
                />
              ))}
            </>
          ) : (
            <DragDropContext onDragEnd={(result) => handleSectionDragEnd(result, topic.id)}>
              <Droppable droppableId={`sections-${topic.id}`} isDropDisabled={!isAdmin}>
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3 md:space-y-4">
                    {topicSections.map((section, index) => {
                      const allSectionSuggestions = getSuggestionsForSection(section.id);
                      
                      return (
                        <Draggable key={section.id} draggableId={section.id} index={index} isDragDisabled={!isAdmin}>
                          {(sectionProvided, sectionSnapshot) => (
                            <div
                              ref={sectionProvided.innerRef}
                              {...sectionProvided.draggableProps}
                              className={sectionSnapshot.isDragging ? 'opacity-70' : ''}
                            >
                              <div className="space-y-3 relative group/section">
                                {isAdmin && (
                                  <div 
                                    {...sectionProvided.dragHandleProps}
                                    className="absolute top-2 left-2 z-10 p-1 bg-white rounded border border-slate-300 cursor-move hover:bg-slate-50 transition-colors"
                                  >
                                    <GripVertical className="w-4 h-4 text-slate-400" />
                                  </div>
                                )}
                                <SectionCarousel
                                  section={section}
                                  pendingSuggestions={allSectionSuggestions}
                                  document={document}
                                  user={user}
                                  onEditSection={onEditSection}
                                  onDirectEdit={onDirectEdit}
                                  toggleComments={toggleComments}
                                  showComments={showComments}
                                  getCommentsCount={getCommentsCount}
                                  getUserVote={getUserVote}
                                  voteMutation={voteMutation}
                                  getUserName={getUserName}
                                  acceptedSuggestions={suggestions.filter(s => s.status === 'accepted')}
                                  sectionIndex={index}
                                  isAdmin={isAdmin}
                                  users={users}
                                  onOpenSuggestionSidebar={onOpenSuggestionSidebar}
                                  newlyCreatedSuggestionId={newlyCreatedSuggestion?.sectionId === section.id ? newlyCreatedSuggestion?.suggestionId : null}
                                  onClearNewlyCreated={onClearNewlyCreated}
                                  targetSuggestionId={targetSuggestionId}
                                  publicProfiles={publicProfiles}
                                />
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
}