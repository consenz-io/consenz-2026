import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Info, Scale, Gauge, Target, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";
import PageHeader from "../components/PageHeader";
import ConsensusGaugeAnimation from "@/components/document/ConsensusGaugeAnimation";
import AcceptedSuggestionsConsensusList from "@/components/document/AcceptedSuggestionsConsensusList";

export default function UnderstandingConsensus() {
  const { t, isRTL, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('id');
  const returnUrl = searchParams.get('returnUrl');

  const { data: document, isLoading: docLoading } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => base44.entities.Document.filter({ id: documentId }).then((docs) => docs[0]),
    enabled: !!documentId
  });

  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['suggestions', documentId],
    queryFn: () => base44.entities.Suggestion.filter({ documentId }, 'created_date'),
    initialData: [],
    enabled: !!documentId
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
      base44.entities.DocumentAgreement.filter({ documentId })]
      );
      const contributorEmails = new Set();
      const suggestionIds = new Set(docSuggestions.map((s) => s.id));
      const sectionIds = new Set(docSections.map((s) => s.id));
      allVotesRaw.forEach((v) => {
        if (suggestionIds.has(v.suggestionId)) {
          if (v.created_by) contributorEmails.add(v.created_by);
          const profile = publicProfilesRaw.find((p) => p.userId === v.userId);
          if (profile?.email) contributorEmails.add(profile.email);
        }
      });
      allCommentsRaw.forEach((c) => {
        if (!c.created_by) return;
        if (c.rootEntityType === 'suggestion' && suggestionIds.has(c.rootEntityId)) contributorEmails.add(c.created_by);
        if (c.rootEntityType === 'section' && sectionIds.has(c.rootEntityId)) contributorEmails.add(c.created_by);
        if (c.rootEntityType === 'document' && c.rootEntityId === documentId) contributorEmails.add(c.created_by);
      });
      allAgreementsRaw.forEach((a) => {if (a.userEmail) contributorEmails.add(a.userEmail);});
      const contributorsMap = new Map();
      publicProfilesRaw.forEach((profile) => {
        if (contributorEmails.has(profile.email) && profile.userId) {
          contributorsMap.set(profile.userId, true);
        }
      });
      return contributorsMap.size;
    },
    enabled: !!documentId,
    staleTime: Infinity
  });

  const consensuses = document?.consensuses || [];

  // Find participants count at the time the last suggestion was accepted.
  // This value is the comprehensive backend snapshot (includes section-vote
  // voters, suggestion creators, commenters and agreement signers) stored on
  // the suggestion at acceptance time.
  const acceptedSuggestions = (suggestions || []).filter((s) => s.status === 'accepted' && s.participantsAtAcceptance);
  const lastAcceptedSuggestion = acceptedSuggestions.sort((a, b) =>
    new Date(b.acceptedAt || b.updated_date || b.created_date) - new Date(a.acceptedAt || a.updated_date || a.created_date)
  )[0];
  const participantsAtLastAcceptance = lastAcceptedSuggestion?.participantsAtAcceptance || 0;

  // Current total participants. The live client count (contributorsCount) only
  // tallies suggestion-voters, commenters and agreement-signers — it misses
  // section-vote voters and suggestion creators, so it can undercount vs. the
  // comprehensive snapshot stored at acceptance. Participants never shrink, so
  // clamp the current count to the high-water mark from the last acceptance.
  const totalUsers = Math.max(contributorsCount || 0, participantsAtLastAcceptance, 1);

  // Participants used to compute the stored threshold — always in sync with
  // document.threshold since both are set in the same update call. Falls back
  // to totalUsersInteracted (which is set in the same call) for legacy docs
  // that predate the participantsAtThreshold field.
  const participantsForFormula = document?.participantsAtThreshold || document?.totalUsersInteracted || totalUsers;

  // מד הקונצנזוס הממוצע - ערך בין 0 ל-1 (מוגבל למקסימום 1)
  const documentConsensusMeter = consensuses.length > 0 ?
  Math.min(1, consensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / consensuses.length) :
  0;

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
      </div>);

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
      </div>);

  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className={`max-w-4xl mx-auto space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}>
        <PageHeader
          title={t('understandingConsensusTitle')}
          backUrl={returnUrl || `${createPageUrl("DocumentView")}?id=${documentId}`} />
        

        {/* Animated consensus gauge */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-indigo-50/50">
          <CardContent className="p-2 md:p-4">
            <ConsensusGaugeAnimation value={documentConsensusMeter} documentTitle={document?.title} />
          </CardContent>
        </Card>

        {/* Hero Section - הסבר ויזואלי על החישוב */}
        <Card className="border-0 shadow-xl overflow-hidden">
          <CardContent className="p-0">
            <div className={`grid grid-cols-1 md:grid-cols-3`} dir={isRTL ? 'rtl' : 'ltr'}>

              {/* עמודה 1: מד הקונצנזוס */}
              
















              

              {/* סמל × - מובייל */}
              



              

              {/* עמודה 2: משתתפים בעת הקבלה האחרונה */}
              

















              

              {/* סמל = - מובייל */}
              



              

              {/* עמודה 3: רף התמיכה - התוצאה */}
              

















              

            </div>
          </CardContent>
        </Card>

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
            



            
          </CardContent>
        </Card>

        {/* נוסחת החישוב */}
        <Card>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 text-lg w-full ${isRTL ? 'justify-start' : 'justify-start'}`}>
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
                  <div className="text-2xl font-bold text-blue-700">{participantsForFormula}</div>
                  <div className="text-xs text-slate-500 mt-1">{language === 'he' ? 'משתתפים בעת הקבלה' : language === 'ar' ? 'المشاركون عند القبول' : 'Participants at acceptance'}</div>
                </div>
                <div className="text-3xl text-slate-400 font-light">=</div>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 shadow-sm border-2 border-green-300 min-w-[140px]">
                  <div className="text-2xl font-bold text-green-700">{threshold}</div>
                  <div className="text-xs text-slate-500 mt-1">{t('supportThresholdLabel')}</div>
                </div>
              </div>
              <p className="text-center text-sm text-slate-500 mt-4">
                {language === 'he' ? 'הסף הנוכחי חושב בעת קבלת ההצעה האחרונה — מספר המשתתפים כפי שהיה באותו הרגע' : language === 'ar' ? 'تم حساب الحد الحالي عند قبول الاقتراح الأخير — عدد المشاركين في تلك اللحظة' : 'Current threshold was calculated when the last suggestion was accepted — participants count at that moment'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* רשימת הצעות שהתקבלו עם חישוב הקונצנזוס */}
        <Card>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 text-lg w-full ${isRTL ? 'justify-start' : 'justify-start'}`}>
              <CheckCircle className="w-5 h-5 text-green-600" />
              {language === 'he' ? 'היסטוריית הצעות שהתקבלו וחישוב הקונצנזוס' : language === 'ar' ? 'سجل الاقتراحات المقبولة وحساب الإجماع' : 'Accepted Suggestions History & Consensus Calculation'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AcceptedSuggestionsConsensusList
              suggestions={suggestions}
              consensuses={consensuses}
              currentMeter={documentConsensusMeter} />
            
          </CardContent>
        </Card>

      </div>
    </div>);

}