import React from "react";

/**
 * Custom hook for managing document version history
 * Builds version snapshots from DocumentVersion entities
 */
export function useDocumentVersions(document, sections, allVersions, suggestions) {
  const versionGroups = React.useMemo(() => {
    if (!document || !sections) return [];
    
    const snapshots = [];
    
    // Collect all section IDs that ever existed
    const allSectionIds = new Set();
    sections.forEach(s => allSectionIds.add(s.id));
    allVersions?.forEach(v => {
      if (v.sectionId) allSectionIds.add(v.sectionId);
    });
    
    // Calculate current weighted consensus
    const consensuses = document.consensuses || [];
    const currentWeightedConsensus = consensuses.length === 0 ? 0.5 :
      consensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / consensuses.length;
    
    // Current state snapshot
    const currentSnapshot = {
      version: 'current',
      label: 'נוכחית',
      timestamp: new Date().toISOString(),
      sectionContents: {},
      existingSections: new Set(),
      allSectionIds,
      weightedConsensus: currentWeightedConsensus,
      documentThreshold: document.threshold || 2,
      totalParticipants: document.totalUsersInteracted || 0
    };
    
    sections.forEach(s => {
      currentSnapshot.sectionContents[s.id] = s.content;
      currentSnapshot.existingSections.add(s.id);
    });
    snapshots.push(currentSnapshot);
    
    if (!allVersions || allVersions.length === 0) {
      return snapshots;
    }
    
    // Sort versions newest first by created_date (reflects actual acceptance time)
    const sortedVersions = [...allVersions].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    
    // Track section states as we go backwards
    let currentSectionContents = { ...currentSnapshot.sectionContents };
    let currentExistingSections = new Set(currentSnapshot.existingSections);
    
    // Group versions by suggestionId (or by a unique direct_edit key per sectionId+version pair)
    const versionsBySuggestion = new Map();
    sortedVersions.forEach(v => {
      const groupKey = v.suggestionId || `direct_edit_${v.sectionId}_${v.version}`;
      if (!versionsBySuggestion.has(groupKey)) {
        versionsBySuggestion.set(groupKey, []);
      }
      versionsBySuggestion.get(groupKey).push(v);
    });

    // For versions without a suggestionId (direct_edit, section_created, etc.)
    // Group by sectionId so we can pair them
    const directEditsBySectionId = new Map();
    sortedVersions.forEach(v => {
      if (!v.suggestionId) {
        if (!directEditsBySectionId.has(v.sectionId)) {
          directEditsBySectionId.set(v.sectionId, []);
        }
        directEditsBySectionId.get(v.sectionId).push(v);
      }
    });

    // Build grouped edit pairs for direct_edits: each pair = [afterVersion, beforeVersion]
    const directEditPairs = [];
    directEditsBySectionId.forEach((versions, sectionId) => {
      // sort ascending by version number to pair them
      const sorted = [...versions].sort((a, b) => (a.version || 0) - (b.version || 0));
      // pair: even index = before (לפני:), odd = after
      for (let i = 1; i < sorted.length; i += 2) {
        directEditPairs.push({ afterVersion: sorted[i], beforeVersion: sorted[i - 1] });
      }
      // if odd count, last one is unpaired after
      if (sorted.length % 2 === 1) {
        directEditPairs.push({ afterVersion: sorted[sorted.length - 1], beforeVersion: null });
      }
    });
    // Sort pairs by afterVersion.created_date descending
    directEditPairs.sort((a, b) => new Date(b.afterVersion.created_date) - new Date(a.afterVersion.created_date));
    
    // Build all events (suggestion groups + direct edit pairs) and process them chronologically
    const allEvents = [];

    // Suggestion events
    const processedSuggestions = new Set();
    sortedVersions.forEach(v => {
      if (!v.suggestionId || processedSuggestions.has(v.suggestionId)) return;
      processedSuggestions.add(v.suggestionId);
      const versionsForSuggestion = versionsBySuggestion.get(v.suggestionId);
      versionsForSuggestion.sort((a, b) => (b.version || 0) - (a.version || 0));
      const afterVersion = versionsForSuggestion[0];
      const beforeVersion = versionsForSuggestion[1];
      allEvents.push({ eventType: 'suggestion', afterVersion, beforeVersion, timestamp: new Date(afterVersion.created_date) });
    });

    // Direct edit events
    directEditPairs.forEach(pair => {
      allEvents.push({ eventType: 'direct_edit', ...pair, timestamp: new Date(pair.afterVersion.created_date) });
    });

    // Sort all events newest first so we walk backwards through history
    allEvents.sort((a, b) => b.timestamp - a.timestamp);

    // Process all events in one chronological pass
    allEvents.forEach(event => {
      const { afterVersion, beforeVersion } = event;

      if (event.eventType === 'suggestion') {
        const relatedSuggestion = suggestions?.find(s => s.id === afterVersion.suggestionId);

        const acceptedSuggestionsUpToHere = suggestions
          ?.filter(s => s.status === 'accepted' && new Date(s.created_date) <= new Date(afterVersion.created_date))
          .sort((a, b) => new Date(a.created_date) - new Date(b.created_date)) || [];

        const weightedConsensusAtTime = acceptedSuggestionsUpToHere.length === 0 ? 0.5 :
          acceptedSuggestionsUpToHere.reduce((sum, s) => {
            const total = (s.proVotes || 0) + (s.conVotes || 0);
            const consensus = total > 0 ? (s.proVotes || 0) / total : 0;
            return sum + Math.min(1, consensus);
          }, 0) / acceptedSuggestionsUpToHere.length;

        const isTopicTitleChange = afterVersion.content?.startsWith('topic_title_change:');
        let topicTitleChangeMeta = null;
        if (isTopicTitleChange) {
          const raw = afterVersion.content.slice('topic_title_change:'.length);
          const firstColon = raw.indexOf(':');
          if (firstColon !== -1) {
            const topicId = raw.slice(0, firstColon);
            const rest = raw.slice(firstColon + 1);
            const descMatch = afterVersion.changeDescription?.match(/^כותרת נושא עודכנה: (.+) → (.+)$/);
            if (descMatch) {
              topicTitleChangeMeta = { topicId, originalTitle: descMatch[1], newTitle: descMatch[2] };
            } else {
              const lastColon = rest.lastIndexOf(':');
              topicTitleChangeMeta = {
                topicId,
                originalTitle: lastColon !== -1 ? rest.slice(0, lastColon) : rest,
                newTitle: lastColon !== -1 ? rest.slice(lastColon + 1) : ''
              };
            }
          }
        }

        // Snapshot the state BEFORE mutating currentSectionContents
        const frozenContents = { ...currentSectionContents };
        const frozenExisting = new Set(currentExistingSections);

        // Update state FIRST (walk backwards: remove "after", restore "before")
        if (afterVersion.changeType === 'section_created') {
          delete currentSectionContents[afterVersion.sectionId];
          currentExistingSections.delete(afterVersion.sectionId);
        } else if (afterVersion.content === '') {
          const contentBeforeDelete = beforeVersion?.content || currentSectionContents[afterVersion.sectionId] || '';
          if (contentBeforeDelete) {
            currentSectionContents[afterVersion.sectionId] = contentBeforeDelete;
            currentExistingSections.add(afterVersion.sectionId);
          }
        } else if (beforeVersion) {
          currentSectionContents[afterVersion.sectionId] = beforeVersion.content;
        }

        const snapshotAfterChange = {
          version: afterVersion.version,
          label: `גרסה ${afterVersion.version}`,
          timestamp: afterVersion.created_date,
          changeDescription: afterVersion.changeDescription,
          changeType: afterVersion.changeType,
          suggestionId: afterVersion.suggestionId,
          sectionContents: frozenContents,
          existingSections: frozenExisting,
          changedSectionId: isTopicTitleChange ? null : afterVersion.sectionId,
          newContent: isTopicTitleChange ? null : afterVersion.content,
          isTopicTitleChange: isTopicTitleChange || false,
          topicTitleChangeMeta,
          allSectionIds,
          proVotes: relatedSuggestion?.proVotes || 0,
          conVotes: relatedSuggestion?.conVotes || 0,
          participantsAtAcceptance: relatedSuggestion?.participantsAtAcceptance || 0,
          suggestionConsensus: relatedSuggestion?.suggestionConsensus || 0,
          weightedConsensus: weightedConsensusAtTime,
          documentThresholdAtTime: document.threshold || 2
        };

        if (afterVersion.changeType === 'section_created') {
          snapshotAfterChange.isNewSection = true;
          snapshotAfterChange.newSectionId = afterVersion.sectionId;
          snapshotAfterChange.newSectionContent = afterVersion.content;
        }

        if (afterVersion.content === '') {
          snapshotAfterChange.isDeleted = true;
          snapshotAfterChange.deletedSectionId = afterVersion.sectionId;
          const deletedContent = beforeVersion?.content || frozenContents[afterVersion.sectionId] || '';
          snapshotAfterChange.deletedSectionContent = deletedContent;
          snapshotAfterChange.sectionContents = { ...frozenContents, [afterVersion.sectionId]: deletedContent };
          snapshotAfterChange.existingSections = new Set([...frozenExisting, afterVersion.sectionId]);
        }

        snapshots.push(snapshotAfterChange);

      } else if (event.eventType === 'direct_edit') {
        const frozenContents = { ...currentSectionContents };
        const frozenExisting = new Set(currentExistingSections);

        // Update state FIRST (walk backwards)
        if (afterVersion.changeType === 'section_created') {
          delete currentSectionContents[afterVersion.sectionId];
          currentExistingSections.delete(afterVersion.sectionId);
        } else if (beforeVersion) {
          currentSectionContents[afterVersion.sectionId] = beforeVersion.content;
          currentExistingSections.add(afterVersion.sectionId);
        }

        const snapshotAfterChange = {
          version: afterVersion.version,
          label: `עריכה ישירה`,
          timestamp: afterVersion.created_date,
          changeDescription: afterVersion.changeDescription,
          changeType: 'direct_edit',
          isDirectEdit: true,
          suggestionId: null,
          sectionContents: frozenContents,
          existingSections: frozenExisting,
          changedSectionId: afterVersion.sectionId,
          newContent: afterVersion.content,
          allSectionIds,
          proVotes: 0,
          conVotes: 0,
          weightedConsensus: null,
          documentThresholdAtTime: null
        };

        if (afterVersion.changeType === 'section_created') {
          snapshotAfterChange.isNewSection = true;
          snapshotAfterChange.newSectionId = afterVersion.sectionId;
          snapshotAfterChange.newSectionContent = afterVersion.content;
        } else if (afterVersion.content === '') {
          snapshotAfterChange.isDeleted = true;
          snapshotAfterChange.deletedSectionId = afterVersion.sectionId;
          const deletedContent = frozenContents[afterVersion.sectionId] || beforeVersion?.content || '';
          snapshotAfterChange.deletedSectionContent = deletedContent;
          snapshotAfterChange.sectionContents = { ...frozenContents, [afterVersion.sectionId]: deletedContent };
          snapshotAfterChange.existingSections = new Set([...frozenExisting, afterVersion.sectionId]);
        }

        snapshots.push(snapshotAfterChange);
      }
    });

    // Re-sort all snapshots (index 0 = current, rest by timestamp descending)
    const [currentSnap, ...historySnaps] = snapshots;
    historySnaps.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    snapshots.length = 0;
    snapshots.push(currentSnap, ...historySnaps);

    // Add original version
    if (Object.keys(currentSectionContents).length > 0) {
      snapshots.push({
        version: 0,
        label: 'גרסה מקורית',
        timestamp: document.created_date || new Date(0).toISOString(),
        sectionContents: { ...currentSectionContents },
        existingSections: new Set(currentExistingSections),
        allSectionIds,
        isOriginal: true
      });
    }
    
    return snapshots;
  }, [allVersions, sections, document, suggestions]);

  return versionGroups;
  }