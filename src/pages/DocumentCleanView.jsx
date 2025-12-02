import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Globe, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/LanguageContext";
import InlineDiff from "@/components/document/InlineDiff";
import PageHeader from "@/components/PageHeader";

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
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0);
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

  const { data: allVersions, isLoading: versionsLoading } = useQuery({
    queryKey: ['allVersions', documentId],
    queryFn: () => base44.entities.DocumentVersion.filter({ documentId }, '-version'),
    initialData: [],
    enabled: !!documentId,
  });

  const { data: topicEditSuggestions } = useQuery({
    queryKey: ['topicEditSuggestions', documentId],
    queryFn: () => base44.entities.TopicEditSuggestion.filter({ documentId, status: 'accepted' }, 'created_date'),
    initialData: [],
    enabled: !!documentId,
  });

  // Get topic title as it was at a specific version
  const getTopicTitleAtVersion = (topicId, versionIndex) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return '';
    
    if (versionIndex === 0) {
      // Current version - return current title
      return topic.title;
    }
    
    // Get timestamp of the displayed version
    const displayedVersion = versionGroups[versionIndex];
    if (!displayedVersion || !displayedVersion.sections || displayedVersion.sections.length === 0) {
      return topic.title;
    }
    
    const versionTimestamp = new Date(displayedVersion.sections[0].created_date).getTime();
    
    // Get all accepted suggestions for this topic that occurred before or at this timestamp
    const relevantSuggestions = topicEditSuggestions
      .filter(s => s.topicId === topicId && new Date(s.created_date).getTime() <= versionTimestamp)
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    
    // Return the newTitle of the latest relevant suggestion, or the first originalTitle if no suggestions yet
    if (relevantSuggestions.length === 0) {
      // Check if there are any suggestions at all for this topic
      const allSuggestionsForTopic = topicEditSuggestions.filter(s => s.topicId === topicId);
      if (allSuggestionsForTopic.length > 0) {
        // Return the originalTitle from the first suggestion (the very first title)
        return allSuggestionsForTopic[0].originalTitle;
      }
      return topic.title;
    }
    
    return relevantSuggestions[relevantSuggestions.length - 1].newTitle;
  };

  // קבוצת גרסאות לפי גרסה (כך שכל גרסה תכיל את כל הסעיפים שלה)
  const versionGroups = React.useMemo(() => {
    if (!allVersions.length) return [];
    
    const groups = {};
    allVersions.forEach(v => {
      if (!groups[v.version]) {
        groups[v.version] = [];
      }
      // טיפול בכפילויות - שומרים רק את הגרסה האחרונה (לפי תאריך יצירה)
      const existing = groups[v.version].find(existing => existing.sectionId === v.sectionId);
      if (!existing) {
        groups[v.version].push(v);
      } else {
        // אם כבר יש גרסה לסעיף הזה, שומרים את החדשה יותר
        const existingDate = new Date(existing.created_date);
        const newDate = new Date(v.created_date);
        if (newDate > existingDate) {
          const index = groups[v.version].indexOf(existing);
          groups[v.version][index] = v;
        }
      }
    });
    
    // מיון הגרסאות בסדר יורד (החדשה ביותר קודם)
    const sortedVersions = Object.keys(groups)
      .map(Number)
      .sort((a, b) => b - a)
      .map(versionNum => ({
        version: versionNum,
        sections: groups[versionNum]
      }));
    
    return sortedVersions;
  }, [allVersions]);

  const currentVersion = versionGroups[currentVersionIndex];
  const previousVersion = versionGroups[currentVersionIndex + 1];

  // גלילה אוטומטית לסעיף שהשתנה
  React.useEffect(() => {
    if (currentVersionIndex > 0 && currentVersion && previousVersion && currentVersion.sections && previousVersion.sections) {
      setTimeout(() => {
        // מציאת הסעיף הראשון שהשתנה
        const changedSection = currentVersion.sections.find(currSection => {
          if (!currSection || !currSection.sectionId) return false;
          const prevSection = previousVersion.sections.find(ps => ps && ps.sectionId === currSection.sectionId);
          return prevSection && currSection.content !== prevSection.content;
        });

        if (changedSection && changedSection.sectionId) {
          const element = window.document.getElementById(`section-${changedSection.sectionId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2', 'rounded-lg');
            setTimeout(() => {
              element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2', 'rounded-lg');
            }, 2000);
          }
        }
      }, 100);
    }
  }, [currentVersionIndex, currentVersion, previousVersion]);

  if (docLoading || topicsLoading || sectionsLoading || versionsLoading) {
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
    
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    try {
      // Translate document title
      const docOriginalLang = document.originalLanguage || 'he';
      if (docOriginalLang !== language) {
        if (!document.translations?.[language]) {
          const translatedTitle = await translateTextMutation.mutateAsync({ 
            text: document.title, 
            targetLanguage: language, 
            isHtml: false 
          });
          const updatedTranslations = { ...document.translations, [language]: translatedTitle };
          await base44.entities.Document.update(document.id, {
            translations: updatedTranslations,
            originalLanguage: docOriginalLang
          });
          setTranslatedDocTitle(translatedTitle);
          await delay(1000);
        } else {
          setTranslatedDocTitle(document.translations[language]);
        }
        setShowTranslatedDoc(true);
      }

      // Translate topics
      const newShowTranslatedTopics = {};
      for (const topic of topics) {
        const topicOriginalLang = topic.originalLanguage || 'he';
        if (topicOriginalLang !== language) {
          if (!topic.translations?.[language]) {
            const translatedTitle = await translateTextMutation.mutateAsync({ 
              text: topic.title, 
              targetLanguage: language, 
              isHtml: false 
            });
            const updatedTranslations = { ...topic.translations, [language]: translatedTitle };
            await base44.entities.Topic.update(topic.id, {
              translations: updatedTranslations,
              originalLanguage: topicOriginalLang
            });
            setTranslatedTopics(prev => ({
              ...prev,
              [topic.id]: translatedTitle
            }));
            await delay(1000);
          } else {
            setTranslatedTopics(prev => ({
              ...prev,
              [topic.id]: typeof topic.translations[language] === 'string' ? topic.translations[language] : topic.translations[language]?.title
            }));
          }
          newShowTranslatedTopics[topic.id] = true;
        }
      }
      setShowTranslatedTopics(newShowTranslatedTopics);

      // Translate sections
      const newShowTranslatedSections = {};
      for (const section of sections) {
        const sectionOriginalLang = section.originalLanguage || 'he';
        if (sectionOriginalLang !== language) {
          if (!section.translations?.[language]) {
            await translateSectionMutation.mutateAsync({ section, targetLanguage: language });
            await delay(1000);
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
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setTranslatingAll(false);
    }
  };

  const needsTranslation = sections.some(s => (s.originalLanguage || 'he') !== language) || 
    topics.some(t => (t.originalLanguage || 'he') !== language) ||
    ((document.originalLanguage || 'he') !== language);
    
  const allTranslated = sections.every(s => 
    (s.originalLanguage || 'he') === language || translatedSections[s.id] || s.translations?.[language]
  ) && topics.every(t => 
    (t.originalLanguage || 'he') === language || translatedTopics[t.id] || t.translations?.[language]
  ) && ((document.originalLanguage || 'he') === language || translatedDocTitle || document.translations?.[language]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header - Hidden on print */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 md:p-4 print:hidden sticky top-0 z-10">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <PageHeader 
              title={(document.originalLanguage || 'he') !== language && showTranslatedDoc
                ? (translatedDocTitle || (typeof document.translations?.[language] === 'string' ? document.translations[language] : document.translations?.[language]?.title) || document.title)
                : document.title}
              backUrl={`${createPageUrl("DocumentView")}?id=${documentId}`}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {versionGroups.length > 1 && (
              <div className="flex items-center gap-2 border-l border-slate-300 pl-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentVersionIndex(Math.min(currentVersionIndex + 1, versionGroups.length - 1))}
                  disabled={currentVersionIndex >= versionGroups.length - 1}
                >
                  {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </Button>
                <Badge variant="outline" className="px-2 md:px-3 text-xs">
                  {currentVersionIndex === 0 ? (
                    language === 'he' ? 'נוכחית' : language === 'ar' ? 'حالية' : 'Current'
                  ) : (
                    `${language === 'he' ? 'ג׳' : language === 'ar' ? 'إ' : 'V'} ${currentVersion?.version || 0}`
                  )}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentVersionIndex(Math.max(0, currentVersionIndex - 1))}
                  disabled={currentVersionIndex === 0}
                >
                  {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </Button>
              </div>
            )}

            <Button variant="outline" size="sm" onClick={handlePrint} className="hidden md:flex">
              <Printer className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {language === 'en' ? 'Print' : language === 'ar' ? 'طباعة' : 'הדפס'}
            </Button>
          </div>
        </div>
      </div>

      {/* Document Content */}
      <div className="max-w-4xl mx-auto p-4 md:p-8 print:p-12">
        {/* Topics and Sections */}
        <div className="space-y-8 md:space-y-12">
          {topics.length === 0 ? (
            <p className="text-slate-500 text-center py-8">{t('noTopicsYet')}</p>
          ) : (
            topics.map((topic, topicIndex) => {
              const topicSections = sections.filter(s => s.topicId === topic.id);
              
              return (
                <div key={topic.id} className="space-y-4 md:space-y-6 break-inside-avoid">
                  {/* Topic Title */}
                  <div className="border-b border-slate-300 pb-2 mb-4 md:mb-6">
                    <h2 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight">
                      {topicIndex + 1}. {(topic.originalLanguage || 'he') !== language && showTranslatedTopics[topic.id]
                        ? (translatedTopics[topic.id] || (typeof topic.translations?.[language] === 'string' ? topic.translations[language] : topic.translations?.[language]?.title) || getTopicTitleAtVersion(topic.id, currentVersionIndex))
                        : getTopicTitleAtVersion(topic.id, currentVersionIndex)}
                    </h2>
                    {(topic.originalLanguage || 'he') !== language && (
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
                              translations: updatedTranslations,
                              originalLanguage: topic.originalLanguage || 'he'
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
                    <p className="text-slate-500 italic pr-2 md:pr-4">{t('noSectionsYet')}</p>
                  ) : (
                    <div className="space-y-4 md:space-y-6">
                      {topicSections.map((section, sectionIndex) => {


                        // מציאת תוכן הסעיף בגרסה המוצגת ובגרסה החדשה יותר
                        const isViewingHistory = currentVersionIndex > 0;
                        let displayedContent, newerContent, hasChanged;
                        
                        if (isViewingHistory) {
                          // תוכן בגרסה המוצגת כעת (הישנה יותר)
                          const displayedVersionSection = currentVersion?.sections.find(v => v.sectionId === section.id);
                          displayedContent = displayedVersionSection?.content || section.content;
                          
                          // תוכן בגרסה החדשה יותר (אחת קדימה)
                          const newerVersionGroup = versionGroups[currentVersionIndex - 1];
                          if (newerVersionGroup) {
                            const newerVersionSection = newerVersionGroup.sections.find(v => v.sectionId === section.id);
                            newerContent = newerVersionSection?.content;
                          }
                          
                          hasChanged = newerContent && displayedContent && displayedContent !== newerContent;
                        } else {
                          displayedContent = section.content;
                          hasChanged = false;
                        }

                        return (
                          <div key={section.id} id={`section-${section.id}`} className="break-inside-avoid transition-all">
                            <Link to={`${createPageUrl("SectionHistory")}?id=${section.id}`}>
                              <div className="flex gap-2 md:gap-4 group cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors">
                                <span className="text-slate-500 font-medium min-w-[1.5rem] md:min-w-[2rem] text-sm md:text-base">
                                  {topicIndex + 1}.{sectionIndex + 1}
                                </span>
                                <div className="flex-1">
                                {isViewingHistory && hasChanged ? (
                                 <InlineDiff
                                   originalContent={displayedContent}
                                   newContent={newerContent}
                                 />
                                ) : (
                                 <>
                                   <div 
                                     className="text-slate-700 leading-relaxed prose prose-sm md:prose prose-slate max-w-none"
                                     style={{ 
                                       fontFamily: "'Times New Roman', 'David Libre', 'Noto Serif', Georgia, serif",
                                       fontSize: "1.125rem",
                                       lineHeight: "1.8",
                                       letterSpacing: "0.01em"
                                     }}
                                     dangerouslySetInnerHTML={{ __html: displayedContent }}
                                   />
                                    {(section.originalLanguage || detectLanguage(section.content)) !== language && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="mt-2 text-blue-600 hover:text-blue-700 print:hidden opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={async (e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (!translatedSections[section.id] && !section.translations?.[language]) {
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
                                            {showTranslatedSections[section.id] ? t('showOriginal') : t('translateSection')}
                                          </>
                                        )}
                                      </Button>
                                    )}
                                  </>
                                )}
                                </div>
                              </div>
                            </Link>
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
        <div className="mt-12 md:mt-16 pt-6 md:pt-8 border-t border-slate-300 text-center text-slate-500 text-xs md:text-sm">
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