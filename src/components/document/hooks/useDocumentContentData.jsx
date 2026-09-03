import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";
import { cleanDisplayName } from "@/lib/displayName";
import { autoAcceptTopicEditSuggestion, checkTopicEditConsensus } from "@/components/document/suggestionAutoAccept";
import { useVoteMutation } from "@/components/document/hooks/useVoteMutation";
import { useTopicVoteMutation } from "@/components/document/hooks/useTopicVoteMutation";
import { useSuggestionReorder } from "@/components/document/hooks/useSuggestionReorder";

export function useDocumentContentData({
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
  onEditSuggestion,
  scrollToSectionId
}) {
  const [showTranslatedTopics, setShowTranslatedTopics] = useState({});
  const [editingTopic, setEditingTopic] = useState(null);

  const queryClient = useQueryClient();
  const { t, isRTL, language: rawLanguage } = useLanguage();
  const language = rawLanguage || 'he';
  const { reorderMutation } = useSuggestionReorder(document?.id);

  const acceptedSuggestions = useMemo(
    () => suggestions.filter((s) => s.status === 'accepted'),
    [suggestions]
  );

  // All suggestion votes for this document — used to build per-suggestion voter lists
  // so SectionDeletionVoteBar can deduplicate users who voted on BOTH the suggestion
  // (inherited) AND directly on the section (preventing double-counting).
  // Reactive cache read — useQuery with enabled:false subscribes to cache updates,
  // so this re-renders when aggregatedData is invalidated/updated. getQueryData was
  // non-reactive and could return stale data until an unrelated re-render occurred.
  const { data: aggregatedData } = useQuery({
    queryKey: ['documentAggregatedData', document?.id],
    enabled: false,
    staleTime: Infinity
  });
  const allDocumentVotes = aggregatedData?.votes || [];

  // Map each section to the inherited votes from the MOST RECENT accepted suggestion
  // linked to it. Each version of a section has its own vote count — votes from older
  // versions (previous edits) do NOT accumulate. The section's counters reflect only
  // the suggestion that produced the currently displayed content.
  // Includes individual voter user IDs so SectionDeletionVoteBar can deduplicate:
  // a user who voted on the suggestion AND then votes directly on the section should
  // be counted once (their direct vote overrides the inherited one).
  // Group all document votes by suggestionId — depends ONLY on allDocumentVotes,
  // not on suggestions. Split from sourceSuggestionBySectionId so that a
  // suggestions-only change (e.g. new suggestion created, no new votes) doesn't
  // trigger a full O(allVotes) regroup.
  const votesBySuggestionId = useMemo(() => {
    const map = new Map();
    for (const v of allDocumentVotes) {
      if (!v.suggestionId) continue;
      if (!map.has(v.suggestionId)) map.set(v.suggestionId, []);
      map.get(v.suggestionId).push({ userId: v.userId, vote: v.vote });
    }
    return map;
  }, [allDocumentVotes]);

  const sourceSuggestionBySectionId = useMemo(() => {
    const map = new Map();
    for (const s of suggestions) {
      if (s.status === 'accepted' && (s.type === 'new_section' || s.type === 'edit_section') && s.sectionId) {
        const existing = map.get(s.sectionId);
        if (!existing || new Date(s.updated_date) > new Date(existing._updated_date)) {
          map.set(s.sectionId, {
            proVotes: s.proVotes || 0,
            conVotes: s.conVotes || 0,
            voters: votesBySuggestionId.get(s.id) || [],
            _updated_date: s.updated_date
          });
        }
      }
    }
    return map;
  }, [suggestions, votesBySuggestionId]);

  // Read from cache — populated by useDocumentData's aggregated fetch (targeted, not global).
  // Avoids fetching 1000 profiles when only ~10-30 are relevant to this document.
  const { data: publicProfiles = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list('-created_date', 1000),
    enabled: false,
    staleTime: Infinity,
    initialData: []
  });

  const { data: topicEditSuggestions } = useQuery({
    queryKey: ['topicEditSuggestions', document?.id],
    queryFn: () => base44.entities.TopicEditSuggestion.filter({ documentId: document.id }),
    enabled: !!document?.id,
    initialData: []
  });

  const topicSuggestionIds = useMemo(
    () => (topicEditSuggestions || []).map((s) => s.id),
    [topicEditSuggestions]
  );

  const { data: topicEditVotes } = useQuery({
    queryKey: ['topicEditVotes', document?.id, user?.id],
    queryFn: async () => {
      if (!user?.id || topicSuggestionIds.length === 0) return [];
      return await base44.entities.TopicEditVote.filter({
        suggestionId: { $in: topicSuggestionIds },
        userId: user.id
      });
    },
    enabled: !!user?.id && !!document?.id && topicSuggestionIds.length > 0,
    initialData: []
  });

  // Track which suggestion vote-states have been checked for auto-accept
  const hasCheckedRef = useRef(new Set());

  // Scroll to newly created suggestion
  useEffect(() => {
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
  useEffect(() => {
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

  // Comment counts — reuse the same reactive aggregatedData query (defined above).
  const allDocumentComments = aggregatedData?.comments || [];

  // Pre-group comments by "type:id" key for O(1) count lookup
  const commentsCountMap = useMemo(() => {
    const map = new Map();
    for (const c of allDocumentComments) {
      const key = `${c.rootEntityType}:${c.rootEntityId}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [allDocumentComments]);

  const getCommentsCount = useCallback((entityType, entityId) => {
    return commentsCountMap.get(`${entityType}:${entityId}`) || 0;
  }, [commentsCountMap]);

  // Reuse section votes from the aggregated cache — avoids a duplicate API call.
  // useDocumentData already fetched SectionVote scoped to this document's sections.
  const allSectionVotes = aggregatedData?.sectionVotes || [];

  // Pre-group by sectionId for O(1) lookup in SectionVoteButtons
  const sectionVotesBySectionId = useMemo(() => {
    const map = new Map();
    for (const v of allSectionVotes) {
      if (!map.has(v.sectionId)) map.set(v.sectionId, []);
      map.get(v.sectionId).push(v);
    }
    return map;
  }, [allSectionVotes]);

  // Derive the current user's votes from the already-loaded allDocumentVotes array
  // — eliminates a separate API call (was: Vote.filter({ userId, suggestionId: $in })).
  const userVotes = useMemo(() => {
    if (!user?.id || !allDocumentVotes) return [];
    const filtered = allDocumentVotes.filter((v) => v.userId === user.id);
    // Deduplicate — keep last vote per suggestion (most recent wins)
    const seen = new Set();
    const deduped = [];
    for (let i = filtered.length - 1; i >= 0; i--) {
      if (!seen.has(filtered[i].suggestionId)) {
        seen.add(filtered[i].suggestionId);
        deduped.push(filtered[i]);
      }
    }
    return deduped;
  }, [allDocumentVotes, user?.id]);

  // O(1) Map lookup instead of O(n) filter on every call
  const userVotesMap = useMemo(() => {
    const map = new Map();
    if (!userVotes) return map;
    // Iterate forward so the last entry (most recent) wins on duplicates
    for (const v of userVotes) {
      map.set(v.suggestionId, v);
    }
    return map;
  }, [userVotes]);

  const getUserVote = useCallback((suggestionId) => {
    return userVotesMap.get(suggestionId) || null;
  }, [userVotesMap]);

  // Use optimized vote hook
  const voteMutation = useVoteMutation(document, user, suggestions, hasCheckedRef);

  // O(1) lookup maps instead of O(n) find on every call
  // Lookup maps by userId (primary — created_by_id is the populated built-in field)
  // and by email (fallback for legacy callers).
  const profileByUserId = useMemo(() => {
    const map = new Map();
    publicProfiles?.forEach((p) => { if (p.userId) map.set(p.userId, p); });
    return map;
  }, [publicProfiles]);

  const profileByEmail = useMemo(() => {
    const map = new Map();
    publicProfiles?.forEach((p) => { if (p.email) map.set(p.email, p); });
    return map;
  }, [publicProfiles]);

  // Accepts a userId (created_by_id / lastEditedBy) or, as fallback, an email.
  // Uses only UserPublicProfile — every user gets one created in Layout on login.
  const getUserName = useCallback((identifier) => {
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
        add_context_from_internet: false
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
      setShowTranslatedTopics((prev) => ({ ...prev, [topic.id]: true }));
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['topics', document.id], (oldData) => {
        if (!oldData) return oldData;
        return oldData.map((t) =>
          t.id === data.topicId ?
            { ...t, translations: data.translations } :
            t
        );
      });
    }
  });

  // Pre-group sections by topicId so getSectionsForTopic is O(1)
  const sectionsByTopicId = useMemo(() => {
    const map = new Map();
    for (const s of sections) {
      if (!map.has(s.topicId)) map.set(s.topicId, []);
      map.get(s.topicId).push(s);
    }
    // Sort each group once
    map.forEach((arr) => arr.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return new Date(a.created_date) - new Date(b.created_date);
    }));
    return map;
  }, [sections]);

  const getSectionsForTopic = useCallback((topicId) => {
    return sectionsByTopicId.get(topicId) || [];
  }, [sectionsByTopicId]);

  // Pre-group pending edit/delete suggestions by sectionId for O(1) lookup
  const suggestionsBySectionId = useMemo(() => {
    const map = new Map();
    for (const s of suggestions) {
      if (s.sectionId && (s.type === 'edit_section' || s.type === 'delete_section') && s.status === 'pending') {
        if (!map.has(s.sectionId)) map.set(s.sectionId, []);
        map.get(s.sectionId).push(s);
      }
    }
    return map;
  }, [suggestions]);

  // Pre-group ALL suggestions by sectionId (including edit_suggestion children)
  // — passed to SectionCarousel so it doesn't re-filter the full document array per section.
  // Was O(sections × suggestions) per render; now O(suggestions) once + O(1) per section.
  const allSuggestionsBySectionId = useMemo(() => {
    const suggestionById = new Map(suggestions.map((s) => [s.id, s]));
    const bySection = new Map();
    for (const s of suggestions) {
      if (s.sectionId) {
        if (!bySection.has(s.sectionId)) bySection.set(s.sectionId, []);
        bySection.get(s.sectionId).push(s);
      }
    }
    // Add edit_suggestion children that don't have their own sectionId but whose parent does
    for (const s of suggestions) {
      if (s.type === 'edit_suggestion' && !s.sectionId && s.parentSuggestionId) {
        const parent = suggestionById.get(s.parentSuggestionId);
        if (parent?.sectionId && bySection.has(parent.sectionId)) {
          bySection.get(parent.sectionId).push(s);
        }
      }
    }
    return bySection;
  }, [suggestions]);

  const getSuggestionsForSection = useCallback(
    (sectionId) => suggestionsBySectionId.get(sectionId) || [],
    [suggestionsBySectionId]
  );

  // Find the sectionId of the target suggestion (for LazySection force-mount)
  // For edit_suggestion types, look up the parent suggestion's sectionId
  const targetSuggestionSectionId = useMemo(() => {
    if (!targetSuggestionId || !suggestions) return null;
    const sug = suggestions.find((s) => s.id === targetSuggestionId);
    if (sug?.sectionId) return sug.sectionId;
    if (sug?.parentSuggestionId) {
      const parent = suggestions.find((s) => s.id === sug.parentSuggestionId);
      return parent?.sectionId || null;
    }
    return null;
  }, [targetSuggestionId, suggestions]);

  // ── Orphaned suggestions (section was deleted) ──────────────────────
  // Pending edit/delete suggestions whose target section no longer exists.
  // Grouped by deleted sectionId → one ghost slot per deleted section,
  // anchored to topicId + originalSectionOrder (stamped at deletion time).
  const existingSectionIds = useMemo(() => new Set(sections.map((s) => s.id)), [sections]);
  const ghostSlotsByTopicId = useMemo(() => {
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
  const getGhostSlotsForTopic = useCallback((topicId) => ghostSlotsByTopicId.get(topicId) || [], [ghostSlotsByTopicId]);

  // Pre-group new-section suggestions by topicId — single pass, O(1) lookup per topic
  const newSectionSuggestionsByTopicId = useMemo(() => {
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
    map.forEach((arr) => {
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

  const getNewSectionSuggestionsForTopic = useCallback(
    (topicId) => newSectionSuggestionsByTopicId.get(topicId) || [],
    [newSectionSuggestionsByTopicId]
  );

  // Pre-compute new-topic suggestions (no topicId yet) in a single pass
  const newTopicSuggestions = useMemo(() => {
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

  const getNewTopicSuggestions = useCallback(() => newTopicSuggestions, [newTopicSuggestions]);

  // Pre-index new-topic suggestions by newTopicOrder for O(1) lookup
  const newTopicSuggestionsByOrder = useMemo(() => {
    const map = new Map();
    for (const s of newTopicSuggestions) {
      if (s.newTopicOrder != null) map.set(s.newTopicOrder, s);
    }
    return map;
  }, [newTopicSuggestions]);

  const getNewTopicSuggestionsAfterTopic = useCallback(
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
    }
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
    }
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
      const topicSections = sections.filter((s) => s.topicId === topicId);
      const sectionIds = topicSections.map((s) => s.id);
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
        }).catch((err) => console.error('[DELETE TOPIC] Failed to reject orphaned suggestions:', err));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics', document?.id] });
      queryClient.invalidateQueries({ queryKey: ['sections', document?.id] });
    }
  });

  const handleDeleteTopic = (topicId, topicTitle) => {
    if (window.confirm(`האם אתה בטוח שברצונך למחוק את הנושא "${topicTitle}" וכל הסעיפים שבו?`)) {
      deleteTopicMutation.mutate(topicId);
    }
  };

  // Pre-group pending topic-edit suggestions by topicId for O(1) lookup
  const topicEditSuggestionsByTopicId = useMemo(() => {
    const map = new Map();
    for (const s of topicEditSuggestions) {
      if (s.status !== 'pending') continue;
      if (!s.topicId) continue;
      if (!map.has(s.topicId)) map.set(s.topicId, []);
      map.get(s.topicId).push(s);
    }
    return map;
  }, [topicEditSuggestions]);

  const getTopicEditSuggestions = useCallback(
    (topicId) => topicEditSuggestionsByTopicId.get(topicId) || [],
    [topicEditSuggestionsByTopicId]
  );

  // O(1) lookup map for topic edit votes
  const topicEditVotesMap = useMemo(() => {
    const map = new Map();
    topicEditVotes?.forEach((v) => map.set(v.suggestionId, v));
    return map;
  }, [topicEditVotes]);

  const getUserTopicVote = useCallback(
    (suggestionId) => topicEditVotesMap.get(suggestionId),
    [topicEditVotesMap]
  );

  const voteTopicEditMutation = useTopicVoteMutation({ document, user, topicEditSuggestions, queryClient });

  return {
    // Props passthrough
    document, topics, sections, suggestions, user, isAdmin, canParticipate,
    onEditSection, onEditSectionThenVote, onNewSection, onDirectEdit,
    onOpenSuggestionSidebar, newlyCreatedSuggestion, onClearNewlyCreated,
    targetSuggestionId, onEditSuggestion, scrollToSectionId,
    // State
    showTranslatedTopics, setShowTranslatedTopics, editingTopic, setEditingTopic,
    // UI helpers
    t, isRTL, language,
    // Data maps
    acceptedSuggestions, publicProfiles,
    getUserName, getUserVote, voteMutation,
    getCommentsCount, getSectionsForTopic, getSuggestionsForSection,
    getGhostSlotsForTopic, getNewSectionSuggestionsForTopic,
    getNewTopicSuggestions, getNewTopicSuggestionsAfterTopic,
    getTopicEditSuggestions, getUserTopicVote, voteTopicEditMutation,
    translateTopicMutation,
    targetSuggestionSectionId,
    allSuggestionsBySectionId, sectionVotesBySectionId, sourceSuggestionBySectionId,
    // Mutations / handlers
    reorderMutation, handleSectionDragEnd, handleTopicDragEnd, handleDeleteTopic,
  };
}