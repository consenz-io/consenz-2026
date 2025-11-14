import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header - Hidden on print */}
      <div className="bg-slate-50 border-b border-slate-200 p-4 print:hidden sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to={`${createPageUrl("DocumentView")}?id=${documentId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('document')}
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            הדפס
          </Button>
        </div>
      </div>

      {/* Document Content */}
      <div className="max-w-4xl mx-auto p-8 print:p-12">
        {/* Document Title */}
        <div className="mb-12 pb-8 border-b-2 border-slate-300">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            {document.title}
          </h1>
          <p className="text-slate-600">
            {new Date(document.created_date).toLocaleDateString('he-IL', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>

        {/* Topics and Sections */}
        <div className="space-y-12">
          {topics.length === 0 ? (
            <p className="text-slate-500 text-center py-8">{t('noTopicsYet')}</p>
          ) : (
            topics.map((topic, topicIndex) => {
              const topicSections = sections.filter(s => s.topicId === topic.id);
              
              return (
                <div key={topic.id} className="space-y-6 break-inside-avoid">
                  {/* Topic Title */}
                  <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-300 pb-2">
                    {topicIndex + 1}. {topic.title}
                  </h2>

                  {/* Sections */}
                  {topicSections.length === 0 ? (
                    <p className="text-slate-500 italic pr-4">{t('noSectionsYet')}</p>
                  ) : (
                    <div className="space-y-6">
                      {topicSections.map((section, sectionIndex) => (
                        <div key={section.id} className="break-inside-avoid">
                          <div className="flex gap-4">
                            <span className="text-slate-500 font-medium min-w-[2rem]">
                              {topicIndex + 1}.{sectionIndex + 1}
                            </span>
                            <div 
                              className="flex-1 text-slate-700 leading-relaxed prose prose-slate max-w-none"
                              dangerouslySetInnerHTML={{ __html: section.content }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-slate-300 text-center text-slate-500 text-sm">
          <p>מסמך זה נוצר באמצעות פלטפורמת Consenz</p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:p-12 {
            padding: 3rem !important;
          }
          @page {
            margin: 2cm;
          }
        }
      `}</style>
    </div>
  );
}