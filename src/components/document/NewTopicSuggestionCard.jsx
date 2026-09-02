import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import NewSectionSuggestionCard from "@/components/document/NewSectionSuggestionCard";
import { useDocContent } from "@/components/document/DocumentContentContext";

export default function NewTopicSuggestionCard({ suggestion, className = "" }) {
  const {
    isRTL, document, getUserName, acceptedSuggestions, user, getUserVote,
    voteMutation, onOpenSuggestionSidebar, getCommentsCount, isAdmin,
    onEditSuggestion, suggestions, targetSuggestionId
  } = useDocContent();

  return (
    <Card className={`bg-white border-slate-200 w-full overflow-hidden ${className}`}>
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
          targetSuggestionId={targetSuggestionId} />
      </CardContent>
    </Card>
  );
}