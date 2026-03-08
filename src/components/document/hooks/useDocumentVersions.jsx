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

    // For direct_edit (no suggestionId), pair "before" and "after" records by sectionId proximity
    // Group direct_edits by sectionId so we can pair them
    const directEditsBySectionId = new Map();
    sortedVersions.forEach(v => {
      if (!v.suggestionId && v.changeType === 'direct_edit') {
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
    
    // Process each suggestion
    const processedSuggestions = new Set();
    sortedVersions.forEach(v => {
      if (!v.suggestionId || processedSuggestions.has(v.suggestionId)) return;
      processedSuggestions.add(v.suggestionId);
      
      const versionsForSuggestion = versionsBySuggestion.get(v.suggestionId);
      versionsForSuggestion.sort((a, b) => (b.version || 0) - (a.version || 0));
      const afterVersion = versionsForSuggestion[0];
      const beforeVersion = versionsForSuggestion[1];
      
      const relatedSuggestion = suggestions?.find(s => s.id === afterVersion.suggestionId);
      
      // Calculate weighted consensus at this point
      const acceptedSuggestionsUpToHere = suggestions
        ?.filter(s => s.status === 'accepted' && new Date(s.created_date) <= new Date(afterVersion.created_date))
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date)) || [];

      const weightedConsensusAtTime = acceptedSuggestionsUpToHere.length === 0 ? 0.5 : 
        acceptedSuggestionsUpToHere.reduce((sum, s) => {
          const total = (s.proVotes || 0) + (s.conVotes || 0);
          const consensus = total > 0 ? (s.proVotes || 0) / total : 0;
          return sum + Math.min(1, consensus);
        }, 0) / acceptedSuggestionsUpToHere.length;

      // Detect topic title change versions
      const isTopicTitleChange = afterVersion.content?.startsWith('topic_title_change:');
      let topicTitleChangeMeta = null;
      if (isTopicTitleChange) {
        const parts = afterVersion.content.split(':');
        // format: topic_title_change:topicId:originalTitle:newTitle
        topicTitleChangeMeta = {
          topicId: parts[1],
          originalTitle: parts.slice(2, parts.length - 1).join(':'),
          newTitle: parts[parts.length - 1]
        };
        // Try smarter split since titles may contain colons
        const match = afterVersion.content.match(/^topic_title_change:([^:]+):(.+):([^:]+)$/);
        if (match) {
          topicTitleChangeMeta = { topicId: match[1], originalTitle: match[2], newTitle: match[3] };
        }
      }

      const snapshotAfterChange = {
        version: afterVersion.version,
        label: `גרסה ${afterVersion.version}`,
        timestamp: afterVersion.created_date,
        changeDescription: afterVersion.changeDescription,
        changeType: afterVersion.changeType,
        suggestionId: afterVersion.suggestionId,
        sectionContents: { ...currentSectionContents },
        existingSections: new Set(currentExistingSections),
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
        // Get content from current state or beforeVersion
        const deletedContent = currentSectionContents[afterVersion.sectionId] || beforeVersion?.content || '';
        snapshotAfterChange.deletedSectionContent = deletedContent;
        snapshotAfterChange.sectionContents[afterVersion.sectionId] = deletedContent;
        snapshotAfterChange.existingSections.add(afterVersion.sectionId);
      }
      
      snapshots.push(snapshotAfterChange);
      
      // Update state for older version
      if (afterVersion.changeType === 'section_created') {
        delete currentSectionContents[afterVersion.sectionId];
        currentExistingSections.delete(afterVersion.sectionId);
      } else if (afterVersion.content === '') {
        // For deletions, keep the content from before the delete
        const contentBeforeDelete = beforeVersion?.content || snapshotAfterChange.deletedSectionContent;
        if (contentBeforeDelete) {
          currentSectionContents[afterVersion.sectionId] = contentBeforeDelete;
          currentExistingSections.add(afterVersion.sectionId);
        }
      } else if (beforeVersion) {
        currentSectionContents[afterVersion.sectionId] = beforeVersion.content;
      }
    });
    
    // Process direct_edit pairs
    directEditPairs.forEach(({ afterVersion, beforeVersion }) => {
      const relatedSuggestion = suggestions?.find(s => s.id === afterVersion.suggestionId);

      const snapshotAfterChange = {
        version: afterVersion.version,
        label: `עריכה ישירה`,
        timestamp: afterVersion.created_date,
        changeDescription: afterVersion.changeDescription,
        changeType: 'direct_edit',
        isDirectEdit: true,
        suggestionId: null,
        sectionContents: { ...currentSectionContents },
        existingSections: new Set(currentExistingSections),
        changedSectionId: afterVersion.sectionId,
        newContent: afterVersion.content,
        allSectionIds,
        proVotes: 0,
        conVotes: 0,
        weightedConsensus: null,
        documentThresholdAtTime: null
      };

      if (afterVersion.content === '') {
        snapshotAfterChange.isDeleted = true;
        snapshotAfterChange.deletedSectionId = afterVersion.sectionId;
        const deletedContent = currentSectionContents[afterVersion.sectionId] || beforeVersion?.content || '';
        snapshotAfterChange.deletedSectionContent = deletedContent;
        snapshotAfterChange.sectionContents[afterVersion.sectionId] = deletedContent;
        snapshotAfterChange.existingSections.add(afterVersion.sectionId);
      }

      snapshots.push(snapshotAfterChange);

      // Update state for older view
      if (beforeVersion) {
        currentSectionContents[afterVersion.sectionId] = beforeVersion.content;
        currentExistingSections.add(afterVersion.sectionId);
      } else if (afterVersion.changeType === 'section_created') {
        delete currentSectionContents[afterVersion.sectionId];
        currentExistingSections.delete(afterVersion.sectionId);
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