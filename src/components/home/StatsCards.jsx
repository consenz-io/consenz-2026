import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, TrendingUp, Users, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function StatsCards({ documentsCount, displayedUsers, publicProfilesLoading, averageConsensus, onContributorsClick, onDocumentsClick }) {
  const { t, language } = useLanguage();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
      {/* Active Documents */}
      <button
        type="button"
        className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all w-full text-left"
        onClick={onDocumentsClick}
        aria-label={`${documentsCount} ${t('activeDocuments')}. ${language === 'he' ? 'לחץ לגלילה למסמכים' : 'Click to scroll to documents'}`}
      >
        <div className="p-6 text-center">
          <FileText className="w-8 h-8 mx-auto mb-3 text-blue-600" aria-hidden="true" />
          <div className="text-3xl font-bold text-slate-900">{documentsCount}</div>
          <div className="text-sm text-slate-600">{t('activeDocuments')}</div>
        </div>
      </button>

      {/* Collaborators */}
      <button
        type="button"
        className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg cursor-pointer hover:shadow-lg hover:border-indigo-300 transition-all w-full text-left"
        onClick={onContributorsClick}
        aria-label={`${displayedUsers.length} ${t('collaborators')}. ${language === 'he' ? 'לחץ לצפייה ברשימה מלאה' : 'Click to view full list'}`}
      >
        <div className="p-6 text-center">
          <Users className="w-8 h-8 mx-auto mb-3 text-indigo-600" aria-hidden="true" />
          <div className="text-3xl font-bold text-slate-900 flex items-center justify-center min-h-[2.25rem]">
            {publicProfilesLoading
              ? <Loader2 className="w-8 h-8 animate-spin text-indigo-400" aria-label={language === 'he' ? 'טוען...' : 'Loading...'} />
              : displayedUsers.length}
          </div>
          <div className="text-sm text-slate-600">{t('collaborators')}</div>
        </div>
      </button>

      {/* Average Consensus */}
      <Link to={`${createPageUrl("LearnMore")}#consensus-calculation`}>
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200 cursor-pointer hover:shadow-lg hover:border-purple-300 transition-all">
          <CardContent className="p-6 text-center">
            <TrendingUp className="w-8 h-8 mx-auto mb-3 text-purple-600" />
            <div className="text-3xl font-bold text-slate-900">{averageConsensus}%</div>
            <div className="text-sm text-slate-600">{t('avgConsensus')}</div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}