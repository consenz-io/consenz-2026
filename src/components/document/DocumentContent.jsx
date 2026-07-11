import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ensureUserPublicProfile } from "@/components/ensureUserPublicProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Plus, AlertCircle, ThumbsUp, ThumbsDown, MessageSquare, History, Languages, Loader2, GripVertical, Trash2 } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import VotesNeededCounter from "./VotesNeededCounter";
import SectionDiff from "./SectionDiff";
import CommentsSection from "./CommentsSection";
import TranslatableContent from "./TranslatableContent";
import DocumentTextContent from "./DocumentTextContent";
import SectionCarousel from "./SectionCarousel";
import LazySection from "./LazySection";
import NewSectionSuggestionCard from "./NewSectionSuggestionCard";
import DraggableSuggestionCard from "./DraggableSuggestionCard";
import SuggestionDropZone from "./SuggestionDropZone";
import { useSuggestionReorder } from "./hooks/useSuggestionReorder";
import { computeDropPosition } from "./utils/dropPosition";
import DeleteSectionSuggestionCard from "./DeleteSectionSuggestionCard";
import EditTopicModal from "./EditTopicModal";
import TopicTitleCarousel from "./TopicTitleCarousel";

import { useLanguage } from "@/components/LanguageContext";
import { cleanDisplayName } from "@/lib/displayName";
import { autoAcceptTopicEditSuggestion, checkTopicEditConsensus } from "./suggestionAutoAccept";
import { votingQueue } from "./VotingQueue";
import { useVoteMutation } from "./hooks/useVoteMutation";
import { useTopicVoteMutation } from "./hooks/useTopicVoteMutation";
import { toast } from "sonner";

export default function DocumentContent({ 
  document, 
  topics, 
  sections, 
  suggestions,
  onEditSection,
  onEditSectionThenVote,
  onNewSection,
  isAdmin,
  user,
  canParticipate = true,
  onDirectEdit,
  onOpenSuggestionSidebar,
  newlyCreatedSuggestion,
  onClearNewlyCreated,
  targetSuggestionId,
  onEditSuggestion
}) {
  const [showTranslatedTopics, setShowTranslatedTopics] = useState({});
  const [editingTopic, setEditingTopic] = useState(null);

  const queryClient = useQueryClient();
  const { t, isRTL, language: rawLanguage } = useLanguage();
  const language = rawLanguage || 'he';
  const { reorderMutation } = useSuggestionReorder(document?.id);

  const acceptedSuggestions = React.useMemo(
    () => suggestions.filter(s => s.status === 'accepted'),
    [suggestions]
  );

  // Map each section to the aggregated inherited votes from ALL accepted suggestions
  // linked to it — both the creation (new_section) suggestion and any accepted
  // edit_section suggestions. Their proVotes/conVotes are summed as baselines for
  // the section's vote counters and deletion-progress calculation.
  const sourceSuggestionBySectionId = React.useMemo(() => {
    const map = new Map();
    for (const s of suggestions) {
      if (s.status === 'accepted' && (s.type === 'new_section' || s.type === 'edit_section') && s.sectionId) {
        const existing = map.get(s.sectionId) || { proVotes: 0, conVotes: 0 };
        existing.proVotes += s.proVotes || 0;
        existing.conVotes += s.conVotes || 0;
        map.set(s.sectionId, existing);
      }
    }
    return map;
  }, [suggestions]);

  // Read from cache — populated by useDocumentData's aggregated fetch (targeted, not global).
  // Avoids fetching 1000 profiles when only ~10-30 are relevant to this document.
  const { data: publicProfiles = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list('-created_date', 1000),
    enabled: false,
    staleTime: Infinity,
    initialData: [],
  });

  const { data: topicEditSuggestions } = useQuery({
    queryKey: ['topicEditSuggestions', document?.id],
    queryFn: () => base44.entities.TopicEditSuggestion.filter({ documentId: document.id }),
    enabled: !!document?.id,
    initialData: [],
  });

  const { data: topicEditVotes } = useQuery({
    queryKey: ['topicEditVotes', document?.id, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return await base44.entities.TopicEditVote.filter({ userId: user.id });
    },
    enabled: !!user?.id && !!document?.id,
    initialData: [],
  });

  // מעקב לשימוש ב-hook של הצבעה
  const hasCheckedRef = React.useRef(new Set());

  // Scroll to newly created suggestion
  React.useEffect(() => {
    if (newlyCreatedSuggestion?.suggestionId && typeof window !== 'undefined') {
      const { suggestionId } = newlyCreatedSuggestion;
      
      const scrollToElement = () => {
        const element = window.document.getElementById(`suggestion-${suggestionId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-4', 'ring-green-500', 'ring-offset-4', 'bg-green-50');
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-green-500', 'ring-offset-4', 'bg-green-50');
            onClearNewlyCreated();
          }, 3000);
          return true;
        }
        return false;
      };
      
      // נסה מספר פעמים עד שנמצא את האלמנט
      let attempts = 0;
      const maxAttempts = 10;
      const tryScroll = () => {
        if (scrollToElement() || attempts >= maxAttempts) {
          return;
        }
        attempts++;
        setTimeout(tryScroll, 500);
      };
      
      setTimeout(tryScroll, 300);
    }
  }, [newlyCreatedSuggestion, onClearNewlyCreated, suggestions, topics]);

  // Auto-accept for section suggestions is handled entirely by the backend (voteOnSuggestion → processAcceptance).
  // Frontend only handles topic-edit suggestions auto-accept (no backend equivalent for those).
  React.useEffect(() => {
    if (!document || !topicEditSuggestions || topicEditSuggestions.length === 0) return;

    const checkTopicSuggestions = async () => {
      for (const topicSuggestion of topicEditSuggestions) {
        if (topicSuggestion.status !== 'pending') continue;

        const checkKey = `topic-${topicSuggestion.id}-${topicSuggestion.proVotes}-${topicSuggestion.conVotes}`;
        if (hasCheckedRef.current.has(checkKey)) continue;
        hasCheckedRef.current.add(checkKey);

        try {
          const { shouldAccept } = await checkTopicEditConsensus(topicSuggestion, document);
          if (shouldAccept) {
            console.log('[AUTO-ACCEPT TOPIC] Auto-accepting topic suggestion:', topicSuggestion.id);
            const acceptingUserId = user?.id || topicSuggestion.created_by;
            const accepted = await autoAcceptTopicEditSuggestion(topicSuggestion, acceptingUserId, document);
            if (accepted) {
              Promise.all([
                queryClient.invalidateQueries({ queryKey: ['topics', document.id] }),
                queryClient.invalidateQueries({ queryKey: ['topicEditSuggestions', document.id] }),
                queryClient.invalidateQueries({ queryKey: ['document', document.id] })
              ]);
            }
          }
        } catch (err) {
          console.error('[AUTO-ACCEPT TOPIC] Error:', err);
          hasCheckedRef.current.delete(checkKey);
        }
      }

      if (hasCheckedRef.current.size > 100) {
        hasCheckedRef.current.clear();
      }
    };

    checkTopicSuggestions();
  }, [topicEditSuggestions, document, user, queryClient]);

  // Comment counts — re-use the aggregated data already fetched by useDocumentData.
  // Read directly from the query cache (no queryFn needed, no re-fetch triggered).
  const aggregatedForComments = queryClient.getQueryData(['documentAggregatedData', document?.id]);
  const allDocumentComments = aggregatedForComments?.comments || [];

  // Pre-group comments by "type:id" key for O(1) count lookup
  const commentsCountMap = React.useMemo(() => {
    const map = new Map();
    for (const c of allDocumentComments) {
      const key = `${c.rootEntityType}:${c.rootEntityId}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [allDocumentComments]);

  const getCommentsCount = React.useCallback((entityType, entityId) => {
    return commentsCountMap.get(`${entityType}:${entityId}`) || 0;
  }, [commentsCountMap]);

  // Batch fetch ALL section votes for this document in one query (instead of N per-section queries)
  const { data: allSectionVotes = [] } = useQuery({
    queryKey: ['allSectionVotes', document?.id],
    queryFn: () => base44.entities.SectionVote.filter({ sectionId: sections.map(s => s.id) }),
    enabled: !!document?.id && sections.length > 0,
    staleTime: 60 * 1000,
  });

  // Pre-group by sectionId for O(1) lookup in SectionVoteButtons
  const sectionVotesBySectionId = React.useMemo(() => {
    const map = new Map();
    for (const v of allSectionVotes) {
      if (!map.has(v.sectionId)) map.set(v.sectionId, []);
      map.get(v.sectionId).push(v);
    }
    return map;
  }, [allSectionVotes]);

  const { data: userVotes = [] } = useQuery({
    queryKey: ['userVotes', document?.id, user?.id],
    queryFn: async () => {
      if (!user?.id || !document?.id) return [];
      const suggestionIds = suggestions.map(s => s.id);
      if (suggestionIds.length === 0) return [];
      const votes = await base44.entities.Vote.filter({ userId: user.id, suggestionId: { $in: suggestionIds } });
      // Remove duplicates — keep last vote per suggestion
      const seen = new Set();
      return [...votes].reverse().filter(v => {
        if (seen.has(v.suggestionId)) return false;
        seen.add(v.suggestionId);
        return true;
      });
    },
    enabled: !!user?.id && !!document?.id && suggestions.length > 0,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  // O(1) Map lookup instead of O(n) filter on every call
  const userVotesMap = React.useMemo(() => {
    const map = new Map();
    if (!userVotes) return map;
    // Iterate forward so the last entry (most recent) wins on duplicates
    for (const v of userVotes) {
      map.set(v.suggestionId, v);
    }
    return map;
  }, [userVotes]);

  const getUserVote = React.useCallback((suggestionId) => {
    return userVotesMap.get(suggestionId) || null;
  }, [userVotesMap]);



  // Use optimized vote hook
  const voteMutation = useVoteMutation(document, user, suggestions, hasCheckedRef);
      


  // O(1) lookup maps instead of O(n) find on every call
  // Lookup maps by userId (primary — created_by_id is the populated built-in field)
  // and by email (fallback for legacy callers).
  const profileByUserId = React.useMemo(() => {
    const map = new Map();
    publicProfiles?.forEach(p => { if (p.userId) map.set(p.userId, p); });
    return map;
  }, [publicProfiles]);

  const profileByEmail = React.useMemo(() => {
    const map = new Map();
    publicProfiles?.forEach(p => { if (p.email) map.set(p.email, p); });
    return map;
  }, [publicProfiles]);

  // Accepts a userId (created_by_id / lastEditedBy) or, as fallback, an email.
  // Uses only UserPublicProfile — every user gets one created in Layout on login.
  const getUserName = React.useCallback((identifier) => {
    if (!identifier) return 'User';
    const profile = profileByUserId.get(identifier) || profileByEmail.get(identifier);
    if (profile?.fullName) return cleanDisplayName(profile.fullName, profile.email);
    return 'User';
  }, [profileByUserId, profileByEmail]);

  const translateTopicMutation = useMutation({
    mutationFn: async (topic) => {
      const languagePrompts = { en: "English", he: "Hebrew", ar: "Arabic" };
      const titlePrompt = `You are a professional translator. Translate the following text to ${languagePrompts[language]}.

CRITICAL INSTRUCTIONS:
- Return ONLY the translated text, nothing else
- Do not add any explanations or comments
- Maintain exact same formatting

Text to translate:
${topic.title}

Return ONLY the translated text:`;
      
      const titleResult = await base44.integrations.Core.InvokeLLM({
        prompt: titlePrompt,
        add_context_from_internet: false,
      });
      const translatedTitle = (typeof titleResult === 'string' ? titleResult : titleResult.content || titleResult).trim();

      const newTranslations = {
        ...(topic.translations || {}),
        [language]: {
          title: translatedTitle
        }
      };

      await base44.entities.Topic.update(topic.id, {
        translations: newTranslations
      });

      return { topicId: topic.id, translations: newTranslations };
    },
    onMutate: async (topic) => {
      setShowTranslatedTopics(prev => ({ ...prev, [topic.id]: true }));
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['topics', document.id], (oldData) => {
        if (!oldData) return oldData;
        return oldData.map(t => 
          t.id === data.topicId 
            ? { ...t, translations: data.translations }
            : t
        );
      });
    }
  });

  // Pre-group sections by topicId so getSectionsForTopic is O(1)
  const sectionsByTopicId = React.useMemo(() => {
    const map = new Map();
    for (const s of sections) {
      if (!map.has(s.topicId)) map.set(s.topicId, []);
      map.get(s.topicId).push(s);
    }
    // Sort each group once
    map.forEach(arr => arr.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return new Date(a.created_date) - new Date(b.created_date);
    }));
    return map;
  }, [sections]);

  const getSectionsForTopic = React.useCallback((topicId) => {
    return sectionsByTopicId.get(topicId) || [];
  }, [sectionsByTopicId]);

  // Pre-group pending edit/delete suggestions by sectionId for O(1) lookup
  const suggestionsBySectionId = React.useMemo(() => {
    const map = new Map();
    for (const s of suggestions) {
      if (s.sectionId && (s.type === 'edit_section' || s.type === 'delete_section') && s.status === 'pending') {
        if (!map.has(s.sectionId)) map.set(s.sectionId, []);
        map.get(s.sectionId).push(s);
      }
    }
    return map;
  }, [suggestions]);

  const getSuggestionsForSection = React.useCallback(
    (sectionId) => suggestionsBySectionId.get(sectionId) || [],
    [suggestionsBySectionId]
  );

  // Find the sectionId of the target suggestion (for LazySection force-mount)
  // For edit_suggestion types, look up the parent suggestion's sectionId
  const targetSuggestionSectionId = React.useMemo(() => {
    if (!targetSuggestionId || !suggestions) return null;
    const sug = suggestions.find(s => s.id === targetSuggestionId);
    if (sug?.sectionId) return sug.sectionId;
    if (sug?.parentSuggestionId) {
      const parent = suggestions.find(s => s.id === sug.parentSuggestionId);
      return parent?.sectionId || null;
    }
    return null;
  }, [targetSuggestionId, suggestions]);

  // ── Orphaned suggestions (section was deleted) ──────────────────────
  // Pending edit/delete suggestions whose target section no longer exists.
  // Grouped by deleted sectionId → one ghost slot per deleted section,
  // anchored to topicId + originalSectionOrder (stamped at deletion time).
  const existingSectionIds = React.useMemo(() => new Set(sections.map(s => s.id)), [sections]);
  const ghostSlotsByTopicId = React.useMemo(() => {
    const perTopic = new Map();
    for (const s of suggestions) {
      if (s.status !== 'pending') continue;
      // Orphaned edit/delete suggestions + edit_suggestion children published after the section was deleted
      // (edit_suggestion inherits the deleted sectionId + topicId from its orphaned parent)
      if (s.type !== 'edit_section' && s.type !== 'delete_section' && s.type !== 'edit_suggestion') continue;
      if (!s.sectionId || existingSectionIds.has(s.sectionId)) continue;
      if (!s.topicId) continue; // not anchored — can't place
      if (!perTopic.has(s.topicId)) perTopic.set(s.topicId, new Map());
      const slots = perTopic.get(s.topicId);
      if (!slots.has(s.sectionId)) {
        slots.set(s.sectionId, { sectionId: s.sectionId, originalSectionOrder: s.originalSectionOrder ?? 999, suggestions: [] });
      }
      const slot = slots.get(s.sectionId);
      slot.suggestions.push(s);
      // edit_suggestion children don't carry originalSectionOrder — keep the stamped value from the orphaned parent
      if (s.originalSectionOrder != null && (slot.originalSectionOrder == null || slot.originalSectionOrder === 999)) {
        slot.originalSectionOrder = s.originalSectionOrder;
      }
    }
    const result = new Map();
    for (const [topicId, slots] of perTopic.entries()) {
      result.set(topicId, Array.from(slots.values()).sort((a, b) => a.originalSectionOrder - b.originalSectionOrder));
    }
    return result;
  }, [suggestions, existingSectionIds]);
  const getGhostSlotsForTopic = React.useCallback((topicId) => ghostSlotsByTopicId.get(topicId) || [], [ghostSlotsByTopicId]);

  // Pre-group new-section suggestions by topicId — single pass, O(1) lookup per topic
  const newSectionSuggestionsByTopicId = React.useMemo(() => {
    const map = new Map();
    for (const s of suggestions) {
      if (s.type !== 'new_section') continue;
      if (s.parentSuggestionId) continue;
      if (s.status !== 'pending') continue;
      if (s.sectionId) continue;
      if (!s.topicId) continue; // new-topic suggestions handled separately
      if (!map.has(s.topicId)) map.set(s.topicId, []);
      map.get(s.topicId).push(s);
    }
    map.forEach(arr => {
      // Server returns suggestions sorted by -created_date (newest first).
      // Reverse to oldest-first so Array.sort (stable) preserves oldest-first
      // for suggestions with identical created_date at the same insertPosition,
      // ensuring newer suggestions appear below older ones.
      arr.reverse();
      arr.sort((a, b) => {
        const posDiff = (a.insertPosition ?? 999) - (b.insertPosition ?? 999);
        if (posDiff !== 0) return posDiff;
        // Same insertPosition: maintain creation order so newer suggestions appear after older ones
        return new Date(a.created_date) - new Date(b.created_date);
      });
    });
    return map;
  }, [suggestions]);

  const getNewSectionSuggestionsForTopic = React.useCallback(
    (topicId) => newSectionSuggestionsByTopicId.get(topicId) || [],
    [newSectionSuggestionsByTopicId]
  );

  // Pre-compute new-topic suggestions (no topicId yet) in a single pass
  const newTopicSuggestions = React.useMemo(() => {
    const arr = [];
    for (const s of suggestions) {
      if (s.type !== 'new_section') continue;
      if (s.status !== 'pending') continue;
      if (s.topicId) continue;
      if (!s.newTopicTitle) continue;
      if (s.parentSuggestionId) continue;
      if (s.sectionId) continue;
      arr.push(s);
    }
    arr.sort((a, b) => (a.newTopicOrder || 999) - (b.newTopicOrder || 999));
    return arr;
  }, [suggestions]);

  const getNewTopicSuggestions = React.useCallback(() => newTopicSuggestions, [newTopicSuggestions]);

  // Pre-index new-topic suggestions by newTopicOrder for O(1) lookup
  const newTopicSuggestionsByOrder = React.useMemo(() => {
    const map = new Map();
    for (const s of newTopicSuggestions) {
      if (s.newTopicOrder != null) map.set(s.newTopicOrder, s);
    }
    return map;
  }, [newTopicSuggestions]);

  const getNewTopicSuggestionsAfterTopic = React.useCallback(
    (topicOrder) => {
      const s = newTopicSuggestionsByOrder.get(topicOrder + 1);
      return s ? [s] : [];
    },
    [newTopicSuggestionsByOrder]
  );

  const reorderSectionsMutation = useMutation({
    mutationFn: async ({ topicId, reorderedSections }) => {
      await base44.entities.Section.bulkUpdate(
        reorderedSections.map((section, index) => ({ id: section.id, order: index }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections', document?.id] });
    },
  });

  const handleSectionDragEnd = (result, topicId) => {
    if (!result.destination || !isAdmin) return;

    const topicSections = getSectionsForTopic(topicId);
    const items = Array.from(topicSections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    reorderSectionsMutation.mutate({
      topicId,
      reorderedSections: items
    });
  };

  const reorderTopicsMutation = useMutation({
    mutationFn: async ({ reorderedTopics }) => {
      await base44.entities.Topic.bulkUpdate(
        reorderedTopics.map((topic, index) => ({ id: topic.id, order: index }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics', document?.id] });
    },
  });

  const handleTopicDragEnd = (result) => {
    if (!result.destination || !isAdmin) return;

    const items = Array.from(topics);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    reorderTopicsMutation.mutate({
      reorderedTopics: items
    });
  };

  const deleteTopicMutation = useMutation({
    mutationFn: async (topicId) => {
      // Delete all sections in this topic
      const topicSections = sections.filter(s => s.topicId === topicId);
      const sectionIds = topicSections.map(s => s.id);
      if (sectionIds.length > 0) {
        await base44.entities.Section.deleteMany({ id: { $in: sectionIds } });
      }

      // Delete the topic
      await base44.entities.Topic.delete(topicId);

      // Reject any orphaned suggestions targeting the deleted sections
      if (sectionIds.length > 0) {
        base44.functions.invoke('rejectOrphanedSuggestions', {
          sectionIds,
          documentId: document.id,
          gamificationEnabled: !!document.gamificationEnabled
        }).catch(err => console.error('[DELETE TOPIC] Failed to reject orphaned suggestions:', err));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics', document?.id] });
      queryClient.invalidateQueries({ queryKey: ['sections', document?.id] });
    },
  });

  const handleDeleteTopic = (topicId, topicTitle) => {
    if (window.confirm(`האם אתה בטוח שברצונך למחוק את הנושא "${topicTitle}" וכל הסעיפים שבו?`)) {
      deleteTopicMutation.mutate(topicId);
    }
  };

  // Pre-group pending topic-edit suggestions by topicId for O(1) lookup
  const topicEditSuggestionsByTopicId = React.useMemo(() => {
    const map = new Map();
    for (const s of topicEditSuggestions) {
      if (s.status !== 'pending') continue;
      if (!s.topicId) continue;
      if (!map.has(s.topicId)) map.set(s.topicId, []);
      map.get(s.topicId).push(s);
    }
    return map;
  }, [topicEditSuggestions]);

  const getTopicEditSuggestions = React.useCallback(
    (topicId) => topicEditSuggestionsByTopicId.get(topicId) || [],
    [topicEditSuggestionsByTopicId]
  );

  // O(1) lookup map for topic edit votes
  const topicEditVotesMap = React.useMemo(() => {
    const map = new Map();
    topicEditVotes?.forEach(v => map.set(v.suggestionId, v));
    return map;
  }, [topicEditVotes]);

  const getUserTopicVote = React.useCallback(
    (suggestionId) => topicEditVotesMap.get(suggestionId),
    [topicEditVotesMap]
  );

  const voteTopicEditMutation = useTopicVoteMutation({ document, user, topicEditSuggestions, queryClient });

  // Helper: render a draggable new-section suggestion card with DnD reorder support (admin only)
  const renderDraggableSuggestion = React.useCallback((suggestion, abovePos, belowPos, extraProps = {}) => (
    <DraggableSuggestionCard
      key={suggestion.id}
      suggestion={suggestion}
      document={document}
      getUserName={getUserName}
      acceptedSuggestions={acceptedSuggestions}
      user={user}
      getUserVote={getUserVote}
      voteMutation={voteMutation}
      onOpenSidebar={onOpenSuggestionSidebar}
      getCommentsCount={getCommentsCount}
      isAdmin={isAdmin}
      onEditSuggestion={onEditSuggestion}
      allDocumentSuggestions={suggestions}
      targetSuggestionId={targetSuggestionId}
      onReorder={(id, pos) => reorderMutation.mutate({ suggestionId: id, newInsertPosition: pos })}
      abovePos={abovePos}
      belowPos={belowPos}
      {...extraProps}
    />
  ), [document, getUserName, acceptedSuggestions, user, getUserVote, voteMutation, onOpenSuggestionSidebar, getCommentsCount, isAdmin, onEditSuggestion, suggestions, targetSuggestionId, reorderMutation]);

  return (
    <>
      <EditTopicModal
        isOpen={!!editingTopic}
        onClose={() => setEditingTopic(null)}
        topic={editingTopic}
        document={document}
        user={user}
        isAdmin={isAdmin}
      />
      
      <DragDropContext onDragEnd={handleTopicDragEnd}>
        <Droppable droppableId="topics" isDropDisabled={!isAdmin}>
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4 md:space-y-6 w-full overflow-x-hidden">
            {topics.map((topic, topicIndex) => {
              const topicSections = getSectionsForTopic(topic.id);
              const topicGhostSlots = getGhostSlotsForTopic(topic.id);
              
              return (
                <Draggable key={topic.id} draggableId={`topic-${topic.id}`} index={topicIndex} isDragDisabled={!isAdmin}>
                  {(topicProvided, topicSnapshot) => (
                    <div
                      ref={topicProvided.innerRef}
                      {...topicProvided.draggableProps}
                      className={topicSnapshot.isDragging ? 'opacity-70' : ''}
                    >
                      <Card className="bg-white border-slate-200 w-full overflow-hidden">
                        <CardHeader className="border-b border-slate-100 p-4 md:p-6">
                          <div className={`flex items-start gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            {/* Drag handle - only for admin */}
                            {isAdmin && (
                              <div 
                                {...topicProvided.dragHandleProps}
                                className="p-1 bg-white rounded border border-slate-300 cursor-move hover:bg-slate-50 transition-colors flex-shrink-0 mt-1"
                              >
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
                                isRTL={isRTL}
                              />
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
                                      setShowTranslatedTopics(prev => ({ ...prev, [topic.id]: false }));
                                    } else if (topic.translations?.[language]?.title) {
                                      setShowTranslatedTopics(prev => ({ ...prev, [topic.id]: true }));
                                    } else {
                                      translateTopicMutation.mutate(topic);
                                    }
                                  }}
                                  className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  title={showTranslatedTopics[topic.id] ? t('showOriginal') : t('translate')}
                                >
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
                                   toast.error(language === 'he' ? 'אינך חבר בקבוצה זו' : 'You are not a member of this group');
                                   return;
                                 }
                                 setEditingTopic(topic);
                               }}
                               className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                               title="הצע עריכה לכותרת"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              
                              {/* Delete button - only for admin */}
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
                  {/* Show new section suggestions when there are no sections */}
                  {(() => {
                    const noSectionSuggs = getNewSectionSuggestionsForTopic(topic.id);
                    return (
                      <>
                        {isAdmin && noSectionSuggs.length === 0 && (
                          <SuggestionDropZone
                            getPosition={() => computeDropPosition(null, null)}
                            onDrop={(id, pos) => reorderMutation.mutate({ suggestionId: id, newInsertPosition: pos })}
                            isAdmin={isAdmin}
                          />
                        )}
                        {noSectionSuggs.map((suggestion, suggIdx) =>
                          renderDraggableSuggestion(
                            suggestion,
                            suggIdx === 0 ? null : noSectionSuggs[suggIdx - 1].insertPosition,
                            suggIdx === noSectionSuggs.length - 1 ? null : noSectionSuggs[suggIdx + 1].insertPosition
                          )
                        )}
                      </>
                    );
                  })()}
                     {/* Ghost slots for deleted sections that still have open proposals */}
                     {topicGhostSlots.map(ghost => {
                       const sortedGhostSuggestions = [...ghost.suggestions].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
                       const rootSuggestion = sortedGhostSuggestions[0];
                       return (
                         <div key={`ghost-${ghost.sectionId}`}>
                           <NewSectionSuggestionCard
                             suggestion={rootSuggestion}
                             document={document}
                             getUserName={getUserName}
                             acceptedSuggestions={acceptedSuggestions}
                             user={user}
                             getUserVote={getUserVote}
                             voteMutation={voteMutation}
                             onOpenSidebar={onOpenSuggestionSidebar}
                             getCommentsCount={getCommentsCount}
                             
                             
                             isAdmin={isAdmin}
                             onEditSuggestion={onEditSuggestion}
                             allDocumentSuggestions={suggestions}
                             targetSuggestionId={targetSuggestionId}
                             ghostChain={sortedGhostSuggestions}
                           />
                         </div>
                       );
                     })}
                     {/* Insert button when there are no existing sections — only suggestions */}
                     <div className="group relative h-8 flex items-center justify-center my-1 z-10">
                       <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="h-full flex items-center justify-center">
                           <Button
                             size="sm"
                             variant="outline"
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
                             }}
                             className="bg-white shadow-md border-blue-300 text-blue-600 hover:bg-blue-50"
                           >
                             <Plus className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                             {t('insertSectionHere')}
                           </Button>
                         </div>
                       </div>
                     </div>
                     </>
                     ) : (
                     <DragDropContext onDragEnd={(result) => handleSectionDragEnd(result, topic.id)}>
                  <Droppable droppableId={`sections-${topic.id}`} isDropDisabled={!isAdmin}>
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3 md:space-y-4">
                        {topicSections.map((section, index) => {
                        const newSectionSuggestions = getNewSectionSuggestionsForTopic(topic.id);
                        const allSectionSuggestions = getSuggestionsForSection(section.id);
                        // New section suggestions rendered AFTER this section (pre-computed for insert button placement)
                        const suggestionsAfterThisSection = newSectionSuggestions.filter(s => {
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
                        // Ghost slots (deleted section) whose order falls before the first section
                        const ghostsBefore = index === 0
                          ? topicGhostSlots.filter(g => g.originalSectionOrder < section.order)
                          : [];
                        // Ghost slots whose order falls after this section and before the next (or at the end)
                        const ghostsAfter = topicGhostSlots.filter(g =>
                          g.originalSectionOrder > section.order &&
                          (index === topicSections.length - 1 || g.originalSectionOrder < topicSections[index + 1].order)
                        );
                  
                  return (
                    <React.Fragment key={section.id}>
                    {ghostsBefore.map(ghost => {
                      const sortedGhostSuggestions = [...ghost.suggestions].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
                      const rootSuggestion = sortedGhostSuggestions[0];
                      return (
                        <div key={`ghost-${ghost.sectionId}`}>
                          <NewSectionSuggestionCard
                            suggestion={rootSuggestion}
                            document={document}
                            getUserName={getUserName}
                            acceptedSuggestions={acceptedSuggestions}
                            user={user}
                            getUserVote={getUserVote}
                            voteMutation={voteMutation}
                            onOpenSidebar={onOpenSuggestionSidebar}
                            getCommentsCount={getCommentsCount}
                            
                            
                            isAdmin={isAdmin}
                            onEditSuggestion={onEditSuggestion}
                            allDocumentSuggestions={suggestions}
                            targetSuggestionId={targetSuggestionId}
                            ghostChain={sortedGhostSuggestions}
                          />
                        </div>
                      );
                    })}
                    <Draggable key={section.id} draggableId={section.id} index={index} isDragDisabled={!isAdmin}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={snapshot.isDragging ? 'opacity-70' : ''}
                        >
                          <>
                            {/* intentionally empty - new section suggestions are rendered AFTER each section below */}

                            {index > 0 && (
                              <div className="group relative h-4 flex items-center justify-center -my-2 -mb-4 z-10">
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="h-full flex items-center justify-center">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                       if (!user) {
                                         base44.auth.redirectToLogin(window.location.href);
                                         return;
                                       }
                                       if (!canParticipate) return;
                                       // Insert AFTER the previous section (index-1): pass order+1 so backend places it at the correct position
                                       onNewSection(topic.id, topicSections[index - 1].order + 1);
                                      }}
                                      className="bg-white shadow-md border-blue-300 text-blue-600 hover:bg-blue-50"
                                      >
                                      <Plus className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                                      {t('insertSectionHere')}
                                      </Button>
                                      </div>
                                      </div>
                                      </div>
                                      )}
                                      {index === 0 && (
                                        <div className="group relative h-4 flex items-center justify-center -mt-2 -mb-2 z-10">
                                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="h-full flex items-center justify-center">
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                  if (!user) {
                                                    base44.auth.redirectToLogin(window.location.href);
                                                    return;
                                                  }
                                                  if (!canParticipate) return;
                                                  onNewSection(topic.id, -1);
                                                }}
                                                className="bg-white shadow-md border-blue-300 text-blue-600 hover:bg-blue-50"
                                              >
                                                <Plus className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                                                {t('insertSectionHere')}
                                              </Button>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                      <div className="space-y-3 relative group/section">
                                      {isAdmin && (
                                      <div 
                                      {...provided.dragHandleProps}
                                      className="absolute top-2 left-2 z-10 p-1 bg-white rounded border border-slate-300 cursor-move hover:bg-slate-50 transition-colors"
                                      >
                                      <GripVertical className="w-4 h-4 text-slate-400" />
                                      </div>
                                      )}
                                      {/* הצעות להוספת סעיף לפני הסעיף הראשון */}
                                      {index === 0 && (() => {
                                        const beforeFirst = newSectionSuggestions.filter(s => {
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
                                                isAdmin={isAdmin}
                                              />
                                            )}
                                            {beforeFirst.map((suggestion, suggIdx) =>
                                              renderDraggableSuggestion(
                                                suggestion,
                                                suggIdx === 0 ? null : beforeFirst[suggIdx - 1].insertPosition,
                                                suggIdx === beforeFirst.length - 1 ? section.order : beforeFirst[suggIdx + 1].insertPosition
                                              )
                                            )}
                                          </>
                                        );
                                      })()}
                                      <LazySection
                                        forceMount={section.id === targetSuggestionSectionId || newlyCreatedSuggestion?.sectionId === section.id}
                                        estimatedHeight={250}
                                      >
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
                              allDocumentSuggestions={suggestions}
                              sectionVotes={sectionVotesBySectionId.get(section.id) || []}
                              sourceSuggestion={sourceSuggestionBySectionId.get(section.id)}
                              />
                                     </LazySection>
                              </div>
                            {/* Show new section suggestions in their correct position:
                                - BEFORE the first section (index=0): insertPosition === -1
                                - AFTER section at index i: insertPosition === topicSections[i].order
                                - AFTER the last section: insertPosition is null/undefined or doesn't match any section order */}
                            {suggestionsAfterThisSection
                              .map((suggestion, suggIdx) =>
                                renderDraggableSuggestion(
                                  suggestion,
                                  suggIdx === 0 ? section.order + 1 : suggestionsAfterThisSection[suggIdx - 1].insertPosition,
                                  suggIdx === suggestionsAfterThisSection.length - 1
                                    ? (index < topicSections.length - 1 ? topicSections[index + 1].order : null)
                                    : suggestionsAfterThisSection[suggIdx + 1].insertPosition
                                )
                              )}
                            {isAdmin && suggestionsAfterThisSection.length === 0 && (
                              <SuggestionDropZone
                                getPosition={() => computeDropPosition(
                                  section.order + 1,
                                  index < topicSections.length - 1 ? topicSections[index + 1].order : null
                                )}
                                onDrop={(id, pos) => reorderMutation.mutate({ suggestionId: id, newInsertPosition: pos })}
                                isAdmin={isAdmin}
                              />
                            )}
                            {/* Insert button after new section suggestion cards — maintains order by
                                using the same insertPosition; newer suggestions sort after older ones */}
                            {suggestionsAfterThisSection.length > 0 && (
                              <div className="group relative h-8 flex items-center justify-center my-1 z-10">
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="h-full flex items-center justify-center">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        if (!user) {
                                          base44.auth.redirectToLogin(window.location.href);
                                          return;
                                        }
                                        if (!canParticipate) return;
                                        onNewSection(topic.id, section.order + 1);
                                      }}
                                      className="bg-white shadow-md border-blue-300 text-blue-600 hover:bg-blue-50"
                                    >
                                      <Plus className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                                      {t('insertSectionHere')}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {index === topicSections.length - 1 && (
                              <>
                                <div className="section-insert-space group relative h-4 flex items-center justify-center mt-2">
                                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 tutorial-force-insert-btn transition-opacity">
                                    <div className="h-full flex items-center justify-center">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          if (!user) {
                                            base44.auth.redirectToLogin(window.location.href);
                                            return;
                                          }
                                          if (!canParticipate) return;
                                          onNewSection(topic.id, section.order + 1);
                                        }}
                                        className="bg-white shadow-md border-blue-300 text-blue-600 hover:bg-blue-50"
                                        >
                                        <Plus className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                                        {t('insertSectionHere')}
                                        </Button>
                                        </div>
                                        </div>
                                        </div>
                                        <div className="opacity-0 group-hover/section:opacity-100 transition-opacity absolute -bottom-4 left-1/2 -translate-x-1/2 z-10">
                                        <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                        if (!user) {
                                        base44.auth.redirectToLogin(window.location.href);
                                        return;
                                        }
                                        if (!canParticipate) return;
                                        onNewSection(topic.id, section.order + 1);
                                        }}
                                    className="bg-white shadow-md border-blue-300 text-blue-600 hover:bg-blue-50"
                                  >
                                    <Plus className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                                    {t('insertSectionHere')}
                                  </Button>
                                </div>
                              </>
                            )}
                          </>
                        </div>
                      )}
                    </Draggable>
                    {ghostsAfter.map(ghost => {
                      const sortedGhostSuggestions = [...ghost.suggestions].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
                      const rootSuggestion = sortedGhostSuggestions[0];
                      return (
                        <div key={`ghost-${ghost.sectionId}`}>
                          <NewSectionSuggestionCard
                            suggestion={rootSuggestion}
                            document={document}
                            getUserName={getUserName}
                            acceptedSuggestions={acceptedSuggestions}
                            user={user}
                            getUserVote={getUserVote}
                            voteMutation={voteMutation}
                            onOpenSidebar={onOpenSuggestionSidebar}
                            getCommentsCount={getCommentsCount}
                            
                            
                            isAdmin={isAdmin}
                            onEditSuggestion={onEditSuggestion}
                            allDocumentSuggestions={suggestions}
                            targetSuggestionId={targetSuggestionId}
                            ghostChain={sortedGhostSuggestions}
                          />
                        </div>
                      );
                    })}
                    </React.Fragment>
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

                      {/* הצעות לנושאים חדשים שאמורות להופיע אחרי נושא זה */}
                      {getNewTopicSuggestionsAfterTopic(topic.order).map((suggestion) => (
                        <Card key={suggestion.id} className="bg-white border-slate-200 w-full overflow-hidden mt-4">
                          <CardHeader className="border-b border-slate-100 p-4 md:p-6 bg-purple-50">
                            <div className={`flex items-start gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              <CardTitle className={`text-lg md:text-2xl break-words flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                                {suggestion.newTopicTitle} <Badge className="ml-2 bg-purple-600 text-white">נושא חדש מוצע</Badge>
                              </CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent className="p-3 md:p-6 space-y-3 md:space-y-4 overflow-x-hidden">
                            <NewSectionSuggestionCard
                              suggestion={suggestion}
                              document={document}
                              getUserName={getUserName}
                              acceptedSuggestions={acceptedSuggestions}
                              user={user}
                              getUserVote={getUserVote}
                              voteMutation={voteMutation}
                              onOpenSidebar={onOpenSuggestionSidebar}
                              getCommentsCount={getCommentsCount}
                              
                              
                              isAdmin={isAdmin}
                              onEditSuggestion={onEditSuggestion}
                              allDocumentSuggestions={suggestions}
                              targetSuggestionId={targetSuggestionId}
                              />
                              </CardContent>
                              </Card>
                              ))}
                              </div>
                              )}
                              </Draggable>
                              );
                              })}
                              {provided.placeholder}

                              {/* הצעות לנושאים חדשים בסוף (שלא שויכו לנושא מסוים) */}
                            {getNewTopicSuggestions()
                            .filter(s => {
                            // אם אין נושאים - הצג הכל
                            if (topics.length === 0) return true;

                            // אם אין newTopicOrder - הצג בסוף (לא שויך לנושא ספציפי)
                            if (s.newTopicOrder === undefined || s.newTopicOrder === null) return true;

                            // הצג רק אם newTopicOrder לא שויך לאף נושא קיים (כלומר לא הוצג כבר ע"י getNewTopicSuggestionsAfterTopic)
                            const topicOrders = topics.map(t => t.order);
                            // getNewTopicSuggestionsAfterTopic מציג הצעות עם newTopicOrder === topicOrder + 1
                            const alreadyShown = topicOrders.some(order => s.newTopicOrder === order + 1);
                            return !alreadyShown;
                            })
                            .map((suggestion) => (
                            <Card key={suggestion.id} className="bg-white border-slate-200 w-full overflow-hidden">
                            <CardHeader className="border-b border-slate-100 p-4 md:p-6 bg-purple-50">
                            <div className={`flex items-start gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <CardTitle className={`text-lg md:text-2xl break-words flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                            {suggestion.newTopicTitle} <Badge className="ml-2 bg-purple-600 text-white">נושא חדש מוצע</Badge>
                            </CardTitle>
                            </div>
                            </CardHeader>
                            <CardContent className="p-3 md:p-6 space-y-3 md:space-y-4 overflow-x-hidden">
                              <NewSectionSuggestionCard
                                suggestion={suggestion}
                                document={document}
                                getUserName={getUserName}
                                acceptedSuggestions={acceptedSuggestions}
                                user={user}
                                getUserVote={getUserVote}
                                voteMutation={voteMutation}
                                onOpenSidebar={onOpenSuggestionSidebar}
                                getCommentsCount={getCommentsCount}
                                
                                
                                isAdmin={isAdmin}
                                onEditSuggestion={onEditSuggestion}
                                allDocumentSuggestions={suggestions}
                                targetSuggestionId={targetSuggestionId}
                                />
                            </CardContent>
                            </Card>
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
    </>
  );
}