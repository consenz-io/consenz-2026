import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import GhostSlot from "@/components/document/GhostSlot";
import SectionDraggable from "@/components/document/SectionDraggable";
import { useDocContent } from "@/components/document/DocumentContentContext";

export default function TopicSections({ topic, topicSections, topicGhostSlots, topicNewSectionSuggestions }) {
  const { handleSectionDragEnd, isAdmin } = useDocContent();

  return (
    <DragDropContext onDragEnd={(result) => handleSectionDragEnd(result, topic.id)}>
      <Droppable droppableId={`sections-${topic.id}`} isDropDisabled={!isAdmin}>
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3 md:space-y-4">
            {topicSections.map((section, index) => {
              // Ghost slots (deleted section) whose order falls before the first section
              const ghostsBefore = index === 0
                ? topicGhostSlots.filter((g) => g.originalSectionOrder < section.order)
                : [];
              // Ghost slots whose order falls after this section and before the next (or at the end)
              const ghostsAfter = topicGhostSlots.filter((g) =>
                g.originalSectionOrder > section.order && (
                  index === topicSections.length - 1 || g.originalSectionOrder < topicSections[index + 1].order
                )
              );

              return (
                <React.Fragment key={section.id}>
                  {ghostsBefore.map((ghost) => (
                    <GhostSlot key={`ghost-${ghost.sectionId}`} ghost={ghost} />
                  ))}
                  <Draggable key={section.id} draggableId={section.id} index={index} isDragDisabled={!isAdmin}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={snapshot.isDragging ? 'opacity-70' : ''}>
                        <SectionDraggable
                          section={section}
                          index={index}
                          topic={topic}
                          topicSections={topicSections}
                          topicNewSectionSuggestions={topicNewSectionSuggestions}
                          provided={provided} />
                      </div>
                    )}
                  </Draggable>
                  {ghostsAfter.map((ghost) => (
                    <GhostSlot key={`ghost-${ghost.sectionId}`} ghost={ghost} />
                  ))}
                </React.Fragment>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}