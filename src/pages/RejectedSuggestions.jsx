import React from "react";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, AlertCircle, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";

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

  const { data: publicProfiles = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    enabled: suggestions.length > 0,
  });

  const getCreatorName = (email) => {
    const profile = publicProfiles.find(p => p.email === email);
    return profile?.fullName || email;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-48" />
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to={`${createPageUrl("DocumentView")}?id=${documentId}`}>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
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

        {/* Content */}
        {suggestions.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200">
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
              <Link
                key={suggestion.id}
                to={`${createPageUrl("SuggestionDetail")}?id=${suggestion.id}&documentId=${documentId}`}
              >
                <Card className="bg-white/80 backdrop-blur-sm border-slate-200 hover:shadow-lg hover:scale-[1.01] transition-all cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg line-clamp-2">
                          {suggestion.title}
                        </CardTitle>
                        <p className="text-sm text-slate-500 mt-2">
                          {language === 'he' ? 'על ידי' : language === 'ar' ? 'من قبل' : 'By'} {getCreatorName(suggestion.created_by)}
                        </p>
                      </div>
                      <Badge variant="destructive" className="flex-shrink-0">
                        {t('rejected')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Clock className="w-4 h-4" />
                      {new Date(suggestion.created_date).toLocaleDateString(language === 'he' ? 'he-IL' : language === 'ar' ? 'ar-SA' : 'en-US')}
                    </div>
                    {suggestion.explanation && (
                      <p className="text-slate-600 mt-3 line-clamp-2">
                        {suggestion.explanation}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}