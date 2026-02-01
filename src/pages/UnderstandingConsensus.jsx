import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, TrendingUp, ThumbsUp, ThumbsDown, Info, CheckCircle2, Target, Scale, Gauge } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";
import PageHeader from "../components/PageHeader";
import { calculateContributorsFromData } from "../components/document/calculateContributors";

export default function UnderstandingConsensus() {
  const { t, isRTL, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('id');
  const returnUrl = searchParams.get('returnUrl');

  const { data: document, isLoading: docLoading } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => base44.entities.Document.filter({ id: documentId }).then(docs => docs[0]),
    enabled: !!documentId,
  });

  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['suggestions', documentId],
    queryFn: () => base44.entities.Suggestion.filter({ documentId }, 'created_date'),
    initialData: [],
    enabled: !!documentId,
  });

  const { data: sections } = useQuery({
    queryKey: ['sections', documentId],
    queryFn: () => base44.entities.Section.filter({ documentId }),
    initialData: [],
    enabled: !!documentId,
  });

  const { data: allVotes } = useQuery({
    queryKey: ['allVotes'],
    queryFn: () => base44.entities.Vote.list(),
    initialData: [],
  });

  const { data: allUsers } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const { data: allArguments } = useQuery({
    queryKey: ['allArguments'],
    queryFn: () => base44.entities.Argument.list(),
    initialData: [],
  });

  const { data: allComments } = useQuery({
    queryKey: ['allComments'],
    queryFn: () => base44.entities.Comment.list(),
    initialData: [],
  });

  const acceptedSuggestions = suggestions.filter(s => s.status === 'accepted');
  
  // Calculate real contributors count using shared logic
  const totalUsers = React.useMemo(() => {
    const count = calculateContributorsFromData({
      document,
      suggestions,
      allVotes,
      allUsers,
      allArguments,
      allComments,
      sections
    });
    return count > 0 ? count : 1;
  }, [document, suggestions, allVotes, allUsers, allArguments, allComments, sections]);
  const consensuses = document?.consensuses || [];
  
  // מד הקונצנזוס הממוצע - ערך בין 0 ל-1 (מוגבל למקסימום 1)
  const documentConsensusMeter = consensuses.length > 0 
    ? Math.min(1, consensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / consensuses.length)
    : 0;
  
  // רף התמיכה הדרוש = מד הקונצנזוס × מספר המשתתפים
  // CRITICAL: כאשר consensuses קיימים, threshold MUST חייב להיות 1 לפחות (לא מעגלים למטה)
  const threshold = consensuses.length > 0 
    ? Math.max(1, Math.round(documentConsensusMeter * totalUsers))
    : (document?.threshold || 2);

  if (docLoading || suggestionsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6">
        <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
          <Skeleton className="h-10 md:h-12 w-48 md:w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6">
        <div className="max-w-4xl mx-auto text-center py-12 md:py-20">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 px-4">{t('documentNotFound')}</h1>
          <Link to={createPageUrl("Home")}>
            <Button className="mt-4">{t('goHome')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className={`max-w-4xl mx-auto space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}>
        <PageHeader 
          title={t('understandingConsensusTitle')}
          backUrl={returnUrl || `${createPageUrl("DocumentView")}?id=${documentId}`}
        />

        {/* Hero Section - שני המושגים המרכזיים */}
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${isRTL ? 'direction-rtl' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
          {/* מד הקונצנזוס */}
          <Card className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-0 shadow-xl">
            <CardContent className="p-6">
              <div className={`flex items-center gap-3 mb-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <Gauge className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{t('consensusMeterLabel')}</h3>
                  <p className="text-indigo-200 text-sm">{t('consensusMeterRange')}</p>
                </div>
              </div>
              <div className="text-center py-4">
                <div className="text-5xl font-bold">{(documentConsensusMeter * 100).toFixed(0)}%</div>
                <p className="text-indigo-200 text-sm mt-2">{t('consensusMeterDescription')}</p>
              </div>
              {/* Progress bar */}
              <div className="mt-4">
                <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, documentConsensusMeter * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-indigo-200 mt-1">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* רף התמיכה הדרוש */}
          <Card className="bg-gradient-to-br from-blue-600 to-cyan-600 text-white border-0 shadow-xl">
            <CardContent className="p-6">
              <div className={`flex items-center gap-3 mb-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <Scale className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{t('supportThresholdLabel')}</h3>
                  <p className="text-blue-200 text-sm">{t('supportThresholdSubtitle')}</p>
                </div>
              </div>
              <div className="text-center py-4">
                <div className="text-5xl font-bold">{threshold}</div>
                <p className="text-blue-200 text-sm mt-2">{t('supportThresholdDescription')}</p>
              </div>
              {/* משתתפים */}
              <div className={`mt-4 bg-white/10 rounded-lg p-3 flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Users className="w-5 h-5" />
                <span className="font-semibold">{totalUsers}</span>
                <span className="text-blue-200">{t('totalParticipantsInDoc')}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* הסבר על המנגנון */}
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-5">
            <div className={`flex gap-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
              <Info className="w-8 h-8 text-amber-600 flex-shrink-0" />
              <div className="space-y-3">
                <h3 className="font-bold text-amber-900 text-lg">{t('howItWorksTitle')}</h3>
                <div className="space-y-2 text-amber-800 text-sm leading-relaxed">
                  <p><strong>{t('consensusMeterExplain1')}</strong> {t('consensusMeterExplain2')}</p>
                  <p><strong>{t('thresholdExplain1')}</strong> {t('thresholdExplain2')}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What this means - practical explanation */}
        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-0">
          <CardContent className={`p-6 md:p-8 ${isRTL ? 'text-right' : ''}`}>
            <h3 className={`text-xl font-bold mb-4 flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Scale className="w-6 h-6" />
              {t('whatThisMeansTitle')}
            </h3>
            <p className="text-slate-300 leading-relaxed text-lg">
              {t('thresholdMeaningDetailed', { threshold })}
            </p>
            <div className="mt-6 bg-white/10 rounded-lg p-4">
              <p className="text-slate-200 text-sm">
                <strong>{t('example')}:</strong> {t('thresholdExample', { threshold })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* נוסחת החישוב */}
        <Card>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 text-lg ${isRTL ? 'flex-row-reverse text-right justify-end' : ''}`}>
              <Target className="w-5 h-5 text-blue-600" />
              {t('calculationFormula')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-50 rounded-xl p-6">
              <div className={`flex flex-col md:flex-row items-center justify-center gap-4 text-center ${isRTL ? 'md:flex-row-reverse' : ''}`}>
                <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-indigo-200 min-w-[140px]">
                  <div className="text-2xl font-bold text-indigo-700">{(documentConsensusMeter * 100).toFixed(0)}%</div>
                  <div className="text-xs text-slate-500 mt-1">{t('consensusMeterLabel')}</div>
                </div>
                <div className="text-3xl text-slate-400 font-light">×</div>
                <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-blue-200 min-w-[140px]">
                  <div className="text-2xl font-bold text-blue-700">{totalUsers}</div>
                  <div className="text-xs text-slate-500 mt-1">{t('participants')}</div>
                </div>
                <div className="text-3xl text-slate-400 font-light">=</div>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 shadow-sm border-2 border-green-300 min-w-[140px]">
                  <div className="text-2xl font-bold text-green-700">{threshold}</div>
                  <div className="text-xs text-slate-500 mt-1">{t('supportThresholdLabel')}</div>
                </div>
              </div>
              <p className="text-center text-sm text-slate-500 mt-4">
                {documentConsensusMeter.toFixed(2)} × {totalUsers} = {(documentConsensusMeter * totalUsers).toFixed(1)} ≈ {threshold}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* היסטוריית ההצעות שאושרו */}
        <Card>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              {t('acceptedSuggestionsHistory')}
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">{t('eachSuggestionAffectsThreshold')}</p>
          </CardHeader>
          <CardContent>
            {acceptedSuggestions.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Target className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="font-medium">{t('noAcceptedSuggestionsYet')}</p>
                <p className="text-sm mt-1">{t('defaultThresholdUsed')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {[...acceptedSuggestions].reverse().map((suggestion, index) => {
                const originalIndex = acceptedSuggestions.length - 1 - index;
                  const proVotes = suggestion.proVotes || 0;
                  const conVotes = suggestion.conVotes || 0;
                  const delta = proVotes - conVotes;
                  // מד קונצנזוס של ההצעה = הפרש קולות / מספר משתתפים (ערך בין 0 ל-1)
                  const suggestionConsensusMeter = consensuses[originalIndex] !== undefined 
                    ? consensuses[originalIndex] 
                    : Math.min(1, Math.max(0, delta / totalUsers));
                  
                  return (
                    <Link 
                      key={suggestion.id}
                      to={`${createPageUrl("SuggestionDetail")}?id=${suggestion.id}`}
                      className="block relative bg-white rounded-xl border-2 border-slate-100 hover:border-green-200 hover:shadow-md transition-all overflow-hidden cursor-pointer"
                    >
                      {/* Header with number */}
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 border-b border-green-100">
                        <div className="flex items-center gap-3">
                          {isRTL ? (
                            <>
                              <div className="flex-1 text-right">
                                <h4 className="font-semibold text-slate-900">{suggestion.title}</h4>
                                <p className="text-xs text-slate-500">
                                  {new Date(suggestion.created_date).toLocaleDateString(
                                    language === 'he' ? 'he-IL' : language === 'ar' ? 'ar-EG' : 'en-US'
                                  )}
                                </p>
                                {suggestion.newContent && (
                                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                                    {suggestion.newContent.replace(/<[^>]*>/g, '').substring(0, 150)}...
                                  </p>
                                )}
                              </div>
                              <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow">
                                {originalIndex + 1}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow">
                                {originalIndex + 1}
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold text-slate-900">{suggestion.title}</h4>
                                <p className="text-xs text-slate-500">
                                  {new Date(suggestion.created_date).toLocaleDateString(
                                    language === 'he' ? 'he-IL' : language === 'ar' ? 'ar-EG' : 'en-US'
                                  )}
                                </p>
                                {suggestion.newContent && (
                                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                                    {suggestion.newContent.replace(/<[^>]*>/g, '').substring(0, 150)}...
                                  </p>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="p-4">
                        {/* Votes visualization - horizontal */}
                        <div className={`flex items-center justify-center gap-3 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
                          {/* Pro votes */}
                          <div className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2">
                            <ThumbsUp className="w-4 h-4 text-green-600" />
                            <span className="font-bold text-green-700">{proVotes}</span>
                            <span className="text-xs text-green-600">{t('pro')}</span>
                          </div>

                          <span className="text-xl text-slate-300">−</span>

                          {/* Con votes */}
                          <div className="flex items-center gap-2 bg-red-50 rounded-lg px-3 py-2">
                            <ThumbsDown className="w-4 h-4 text-red-600" />
                            <span className="font-bold text-red-700">{conVotes}</span>
                            <span className="text-xs text-red-600">{t('con')}</span>
                          </div>

                          <span className="text-xl text-slate-300">=</span>

                          {/* Delta */}
                          <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
                            <span className="font-bold text-blue-700">{delta}</span>
                            <span className="text-xs text-blue-600">{t('votesDelta')}</span>
                          </div>
                        </div>

                        {/* Consensus meter for this suggestion */}
                        <div className={`mt-4 bg-gradient-to-r rounded-lg p-4 ${isRTL ? 'from-purple-50 to-indigo-50' : 'from-indigo-50 to-purple-50'}`}>
                          <div className={`flex items-center justify-between mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <span className="text-sm font-medium text-indigo-800">{t('suggestionConsensusMeter')}</span>
                            <Badge className="bg-indigo-600 text-white">
                              {(suggestionConsensusMeter * 100).toFixed(0)}%
                            </Badge>
                          </div>
                          <div className={`h-2 bg-indigo-200 rounded-full overflow-hidden ${isRTL ? 'transform scale-x-[-1]' : ''}`}>
                            <div 
                              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, suggestionConsensusMeter * 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-indigo-600 mt-2 text-center">
                            {delta} ÷ {totalUsers} = {suggestionConsensusMeter.toFixed(2)} ({(suggestionConsensusMeter * 100).toFixed(0)}%)
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}

                {/* Average calculation summary */}
                <div className="mt-6 p-5 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-200">
                  <div className={`flex items-start gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <div className={isRTL ? 'text-right' : ''}>
                      <h4 className="font-bold text-indigo-900 text-lg">{t('averageCalculation')}</h4>
                      <p className="text-sm text-indigo-700 mt-1">
                        {t('avgConsensusResult', { 
                          count: acceptedSuggestions.length,
                          values: consensuses.map(c => (c * 100).toFixed(0) + '%').join(' + '),
                          avg: (documentConsensusMeter * 100).toFixed(0)
                        })}
                      </p>
                      <div className="mt-3 text-sm text-indigo-600">
                        ({consensuses.map(c => c.toFixed(2)).join(' + ')}) ÷ {consensuses.length} = {documentConsensusMeter.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}