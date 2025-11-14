import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";

export default function DocumentCleanView() {
  const { t, isRTL } = useLanguage();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('id');

  const { data: document, isLoading: docLoading } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => base44.entities.Document.filter({ id: documentId }).then(docs => docs[0]),
    enabled: !!documentId,
  });

  const { data: topics, isLoading: topicsLoading } = useQuery({
    queryKey: ['topics', documentId],
    queryFn: () => base44.entities.Topic.filter({ documentId }, 'order'),
    initialData: [],
    enabled: !!documentId,
  });

  const { data: sections, isLoading: sectionsLoading } = useQuery({
    queryKey: ['sections', documentId],
    queryFn: () => base44.entities.Section.filter({ documentId }, 'order'),
    initialData: [],
    enabled: !!documentId,
  });

  if (docLoading || topicsLoading || sectionsLoading) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-4xl mx-auto text-center py-20">
          <h1 className="text-2xl font-bold text-slate-900">{t('documentNotFound')}</h1>
          <Link to={createPageUrl("Home")}>
            <Button className="mt-4">{t('goHome')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const getSectionsForTopic = (topicId) => {
    return sections.filter(s => s.topicId === topicId).sort((a, b) => a.order - b.order);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto p-8 md:p-12">
        {/* Header */}
        <div className="mb-8 pb-6 border-b-2 border-slate-200">
          <Link to={`${createPageUrl("DocumentView")}?id=${documentId}`}>
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('document')}
            </Button>
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-8 h-8 text-slate-700" />
            <h1 className="text-4xl font-serif font-bold text-slate-900">{document.title}</h1>
          </div>
          <p className="text-sm text-slate-500 mt-2">
            {new Date(document.updated_date).toLocaleDateString(isRTL ? 'he-IL' : 'en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        {/* Content */}
        <div className="space-y-12">
          {topics.map((topic) => {
            const topicSections = getSectionsForTopic(topic.id);
            
            if (topicSections.length === 0) return null;

            return (
              <div key={topic.id} className="space-y-6">
                <h2 className="text-2xl font-serif font-bold text-slate-900 border-b border-slate-200 pb-2">
                  {topic.title}
                </h2>
                
                <div className="space-y-6">
                  {topicSections.map((section, index) => (
                    <div key={section.id} className="space-y-2">
                      <div className="text-sm font-medium text-slate-500">
                        {topic.title} - סעיף {index + 1}
                      </div>
                      <div 
                        className="prose prose-lg max-w-none text-slate-800 leading-relaxed"
                        style={{ 
                          direction: isRTL ? 'rtl' : 'ltr', 
                          textAlign: isRTL ? 'right' : 'left',
                          fontFamily: 'serif'
                        }}
                        dangerouslySetInnerHTML={{ __html: section.content }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t-2 border-slate-200 text-center text-sm text-slate-500">
          <p>נוצר באמצעות Consenz - פלטפורמת שיתוף פעולה דמוקרטי</p>
        </div>
      </div>
    </div>
  );
}