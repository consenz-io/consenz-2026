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
    
    // Sort versions newest first by version number (more reliable than created_date)
    const sortedVersions = [...allVersions].sort((a, b) => (b.version || 0) - (a.version || 0));
    
    // Track section states as we go backwards
    let currentSectionContents = { ...currentSnapshot.sectionContents };
    let currentExistingSections = new Set(currentSnapshot.existingSections);
    
    // Group versions by suggestionId
    const versionsBySuggestion = new Map();
    sortedVersions.forEach(v => {
      if (v.suggestionId) {
        if (!versionsBySuggestion.has(v.suggestionId)) {
          versionsBySuggestion.set(v.suggestionId, []);
        }
        versionsBySuggestion.get(v.suggestionId).push(v);
      }
    });
    
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

      const snapshotAfterChange = {
        version: afterVersion.version,
        label: `גרסה ${afterVersion.version}`,
        timestamp: afterVersion.created_date,
        changeDescription: afterVersion.changeDescription,
        changeType: afterVersion.changeType,
        suggestionId: afterVersion.suggestionId,
        sectionContents: { ...currentSectionContents },
        existingSections: new Set(currentExistingSections),
        changedSectionId: afterVersion.sectionId,
        newContent: afterVersion.content,
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