import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FileText, Users, TrendingUp, Languages, Loader2, Bell } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { calculateContributorsFromData } from "@/components/document/calculateContributors";

export default function MyDocuments() {
  const { t, isRTL, language } = useLanguage();
  const [translatedTitles, setTranslatedTitles] = useState({});
  const [translating, setTranslating] = useState({});

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: userInteractions = [], isLoading: interactionsLoading } = useQuery({
    queryKey: ['userInteractions', user?.id],
    queryFn: () => base44.entities.UserInteraction.filter({ userId: user.id }),
    enabled: !!user?.id,
  });

  const { data: allDocuments = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['allDocuments'],
    queryFn: () => base44.entities.Document.list('-created_date'),
    enabled: !!user?.id,
  });

  const { data: suggestions = [] } = useQuery({
    queryKey: ['mySuggestions', user?.id],
    queryFn: () => base44.entities.Suggestion.filter({ created_by: user.email }),
    enabled: !!user?.email,
  });

  const { data: votes = [] } = useQuery({
    queryKey: ['myVotes', user?.id],
    queryFn: () => base44.entities.Vote.filter({ userId: user.id }),
    enabled: !!user?.id,
  });

  // Derive the set of document IDs the user participates in
  const myDocumentIds = React.useMemo(() => {
    const suggestedDocIds = suggestions.map(s => s.documentId);
    const interactedDocIds = userInteractions.map(ui => ui.documentId);
    return [...new Set([...interactedDocIds, ...suggestedDocIds])];
  }, [suggestions, userInteractions]);

  // Fetch only data scoped to documents the user is involved in
  const { data: allSuggestions = [] } = useQuery({
    queryKey: ['allSuggestions', myDocumentIds],
    queryFn: () => myDocumentIds.length > 0
      ? base44.entities.Suggestion.filter({ documentId: { $in: myDocumentIds } })
      : Promise.resolve([]),
    enabled: !!user?.id && myDocumentIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  const { data: allVotes = [] } = useQuery({
    queryKey: ['allVotes', user?.id],
    queryFn: () => base44.entities.Vote.filter({ userId: user.id }),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allComments = [] } = useQuery({
    queryKey: ['allComments', myDocumentIds],
    queryFn: async () => {
      if (myDocumentIds.length === 0) return [];
      const suggestionIds = allSuggestions.map(s => s.id);
      const sectionIds = allSections.map(s => s.id);
      if (suggestionIds.length === 0 && sectionIds.length === 0) return [];
      return base44.entities.Comment.filter({
        rootEntityId: { $in: [...suggestionIds, ...sectionIds, ...myDocumentIds] }
      });
    },
    enabled: !!user?.id && allSuggestions.length >= 0 && allSections.length >= 0,
    staleTime: 2 * 60 * 1000,
  });

  const { data: allSections = [] } = useQuery({
    queryKey: ['allSections', myDocumentIds],
    queryFn: () => myDocumentIds.length > 0
      ? base44.entities.Section.filter({ documentId: { $in: myDocumentIds } })
      : Promise.resolve([]),
    enabled: !!user?.id && myDocumentIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Calculate real contributors per document using shared logic
  const getDocumentContributors = (doc) => {
    return calculateContributorsFromData({
      document: doc,
      suggestions: allSuggestions.filter(s => s.documentId === doc.id),
      allVotes,
      allUsers,
      allArguments,
      allComments,
      sections: allSections.filter(s => s.documentId === doc.id)
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto text-center py-20">
          <p className="text-slate-600">{t('signIn')}</p>
        </div>
      </div>
    );
  }

  // כל הצעות שהמשתמש הצביע עליהן מבוססות על allVotes (מסוננות לפי userId כבר)
  const votedSuggestions = allSuggestions.filter(s =>
    allVotes.some(v => v.suggestionId === s.id)
  );
  const votedDocumentIds = votedSuggestions.map(s => s.documentId);

  const myDocumentIdsSet = new Set([
    ...myDocumentIds,
    ...votedDocumentIds,
  ]);

  const myDocuments = allDocuments.filter(doc => myDocumentIdsSet.has(doc.id));
  
  const isLoading = interactionsLoading || documentsLoading;

  if (isLoading) {
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

  // Check for unvoted suggestions per document
  const getUnvotedSuggestionsCount = (docId) => {
    if (!user?.id) return 0;
    const docSuggestions = allSuggestions.filter(s => s.documentId === docId && s.status === 'pending' && s.type !== 'edit_suggestion');
    const unvoted = docSuggestions.filter(s => !votes.some(v => v.suggestionId === s.id));
    return unvoted.length;
  };

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
        <header>
          <h1 className="text-3xl font-bold text-slate-900">{t('myDocuments')}</h1>
          <p className="text-slate-600 mt-2">
            {language === 'ar' 
              ? `الوثائق التي شاركت فيها (${myDocuments.length})`
              : language === 'he'
              ? `מסמכים שהשתתפת בהם (${myDocuments.length})`
              : `Documents you participated in (${myDocuments.length})`}
          </p>
        </header>

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
              const unvotedCount = getUnvotedSuggestionsCount(doc.id);

              return (
                <Card key={doc.id} className={`bg-white/80 backdrop-blur-sm border-slate-200 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 h-full ${unvotedCount > 0 ? 'ring-2 ring-orange-400 ring-offset-2' : ''}`}>
                  {unvotedCount > 0 && (
                    <Link to={`${createPageUrl("DocumentView")}?id=${doc.id}`}>
                      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 text-sm font-medium flex items-center gap-2 hover:from-orange-600 hover:to-amber-600 transition-colors cursor-pointer">
                        <Bell className="w-4 h-4 animate-pulse" />
                        <span>
                          {language === 'he' 
                            ? `יש ${unvotedCount} ${unvotedCount === 1 ? 'הצעה' : 'הצעות'} שטרם הצבעת עליהן`
                            : language === 'ar'
                            ? `${unvotedCount} اقتراح لم تصوت عليه بعد`
                            : `${unvotedCount} suggestion${unvotedCount > 1 ? 's' : ''} awaiting your vote`}
                        </span>
                      </div>
                    </Link>
                  )}
                  <CardHeader className="border-b border-slate-100">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`${createPageUrl("DocumentView")}?id=${doc.id}`} className="flex-1 cursor-pointer">
                        <CardTitle className="text-xl line-clamp-2">
                          {typeof translatedTitles[doc.id] === 'string' ? translatedTitles[doc.id] : doc.title}
                        </CardTitle>
                      </Link>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleTranslateTitle(doc);
                          }}
                          disabled={translating[doc.id]}
                          aria-label={translating[doc.id] ? (language === 'he' ? 'מתרגם...' : 'Translating...') : translatedTitles[doc.id] ? (language === 'he' ? 'הצג מקור' : 'Show original') : (language === 'he' ? 'תרגם כותרת' : 'Translate title')}
                        >
                          {translating[doc.id] ? (
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" aria-hidden="true" />
                          ) : (
                            <Languages className={`w-4 h-4 ${translatedTitles[doc.id] ? 'text-green-600' : 'text-slate-400'}`} aria-hidden="true" />
                          )}
                        </Button>
                        <FileText className="w-5 h-5 text-blue-600" aria-hidden="true" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-400" aria-hidden="true" />
                          <div className="text-sm">
                            <div className="font-semibold text-slate-700">
                              {getDocumentContributors(doc)}
                            </div>
                            <div className="text-xs text-slate-500">{t('contributors')}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-slate-400" aria-hidden="true" />
                          <div className="text-sm">
                            <div className="font-semibold text-slate-700">
                              {(() => {
                                const consensuses = doc.consensuses || [];
                                if (consensuses.length === 0) return '0';
                                const avg = consensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / consensuses.length;
                                return (Math.min(100, avg * 100)).toFixed(0);
                              })()}%
                            </div>
                            <div className="text-xs text-slate-500">{t('consensus')}</div>
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