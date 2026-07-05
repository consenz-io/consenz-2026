import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Users, TrendingUp, Globe, Lock } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function RecentDocumentsSection({ documents, documentsLoading }) {
  const { t, language } = useLanguage();

  const headingText = { he: 'מסמכים פעילים', ar: 'وثائق نشطة', en: 'Active Documents' };
  const subText = { he: 'צפו והשתתפו במסמכים שיתופיים פתוחים', ar: 'تصفح وساهم في الوثائق التعاونية المفتوحة', en: 'Browse and contribute to ongoing collaborative drafts' };
  const noDocsTitle = { he: 'אין מסמכים ציבוריים עדיין', ar: 'لا توجد وثائق عامة بعد', en: 'No public documents yet' };
  const publicLabel = { he: 'ציבורי', ar: 'عام', en: 'Public' };
  const privateLabel = { he: 'פרטי', ar: 'خاص', en: 'Private' };

  // Only show publicly-viewable documents, most recent first, capped at 9
  const publicDocs = useMemo(() => {
    return (documents || [])
      .filter(d => d.privacy === 'public_view_open_participation' || d.privacy === 'public_view_closed_participation')
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
      .slice(0, 9);
  }, [documents]);

  const consensusDisplay = (doc) => {
    const consensuses = doc.consensuses || [];
    if (!consensuses.length) return '0';
    const avg = consensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / consensuses.length;
    return (Math.min(100, avg * 100)).toFixed(0);
  };

  return (
    <section id="recent-documents-list" className="max-w-7xl mx-auto px-6 py-16" aria-labelledby="recent-docs-heading">
      <div className="mb-8">
        <h2 id="recent-docs-heading" className="text-3xl font-bold text-slate-900">
          {headingText[language] || headingText.en}
        </h2>
        <p className="text-slate-600 mt-2">{subText[language] || subText.en}</p>
      </div>

      {documentsLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="bg-white border-slate-200">
              <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
              <CardContent><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3 mt-2" /></CardContent>
            </Card>
          ))}
        </div>
      ) : publicDocs.length === 0 ? (
        <Card className="bg-white border-slate-200">
          <CardContent className="p-12 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-600">{noDocsTitle[language] || noDocsTitle.en}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {publicDocs.map(doc => {
            const isOpen = doc.privacy === 'public_view_open_participation';
            return (
              <Link
                key={doc.id}
                to={`${createPageUrl("DocumentView")}?id=${doc.id}`}
                aria-label={`${doc.title}. ${publicLabel[language]}`}
              >
                <Card className="bg-white border-slate-200 hover:shadow-lg hover:border-blue-300 transition-all duration-200 h-full">
                  <CardHeader className="border-b border-slate-100">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg line-clamp-2">{doc.title}</CardTitle>
                      <span className={`flex-shrink-0 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${isOpen ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {isOpen ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {publicLabel[language] || publicLabel.en}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    {doc.description && (
                      <p className="text-sm text-slate-600 line-clamp-2" dangerouslySetInnerHTML={{ __html: doc.description }} />
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-slate-400" />
                        <div className="text-sm">
                          <div className="font-semibold text-slate-700">{consensusDisplay(doc)}%</div>
                          <div className="text-xs text-slate-500">{t('consensus')}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-400" />
                        <div className="text-sm">
                          <div className="font-semibold text-slate-700">{doc.totalUsersInteracted || 0}</div>
                          <div className="text-xs text-slate-500">{t('contributors')}</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400">
                      {t('created')} {new Date(doc.created_date).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}