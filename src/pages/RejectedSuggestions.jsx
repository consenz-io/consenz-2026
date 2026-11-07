import React from "react";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowRight, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";
import RejectedSuggestionCard from "@/components/rejectedSuggestions/RejectedSuggestionCard";

export default function RejectedSuggestions() {
  const { t, language, isRTL } = useLanguage();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('id');

  const { data: document } = useQuery({
    queryKey: ['document', documentId],
    queryFn: async () => {
      const docs = await base44.entities.Document.filter({ id: documentId });
      return docs && docs.length > 0 ? docs[0] : null;
    },
    enabled: !!documentId,
  });

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['rejectedSuggestions', documentId],
    queryFn: async () => {
      if (!documentId) return [];
      const results = await base44.entities.Suggestion.filter({
        documentId,
        status: 'rejected'
      }, '-created_date');
      return results || [];
    },
    enabled: !!documentId,
  });

  // Comments of these suggestions only — not a platform-wide scan
  const suggestionIds = React.useMemo(() => suggestions.map(s => s.id), [suggestions]);

  const { data: comments = [] } = useQuery({
    queryKey: ['rejectedSuggestionComments', suggestionIds.join(',')],
    queryFn: () => base44.entities.Comment.filter(
      { rootEntityType: 'suggestion', rootEntityId: { $in: suggestionIds } },
      '-created_date'
    ),
    enabled: suggestionIds.length > 0,
    staleTime: 60 * 1000,
  });

  // One profile lookup for both suggestion authors and comment authors
  const profileIds = React.useMemo(() => Array.from(new Set([
    ...suggestions.map(s => s.created_by_id),
    ...comments.map(c => c.created_by_id),
  ].filter(Boolean))).sort(), [suggestions, comments]);

  const { data: profiles = [] } = useQuery({
    queryKey: ['rejectedSuggestionProfiles', profileIds.join(',')],
    queryFn: () => base44.entities.UserPublicProfile.filter({ userId: { $in: profileIds } }),
    enabled: profileIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const namesById = React.useMemo(() => {
    const map = new Map();
    profiles.forEach(p => { if (p.userId) map.set(p.userId, p.fullName); });
    return map;
  }, [profiles]);

  const commentsBySuggestion = React.useMemo(() => {
    const map = new Map();
    comments.forEach(comment => {
      const list = map.get(comment.rootEntityId) || [];
      list.push({
        ...comment,
        authorName: namesById.get(comment.created_by_id) || comment.created_by || '',
      });
      map.set(comment.rootEntityId, list);
    });
    return map;
  }, [comments, namesById]);

  const getCreatorName = (suggestion) => {
    return namesById.get(suggestion?.created_by_id) || suggestion?.created_by;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-48" />
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link to={`${createPageUrl("DocumentView")}?id=${documentId}`}>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
              {language === 'he' ? 'חזור' : language === 'ar' ? 'رجوع' : 'Back'}
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {language === 'he' ? 'הצעות שנדחו' : language === 'ar' ? 'المقترحات المرفوضة' : 'Rejected Suggestions'}
            </h1>
            {document && (
              <p className="text-slate-600 mt-1">{document.title}</p>
            )}
          </div>
        </div>

        {suggestions.length === 0 ? (
          <Card className="bg-white border-slate-200">
            <CardContent className="p-12 text-center">
              <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">
                {language === 'he' ? 'אין הצעות שנדחו במסמך זה' : language === 'ar' ? 'لا توجد مقترحات مرفوضة في هذه الوثيقة' : 'No rejected suggestions in this document'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {suggestions.map(suggestion => (
              <RejectedSuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                documentId={documentId}
                document={document}
                language={language}
                t={t}
                creatorName={getCreatorName(suggestion)}
                comments={commentsBySuggestion.get(suggestion.id) || []}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}