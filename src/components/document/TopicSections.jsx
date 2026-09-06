import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import GhostSlot from "@/components/document/GhostSlot";
import SectionDraggable from "@/components/document/SectionDraggable";
import { useDocContent } from "@/components/document/DocumentContentContext";

export default function TopicSections({ topic, topicSections, topicGhostSlots, topicNewSectionSuggestions }) {
  const { handleSectionDragEnd, isAdmin } = useDocContent();

  // Merge sections + ghost slots into a single order-sorted array (memoized).
  // Replaces the previous O(sections × ghosts) per-render filter logic with a
  // single O(n log n) sort that only re-runs when the inputs change.
  const items = React.useMemo(() => {
    // Precompute section → droppable index (position among sections only) for O(1) lookup
    const sectionIndex = new Map();
    topicSections.forEach((s, i) => sectionIndex.set(s.id, i));
    const merged = [
      ...topicSections.map((s) => ({ type: 'section', order: s.order, data: s, dragIndex: sectionIndex.get(s.id) })),
      ...topicGhostSlots.map((g) => ({ type: 'ghost', order: g.originalSectionOrder ?? 999, data: g })),
    ];
    merged.sort((a, b) => a.order - b.order);
    return merged;
  }, [topicSections, topicGhostSlots]);

  return (
    <DragDropContext onDragEnd={(result) => handleSectionDragEnd(result, topic.id)}>
      <Droppable droppableId={`sections-${topic.id}`} isDropDisabled={!isAdmin}>
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3 md:space-y-4">
            {items.map((item) => {
              if (item.type === 'ghost') {
                return <GhostSlot key={`ghost-${item.data.sectionId}`} ghost={item.data} />;
              }
              const section = item.data;
              return (
                <Draggable key={section.id} draggableId={section.id} index={item.dragIndex} isDragDisabled={!isAdmin}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={snapshot.isDragging ? 'opacity-70' : ''}>
                      <SectionDraggable
                        section={section}
                        index={item.dragIndex}
                        topic={topic}
                        topicSections={topicSections}
                        topicNewSectionSuggestions={topicNewSectionSuggestions}
                        provided={provided} />
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
  );
}