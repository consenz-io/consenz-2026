import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Custom hook for drag-and-drop functionality
 * Handles both topic and section reordering
 */
export function useDragAndDrop(document, topics, sections) {
  const queryClient = useQueryClient();

  const reorderSectionsMutation = useMutation({
    mutationFn: async ({ topicId, reorderedSections }) => {
      await Promise.all(
        reorderedSections.map((section, index) => 
          base44.entities.Section.update(section.id, { order: index })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections', document?.id] });
    },
  });

  const reorderTopicsMutation = useMutation({
    mutationFn: async ({ reorderedTopics }) => {
      await Promise.all(
        reorderedTopics.map((topic, index) => 
          base44.entities.Topic.update(topic.id, { order: index })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics', document?.id] });
    },
  });

  const handleSectionDragEnd = (result, topicId) => {
    if (!result.destination) return;

    const topicSections = sections
      .filter(s => s.topicId === topicId)
      .sort((a, b) => a.order - b.order);
    
    const items = Array.from(topicSections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    reorderSectionsMutation.mutate({
      topicId,
      reorderedSections: items
    });
  };

  const handleTopicDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(topics);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    reorderTopicsMutation.mutate({
      reorderedTopics: items
    });
  };

  return {
    handleSectionDragEnd,
    handleTopicDragEnd,
    reorderSectionsMutation,
    reorderTopicsMutation
  };
}