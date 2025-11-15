import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FileText, Users, TrendingUp, Languages, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function MyDocuments() {
  const { t, isRTL, language } = useLanguage();
  const [translatedTitles, setTranslatedTitles] = useState({});
  const [translating, setTranslating] = useState({});

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: userInteractions, isLoading: interactionsLoading } = useQuery({
    queryKey: ['userInteractions', user?.id],
    queryFn: () => base44.entities.UserInteraction.filter({ userId: user.id }),
    enabled: !!user?.id,
    initialData: [],
  });

  const { data: allDocuments, isLoading: documentsLoading } = useQuery({
    queryKey: ['allDocuments'],
    queryFn: () => base44.entities.Document.list('-created_date'),
    enabled: !!user?.id,
    initialData: [],
  });

  const { data: suggestions } = useQuery({
    queryKey: ['mySuggestions', user?.id],
    queryFn: () => base44.entities.Suggestion.filter({ created_by: user.email }),
    enabled: !!user?.email,
    initialData: [],
  });

  const { data: votes } = useQuery({
    queryKey: ['myVotes', user?.id],
    queryFn: () => base44.entities.Vote.filter({ userId: user.id }),
    enabled: !!user?.id,
    initialData: [],
  });

  const { data: allSuggestions } = useQuery({
    queryKey: ['allSuggestions'],
    queryFn: () => base44.entities.Suggestion.list(),
    enabled: !!user?.id,
    initialData: [],
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto text-center py-20">
          <p className="text-slate-600">{t('signIn')}</p>
        </div>
      </div>
    );
  }

  if (interactionsLoading || documentsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  // קבלת מסמכים שהמשתמש השתתף בהם
  const interactedDocumentIds = userInteractions.map(ui => ui.documentId);
  const suggestedDocumentIds = suggestions.map(s => s.documentId);
  const votedSuggestions = allSuggestions.filter(s => 
    votes.some(v => v.suggestionId === s.id)
  );
  const votedDocumentIds = votedSuggestions.map(s => s.documentId);

  const myDocumentIds = new Set([
    ...interactedDocumentIds,
    ...suggestedDocumentIds,
    ...votedDocumentIds
  ]);

  const myDocuments = allDocuments.filter(doc => myDocumentIds.has(doc.id));

  const handleTranslateTitle = async (doc) => {
    if (translatedTitles[doc.id]) {
      // אם כבר יש תרגום, הסר אותו (חזור למקורי)
      setTranslatedTitles(prev => {
        const newState = { ...prev };
        delete newState[doc.id];
        return newState;
      });
      return;
    }

    setTranslating(prev => ({ ...prev, [doc.id]: true }));
    try {
      const targetLang = language === 'ar' ? 'Arabic' : language === 'he' ? 'Hebrew' : 'English';
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Translate the following text to ${targetLang}. Return ONLY the translation, nothing else:\n\n${doc.title}`,
      });
      setTranslatedTitles(prev => ({ ...prev, [doc.id]: response }));
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setTranslating(prev => ({ ...prev, [doc.id]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t('myDocuments')}</h1>
          <p className="text-slate-600 mt-2">
            {language === 'ar' 
              ? `الوثائق التي شاركت فيها (${myDocuments.length})`
              : language === 'he'
              ? `מסמכים שהשתתפת בהם (${myDocuments.length})`
              : `Documents you participated in (${myDocuments.length})`}
          </p>
        </div>

        {myDocuments.length === 0 ? (
          <Card className="bg-white border-slate-200">
            <CardContent className="p-12 text-center">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">
                {language === 'ar'
                  ? 'لم تشارك بعد في أي وثيقة'
                  : language === 'he'
                  ? 'עדיין לא השתתפת באף מסמך'
                  : "You haven't participated in any document yet"}
              </p>
              <Link to={createPageUrl("Home")}>
                <span className="text-blue-600 hover:underline">{t('browseContribute')}</span>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myDocuments.map((doc) => {
              const mySuggestionsCount = suggestions.filter(s => s.documentId === doc.id).length;
              const myVotesCount = votedSuggestions.filter(s => s.documentId === doc.id).length;

              return (
                <Card key={doc.id} className="bg-white/80 backdrop-blur-sm border-slate-200 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 h-full">
                  <CardHeader className="border-b border-slate-100">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`${createPageUrl("DocumentView")}?id=${doc.id}`} className="flex-1 cursor-pointer">
                        <CardTitle className="text-xl line-clamp-2">
                          {translatedTitles[doc.id] || doc.title}
                        </CardTitle>
                      </Link>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleTranslateTitle(doc);
                          }}
                          disabled={translating[doc.id]}
                        >
                          {translating[doc.id] ? (
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          ) : (
                            <Languages className={`w-4 h-4 ${translatedTitles[doc.id] ? 'text-green-600' : 'text-slate-400'}`} />
                          )}
                        </Button>
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline" className={
                          doc.privacy === 'public_view_open_participation' 
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }>
                          {doc.privacy.replace(/_/g, ' ')}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-400" />
                          <div className="text-sm">
                            <div className="font-semibold text-slate-700">
                              {doc.totalUsersInteracted || 0}
                            </div>
                            <div className="text-xs text-slate-500">{t('contributors')}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-slate-400" />
                          <div className="text-sm">
                            <div className="font-semibold text-slate-700">
                              {((doc.avgSuggestionConsensus || 0) * 100).toFixed(0)}%
                            </div>
                            <div className="text-xs text-slate-500">{t('consensus')}</div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <div>
                            {language === 'ar' 
                              ? 'مقترحاتي: ' 
                              : language === 'he' 
                              ? 'ההצעות שלי: ' 
                              : 'My suggestions: '}
                            <span className="font-semibold text-blue-600">{mySuggestionsCount}</span>
                          </div>
                          <div>
                            {language === 'ar' 
                              ? 'أصواتي: ' 
                              : language === 'he' 
                              ? 'ההצבעות שלי: ' 
                              : 'My votes: '}
                            <span className="font-semibold text-green-600">{myVotesCount}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-slate-400">
                        {t('created')} {new Date(doc.created_date).toLocaleDateString()}
                      </div>
                    </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}