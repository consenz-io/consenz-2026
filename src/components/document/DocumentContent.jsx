import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Card, CardContent } from "@/components/ui/card";
import EditTopicModal from "@/components/document/EditTopicModal";
import NewTopicSuggestionCard from "@/components/document/NewTopicSuggestionCard";
import DocumentTopicCard from "@/components/document/DocumentTopicCard";
import { useDocumentContentData } from "@/components/document/hooks/useDocumentContentData";
import { DocumentContentDataProvider } from "@/components/document/DocumentContentContext";

export default function DocumentContent(props) {
  const data = useDocumentContentData(props);
  const {
    editingTopic, setEditingTopic, handleTopicDragEnd, topics, isAdmin, t,
    document, user, getNewTopicSuggestions, getNewTopicSuggestionsAfterTopic
  } = data;

  return (
    <DocumentContentDataProvider value={data}>
      <EditTopicModal
        isOpen={!!editingTopic}
        onClose={() => setEditingTopic(null)}
        topic={editingTopic}
        document={document}
        user={user}
        isAdmin={isAdmin} />

      <DragDropContext onDragEnd={handleTopicDragEnd}>
        <Droppable droppableId="topics" isDropDisabled={!isAdmin}>
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4 md:space-y-6 w-full overflow-x-hidden">
              {topics.map((topic, topicIndex) => (
                <Draggable key={topic.id} draggableId={`topic-${topic.id}`} index={topicIndex} isDragDisabled={!isAdmin}>
                  {(topicProvided, topicSnapshot) => (
                    <div
                      ref={topicProvided.innerRef}
                      {...topicProvided.draggableProps}
                      className={topicSnapshot.isDragging ? 'opacity-70' : ''}>
                      <DocumentTopicCard topic={topic} topicIndex={topicIndex} topicProvided={topicProvided} />
                      {/* הצעות לנושאים חדשים שאמורות להופיע אחרי נושא זה */}
                      {getNewTopicSuggestionsAfterTopic(topic.order).map((suggestion) => (
                        <NewTopicSuggestionCard key={suggestion.id} suggestion={suggestion} className="mt-4" />
                      ))}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}

              {/* הצעות לנושאים חדשים בסוף (שלא שויכו לנושא מסוים) */}
              {getNewTopicSuggestions()
                .filter((s) => {
                  // אם אין נושאים - הצג הכל
                  if (topics.length === 0) return true;
                  // אם אין newTopicOrder - הצג בסוף (לא שויך לנושא ספציפי)
                  if (s.newTopicOrder === undefined || s.newTopicOrder === null) return true;
                  // הצג רק אם newTopicOrder לא שויך לאף נושא קיים (כלומר לא הוצג כבר ע"י getNewTopicSuggestionsAfterTopic)
                  const topicOrders = topics.map((t) => t.order);
                  const alreadyShown = topicOrders.some((order) => s.newTopicOrder === order + 1);
                  return !alreadyShown;
                })
                .map((suggestion) => (
                  <NewTopicSuggestionCard key={suggestion.id} suggestion={suggestion} />
                ))}

              {topics.length === 0 && getNewTopicSuggestions().length === 0 && (
                <Card className="bg-white border-slate-200 w-full overflow-hidden">
                  <CardContent className="p-6 md:p-12 text-center">
                    <p className="text-slate-500 text-sm md:text-base">{t('noTopicsYet')}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </DocumentContentDataProvider>
  );
}