import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Globe, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";

export default function DocumentCleanView() {
  const { t, isRTL, language } = useLanguage();
  const queryClient = useQueryClient();
  const [translatedSections, setTranslatedSections] = useState({});
  const [translatedTopics, setTranslatedTopics] = useState({});
  const [translatedDocTitle, setTranslatedDocTitle] = useState(null);
  const [showTranslatedDoc, setShowTranslatedDoc] = useState(false);
  const [showTranslatedTopics, setShowTranslatedTopics] = useState({});
  const [showTranslatedSections, setShowTranslatedSections] = useState({});
  const [translatingAll, setTranslatingAll] = useState(false);
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

  const translateTextMutation = useMutation({
    mutationFn: async ({ text, targetLanguage, isHtml = false }) => {
      const languageNames = { en: 'English', he: 'Hebrew', ar: 'Arabic' };
      const targetLangName = languageNames[targetLanguage];

      let prompt;
      if (isHtml) {
        prompt = `You are a professional translator. Translate the following HTML content to ${targetLangName}.

CRITICAL INSTRUCTIONS:
- Keep ALL HTML tags exactly as they are (including <p>, <strong>, <em>, <ul>, <li>, etc.)
- Only translate the TEXT CONTENT between the tags
- Return ONLY the translated HTML, nothing else
- Do not add any explanations or comments
- Do not escape HTML characters
- Maintain exact same structure and formatting

HTML content to translate:
${text}

Return ONLY the translated HTML:`;
      } else {
        prompt = `Translate the following text to ${targetLangName}. Return ONLY the translated text, nothing else:

${text}`;
      }

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
      });

      let translatedContent = typeof result === 'string' ? result : result.content || result;
      
      // Clean up any markdown code blocks that might be added
      translatedContent = translatedContent.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

      return translatedContent;
    },
  });

  const translateSectionMutation = useMutation({
    mutationFn: async ({ section, targetLanguage }) => {
      const translatedContent = await translateTextMutation.mutateAsync({ 
        text: section.content, 
        targetLanguage, 
        isHtml: true 
      });

      // Update section with translation
      const updatedTranslations = { ...section.translations, [targetLanguage]: translatedContent };
      await base44.entities.Section.update(section.id, {
        translations: updatedTranslations
      });

      return { sectionId: section.id, translatedContent };
    },
    onSuccess: (data) => {
      setTranslatedSections(prev => ({
        ...prev,
        [data.sectionId]: data.translatedContent
      }));
      queryClient.invalidateQueries({ queryKey: ['sections', documentId] });
    },
  });

  const translateAllSections = async () => {
    setTranslatingAll(true);
    
    // Translate document title
    if (document.originalLanguage && document.originalLanguage !== language) {
      if (!document.translations?.[language]) {
        const translatedTitle = await translateTextMutation.mutateAsync({ 
          text: document.title, 
          targetLanguage: language, 
          isHtml: false 
        });
        const updatedTranslations = { ...document.translations, [language]: translatedTitle };
        await base44.entities.Document.update(document.id, {
          translations: updatedTranslations
        });
        setTranslatedDocTitle(translatedTitle);
      } else {
        setTranslatedDocTitle(document.translations[language]);
      }
      setShowTranslatedDoc(true);
    }

    // Translate topics
    const newShowTranslatedTopics = {};
    for (const topic of topics) {
      if (topic.originalLanguage && topic.originalLanguage !== language) {
        if (!topic.translations?.[language]) {
          const translatedTitle = await translateTextMutation.mutateAsync({ 
            text: topic.title, 
            targetLanguage: language, 
            isHtml: false 
          });
          const updatedTranslations = { ...topic.translations, [language]: translatedTitle };
          await base44.entities.Topic.update(topic.id, {
            translations: updatedTranslations
          });
          setTranslatedTopics(prev => ({
            ...prev,
            [topic.id]: translatedTitle
          }));
        } else {
          setTranslatedTopics(prev => ({
            ...prev,
            [topic.id]: topic.translations[language]
          }));
        }
        newShowTranslatedTopics[topic.id] = true;
      }
    }
    setShowTranslatedTopics(newShowTranslatedTopics);

    // Translate sections
    const newShowTranslatedSections = {};
    for (const section of sections) {
      if (section.originalLanguage !== language) {
        if (!section.translations?.[language]) {
          await translateSectionMutation.mutateAsync({ section, targetLanguage: language });
        } else {
          setTranslatedSections(prev => ({
            ...prev,
            [section.id]: section.translations[language]
          }));
        }
        newShowTranslatedSections[section.id] = true;
      }
    }
    setShowTranslatedSections(newShowTranslatedSections);
    
    setTranslatingAll(false);
  };

  const needsTranslation = sections.some(s => s.originalLanguage !== language) || 
    topics.some(t => t.originalLanguage && t.originalLanguage !== language) ||
    (document.originalLanguage && document.originalLanguage !== language);
    
  const allTranslated = sections.every(s => 
    s.originalLanguage === language || translatedSections[s.id] || s.translations?.[language]
  ) && topics.every(t => 
    !t.originalLanguage || t.originalLanguage === language || translatedTopics[t.id] || t.translations?.[language]
  ) && (!document.originalLanguage || document.originalLanguage === language || translatedDocTitle || document.translations?.[language]);

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
          <div className="flex items-center gap-2">
            {needsTranslation && !allTranslated && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={translateAllSections}
                disabled={translatingAll}
              >
                {translatingAll ? (
                  <>
                    <Loader2 className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'} animate-spin`} />
                    {t('translating')}
                  </>
                ) : (
                  <>
                    <Globe className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('translateAll')}
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {language === 'en' ? 'Print' : language === 'ar' ? 'طباعة' : 'הדפס'}
            </Button>
          </div>
        </div>
      </div>

      {/* Document Content */}
      <div className="max-w-4xl mx-auto p-8 print:p-12">
        {/* Document Title */}
        <div className="mb-12 pb-8 border-b-2 border-slate-300">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            {document.originalLanguage && document.originalLanguage !== language && showTranslatedDoc
              ? (translatedDocTitle || document.translations?.[language] || document.title)
              : document.title}
          </h1>
          {document.originalLanguage && document.originalLanguage !== language && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-blue-600 hover:text-blue-700 mb-2 print:hidden"
              onClick={async () => {
                if (!translatedDocTitle && !document.translations?.[language]) {
                  const translatedTitle = await translateTextMutation.mutateAsync({ 
                    text: document.title, 
                    targetLanguage: language, 
                    isHtml: false 
                  });
                  const updatedTranslations = { ...document.translations, [language]: translatedTitle };
                  await base44.entities.Document.update(document.id, {
                    translations: updatedTranslations
                  });
                  setTranslatedDocTitle(translatedTitle);
                  setShowTranslatedDoc(true);
                } else {
                  setShowTranslatedDoc(!showTranslatedDoc);
                }
              }}
            >
              <Globe className="w-3 h-3 mr-1" />
              {showTranslatedDoc ? 'הצג מקור' : t('translateSection')}
            </Button>
          )}
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
                  <div className="border-b border-slate-300 pb-2 mb-6">
                    <h2 className="text-2xl font-bold text-slate-800">
                      {topicIndex + 1}. {topic.originalLanguage && topic.originalLanguage !== language && showTranslatedTopics[topic.id]
                        ? (translatedTopics[topic.id] || topic.translations?.[language] || topic.title)
                        : topic.title}
                    </h2>
                    {topic.originalLanguage && topic.originalLanguage !== language && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-blue-600 hover:text-blue-700 mt-1 print:hidden"
                        onClick={async () => {
                          if (!translatedTopics[topic.id] && !topic.translations?.[language]) {
                            const translatedTitle = await translateTextMutation.mutateAsync({ 
                              text: topic.title, 
                              targetLanguage: language, 
                              isHtml: false 
                            });
                            const updatedTranslations = { ...topic.translations, [language]: translatedTitle };
                            await base44.entities.Topic.update(topic.id, {
                              translations: updatedTranslations
                            });
                            setTranslatedTopics(prev => ({
                              ...prev,
                              [topic.id]: translatedTitle
                            }));
                            setShowTranslatedTopics(prev => ({
                              ...prev,
                              [topic.id]: true
                            }));
                          } else {
                            setShowTranslatedTopics(prev => ({
                              ...prev,
                              [topic.id]: !prev[topic.id]
                            }));
                          }
                        }}
                      >
                        <Globe className="w-3 h-3 mr-1" />
                        {showTranslatedTopics[topic.id] ? 'הצג מקור' : t('translateSection')}
                      </Button>
                    )}
                  </div>

                  {/* Sections */}
                  {topicSections.length === 0 ? (
                    <p className="text-slate-500 italic pr-4">{t('noSectionsYet')}</p>
                  ) : (
                    <div className="space-y-6">
                      {topicSections.map((section, sectionIndex) => {
                        const needsTranslation = section.originalLanguage !== language;
                        const hasTranslation = translatedSections[section.id] || section.translations?.[language];
                        const displayContent = needsTranslation && hasTranslation && showTranslatedSections[section.id]
                          ? (translatedSections[section.id] || section.translations[language])
                          : section.content;

                        return (
                          <div key={section.id} className="break-inside-avoid">
                            <div className="flex gap-4 group">
                              <span className="text-slate-500 font-medium min-w-[2rem]">
                                {topicIndex + 1}.{sectionIndex + 1}
                              </span>
                              <div className="flex-1">
                                <div 
                                  className="text-slate-700 leading-relaxed prose prose-slate max-w-none"
                                  dangerouslySetInnerHTML={{ __html: displayContent }}
                                />
                                {needsTranslation && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="mt-2 text-blue-600 hover:text-blue-700 print:hidden opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={async () => {
                                      if (!hasTranslation) {
                                        await translateSectionMutation.mutateAsync({ section, targetLanguage: language });
                                        setShowTranslatedSections(prev => ({
                                          ...prev,
                                          [section.id]: true
                                        }));
                                      } else {
                                        setShowTranslatedSections(prev => ({
                                          ...prev,
                                          [section.id]: !prev[section.id]
                                        }));
                                      }
                                    }}
                                    disabled={translateSectionMutation.isPending}
                                  >
                                    {translateSectionMutation.isPending ? (
                                      <>
                                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                        {t('translating')}
                                      </>
                                    ) : (
                                      <>
                                        <Globe className="w-3 h-3 mr-1" />
                                        {showTranslatedSections[section.id] ? 'הצג מקור' : t('translateSection')}
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
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