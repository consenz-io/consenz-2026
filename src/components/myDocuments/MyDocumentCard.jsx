import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Users, TrendingUp, Languages, Loader2, Bell } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { calculateContributorsFromData } from "@/components/document/calculateContributors";
import { base44 } from "@/api/base44Client";

export default function MyDocumentCard({ doc, mySuggestionsCount, myVotesCount, unvotedCount, allSuggestions, allVotes, allUsers, allComments, allSections }) {
  const { t, language } = useLanguage();
  const [translatedTitle, setTranslatedTitle] = useState(null);
  const [translating, setTranslating] = useState(false);

  const handleTranslate = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (translatedTitle) { setTranslatedTitle(null); return; }
    setTranslating(true);
    try {
      const targetLang = language === 'ar' ? 'Arabic' : language === 'he' ? 'Hebrew' : 'English';
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Translate the following text to ${targetLang}. Return ONLY the translation, nothing else:\n\n${doc.title}`,
      });
      setTranslatedTitle(typeof response === 'string' ? response : response?.content || response);
    } finally {
      setTranslating(false);
    }
  };

  const contributorsCount = calculateContributorsFromData({
    document: doc,
    suggestions: allSuggestions.filter(s => s.documentId === doc.id),
    allVotes,
    allUsers,
    allComments,
    sections: allSections.filter(s => s.documentId === doc.id),
  });

  const consensusDisplay = (() => {
    const consensuses = doc.consensuses || [];
    if (!consensuses.length) return '0';
    const avg = consensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / consensuses.length;
    return (Math.min(100, avg * 100)).toFixed(0);
  })();

  const unvotedLabel = {
    he: `יש ${unvotedCount} ${unvotedCount === 1 ? 'הצעה' : 'הצעות'} שטרם הצבעת עליהן`,
    ar: `${unvotedCount} اقتراح لم تصوت عليه بعد`,
    en: `${unvotedCount} suggestion${unvotedCount > 1 ? 's' : ''} awaiting your vote`,
  };

  return (
    <Card className={`bg-white/80 backdrop-blur-sm border-slate-200 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 h-full ${unvotedCount > 0 ? 'ring-2 ring-orange-400 ring-offset-2' : ''}`}>
      {unvotedCount > 0 && (
        <Link to={`${createPageUrl("DocumentView")}?id=${doc.id}`}>
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 text-sm font-medium flex items-center gap-2 hover:from-orange-600 hover:to-amber-600 transition-colors cursor-pointer">
            <Bell className="w-4 h-4 animate-pulse" />
            <span>{unvotedLabel[language] || unvotedLabel.en}</span>
          </div>
        </Link>
      )}
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-start justify-between gap-2">
          <Link to={`${createPageUrl("DocumentView")}?id=${doc.id}`} className="flex-1 cursor-pointer">
            <CardTitle className="text-xl line-clamp-2">
              {translatedTitle || doc.title}
            </CardTitle>
          </Link>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="h-8 w-8"
              onClick={handleTranslate}
              disabled={translating}
              aria-label={translating ? 'Translating...' : translatedTitle ? 'Show original' : 'Translate title'}
            >
              {translating
                ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                : <Languages className={`w-4 h-4 ${translatedTitle ? 'text-green-600' : 'text-slate-400'}`} />}
            </Button>
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <div className="text-sm">
              <div className="font-semibold text-slate-700">{contributorsCount}</div>
              <div className="text-xs text-slate-500">{t('contributors')}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            <div className="text-sm">
              <div className="font-semibold text-slate-700">{consensusDisplay}%</div>
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
}