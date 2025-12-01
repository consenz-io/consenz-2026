import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, TrendingUp, ThumbsUp, ThumbsDown, ArrowLeft, ArrowRight, Info, CheckCircle2, Target, Calculator } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";
import PageHeader from "../components/PageHeader";

export default function UnderstandingConsensus() {
  const { t, isRTL, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('id');

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

  const acceptedSuggestions = suggestions.filter(s => s.status === 'accepted');
  const totalUsers = document?.totalUsersInteracted || 1;
  const consensuses = document?.consensuses || [];
  
  // Calculate average consensus
  const avgConsensus = consensuses.length > 0 
    ? consensuses.reduce((sum, val) => sum + val, 0) / consensuses.length 
    : 0;
  
  // Calculate threshold
  const threshold = consensuses.length > 0 
    ? Math.max(1, Math.round(avgConsensus * totalUsers))
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <PageHeader 
          title={t('understandingConsensusTitle')}
          backUrl={`${createPageUrl("DocumentView")}?id=${documentId}`}
        />

        {/* Hero Section - Current Threshold */}
        <Card className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-0 shadow-xl overflow-hidden">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-right flex-1">
                <p className="text-blue-100 text-sm md:text-base mb-2">{t('currentThresholdExplain')}</p>
                <h2 className="text-lg md:text-xl font-medium text-blue-50">{document.title}</h2>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-28 h-28 md:w-36 md:h-36 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-4 border-white/30">
                  <div className="text-center">
                    <div className="text-4xl md:text-5xl font-bold">{threshold}</div>
                    <div className="text-xs md:text-sm text-blue-100">{t('votesNeeded')}</div>
                  </div>
                </div>
              </div>
              <div className="text-center md:text-left flex-1">
                <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-2">
                  <Users className="w-5 h-5" />
                  <span className="font-semibold">{totalUsers}</span>
                  <span className="text-blue-100 text-sm">{t('participants')}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Explanation Card */}
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 md:p-6">
            <div className={`flex gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
              <Info className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900 mb-1">{t('howThresholdWorks')}</h3>
                <p className="text-amber-800 text-sm leading-relaxed">
                  {t('thresholdExplanation')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calculation Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Calculator className="w-5 h-5 text-blue-600" />
              {t('calculationBreakdown')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-slate-900">{(avgConsensus * 100).toFixed(0)}%</div>
                <div className="text-sm text-slate-600 mt-1">{t('avgConsensusMeter')}</div>
              </div>
              <div className="flex items-center justify-center text-2xl text-slate-400">×</div>
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-slate-900">{totalUsers}</div>
                <div className="text-sm text-slate-600 mt-1">{t('totalParticipants')}</div>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="text-2xl text-slate-400">=</div>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 text-center border-2 border-blue-200">
              <div className="text-4xl font-bold text-blue-700">{threshold}</div>
              <div className="text-sm text-blue-600 mt-1">{t('currentThreshold')}</div>
            </div>
          </CardContent>
        </Card>

        {/* Accepted Suggestions Timeline */}
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
                <p>{t('noAcceptedSuggestionsYet')}</p>
                <p className="text-sm mt-1">{t('defaultThresholdUsed')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {acceptedSuggestions.map((suggestion, index) => {
                  const proVotes = suggestion.proVotes || 0;
                  const conVotes = suggestion.conVotes || 0;
                  const delta = proVotes - conVotes;
                  const sectionConsensus = consensuses[index] || (delta / totalUsers);
                  const consensusPercent = (sectionConsensus * 100).toFixed(0);
                  
                  return (
                    <div 
                      key={suggestion.id}
                      className="relative bg-white rounded-xl border-2 border-slate-100 hover:border-blue-200 transition-all p-4 md:p-5"
                    >
                      {/* Order badge */}
                      <div className={`absolute -top-3 ${isRTL ? '-right-2' : '-left-2'} w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-lg`}>
                        {index + 1}
                      </div>
                      
                      <div className="space-y-4">
                        {/* Title */}
                        <div className={`${isRTL ? 'pr-6' : 'pl-6'}`}>
                          <h4 className="font-semibold text-slate-900">{suggestion.title}</h4>
                          <p className="text-xs text-slate-500 mt-1">
                            {new Date(suggestion.created_date).toLocaleDateString(
                              language === 'he' ? 'he-IL' : language === 'ar' ? 'ar-EG' : 'en-US'
                            )}
                          </p>
                        </div>

                        {/* Votes visualization */}
                        <div className="flex items-center gap-4">
                          {/* Pro votes */}
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                              <ThumbsUp className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                              <div className="text-lg font-bold text-green-700">{proVotes}</div>
                              <div className="text-xs text-slate-500">{t('pro')}</div>
                            </div>
                          </div>

                          {/* Minus sign */}
                          <div className="text-2xl text-slate-300 font-light">−</div>

                          {/* Con votes */}
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                              <ThumbsDown className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                              <div className="text-lg font-bold text-red-700">{conVotes}</div>
                              <div className="text-xs text-slate-500">{t('con')}</div>
                            </div>
                          </div>

                          {/* Equals sign */}
                          <div className="text-2xl text-slate-300 font-light">=</div>

                          {/* Delta */}
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-lg font-bold text-blue-700">{delta}</span>
                            </div>
                            <div className="text-xs text-slate-500">{t('votesDelta')}</div>
                          </div>
                        </div>

                        {/* Consensus meter for this suggestion */}
                        <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-lg p-3">
                          <div className={`flex items-center justify-between mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <span className="text-sm text-slate-600">{t('suggestionConsensusMeter')}</span>
                            <span className="font-bold text-blue-700">{consensusPercent}%</span>
                          </div>
                          <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(0, consensusPercent))}%` }}
                            />
                          </div>
                          <p className="text-xs text-slate-500 mt-2">
                            {t('calculatedAs')}: {delta} ÷ {totalUsers} = {sectionConsensus.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Summary */}
                <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
                  <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <TrendingUp className="w-6 h-6 text-green-600" />
                    <div>
                      <h4 className="font-semibold text-green-900">{t('averageOfAllSuggestions')}</h4>
                      <p className="text-sm text-green-700">
                        {t('avgConsensusCalculation', { 
                          count: acceptedSuggestions.length,
                          avg: (avgConsensus * 100).toFixed(0)
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* What this means */}
        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-0">
          <CardContent className="p-6 md:p-8">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Target className="w-6 h-6" />
              {t('whatThisMeans')}
            </h3>
            <p className="text-slate-300 leading-relaxed">
              {t('thresholdMeaning', { threshold })}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}