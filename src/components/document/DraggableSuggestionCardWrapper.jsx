import React from "react";
import DraggableSuggestionCard from "@/components/document/DraggableSuggestionCard";
import { useDocContent } from "@/components/document/DocumentContentContext";

export default function DraggableSuggestionCardWrapper({ suggestion, abovePos, belowPos, ...extraProps }) {
  const {
    document, getUserName, acceptedSuggestions, user, getUserVote,
    voteMutation, onOpenSuggestionSidebar, getCommentsCount, isAdmin,
    onEditSuggestion, suggestions, targetSuggestionId, reorderMutation
  } = useDocContent();

  return (
    <DraggableSuggestionCard
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
      {...extraProps} />
  );
}