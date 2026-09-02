import React from "react";
import NewSectionSuggestionCard from "@/components/document/NewSectionSuggestionCard";
import { useDocContent } from "@/components/document/DocumentContentContext";

export default function GhostSlot({ ghost }) {
  const {
    document, getUserName, acceptedSuggestions, user, getUserVote,
    voteMutation, onOpenSuggestionSidebar, getCommentsCount, isAdmin,
    onEditSuggestion, suggestions, targetSuggestionId
  } = useDocContent();

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
        ghostChain={sortedGhostSuggestions} />
    </div>
  );
}