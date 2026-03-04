import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Info, Scale, Gauge, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";
import PageHeader from "../components/PageHeader";

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

  // Reuse contributorsCount from DocumentView cache (same query key), fallback to fresh fetch
  const { data: contributorsCount } = useQuery({
    queryKey: ['contributorsCount', documentId],
    queryFn: async () => {
      const [docSuggestions, docSections, allVotesRaw, publicProfilesRaw, allCommentsRaw, allAgreementsRaw] = await Promise.all([
        base44.entities.Suggestion.filter({ documentId }),
        base44.entities.Section.filter({ documentId }),
        base44.entities.Vote.list(),
        base44.entities.UserPublicProfile.list(),
        base44.entities.Comment.list(),
        base44.entities.DocumentAgreement.filter({ documentId }),
      ]);
      const contributorEmails = new Set();
      const suggestionIds = new Set(docSuggestions.map(s => s.id));
      const sectionIds = new Set(docSections.map(s => s.id));
      allVotesRaw.forEach(v => {
        if (suggestionIds.has(v.suggestionId)) {
          if (v.created_by) contributorEmails.add(v.created_by);
          const profile = publicProfilesRaw.find(p => p.userId === v.userId);
          if (profile?.email) contributorEmails.add(profile.email);
        }
      });
      allCommentsRaw.forEach(c => {
        if (!c.created_by) return;
        if (c.rootEntityType === 'suggestion' && suggestionIds.has(c.rootEntityId)) contributorEmails.add(c.created_by);
        if (c.rootEntityType === 'section' && sectionIds.has(c.rootEntityId)) contributorEmails.add(c.created_by);
        if (c.rootEntityType === 'document' && c.rootEntityId === documentId) contributorEmails.add(c.created_by);
      });
      allAgreementsRaw.forEach(a => { if (a.userEmail) contributorEmails.add(a.userEmail); });
      const contributorsMap = new Map();
      publicProfilesRaw.forEach(profile => {
        if (contributorEmails.has(profile.email) && profile.userId) {
          contributorsMap.set(profile.userId, true);
        }
      });
      return contributorsMap.size;
    },
    enabled: !!documentId,
    staleTime: Infinity,
  });

  const totalUsers = contributorsCount || 1;
  const consensuses = document?.consensuses || [];
  
  // מד הקונצנזוס הממוצע - ערך בין 0 ל-1 (מוגבל למקסימום 1)
  const documentConsensusMeter = consensuses.length > 0 
    ? Math.min(1, consensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / consensuses.length)
    : 0;
  
  // ה-threshold הקבוע מהמסמך - לא מחשבים אותו מחדש!
  // הוא מתעדכן רק כשהצעה מתקבלת
  const threshold = Math.max(2, document?.threshold || 2);

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
            <div className={`flex gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
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
          <CardContent className="p-6 md:p-8">
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
            <CardTitle className={`flex items-center gap-2 text-lg ${isRTL ? 'flex-row-reverse' : ''}`}>
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
                {language === 'he' ? 'הסף הנוכחי חושב בעת קבלת ההצעה האחרונה' : 'Current threshold calculated when last suggestion was accepted'}
              </p>
            </div>
          </CardContent>
        </Card>


      </div>
    </div>
  );
}