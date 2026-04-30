import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Download, Globe, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/LanguageContext";
import InlineDiff from "@/components/document/InlineDiff";
import PageHeader from "@/components/PageHeader";
import VersionNavigation from "@/components/document/VersionNavigation";
import DocumentSnapshot from "@/components/document/DocumentSnapshot";
import { useDocumentVersions } from "@/components/document/hooks/useDocumentVersions";

// Lazy load sidebars
const SectionHistorySidebar = React.lazy(() => import("@/components/document/SectionHistorySidebar"));
const SuggestionSidebar = React.lazy(() => import("@/components/document/SuggestionSidebar"));

const detectLanguage = (text) => {
  if (!text) return 'en';
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  const cleanText = text.replace(/<[^>]*>/g, '');
  if (hebrewPattern.test(cleanText)) return 'he';
  if (arabicPattern.test(cleanText)) return 'ar';
  return 'en';
};

export default function DocumentCleanView() {
  const { t, isRTL, language: rawLanguage } = useLanguage();
  const language = rawLanguage || 'he';
  const queryClient = useQueryClient();
  const [translatedSections, setTranslatedSections] = useState({});
  const [translatedTopics, setTranslatedTopics] = useState({});
  const [translatedDocTitle, setTranslatedDocTitle] = useState(null);
  const [showTranslatedDoc, setShowTranslatedDoc] = useState(false);
  const [showTranslatedTopics, setShowTranslatedTopics] = useState({});
  const [showTranslatedSections, setShowTranslatedSections] = useState({});
  const [translatingAll, setTranslatingAll] = useState(false);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0);
  const [openSectionHistoryId, setOpenSectionHistoryId] = useState(null);
  const [showDiffForSections, setShowDiffForSections] = useState({});
  const [openSuggestionId, setOpenSuggestionId] = useState(null);
  const [searchParams] = useSearchParams();

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });
  const documentId = searchParams.get('id');
  const scrollToSuggestionId = searchParams.get('scrollToSuggestion');

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
    enabled: !!documentId,
  });

  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['suggestions', documentId],
    queryFn: () => base44.entities.Suggestion.filter({ documentId }),
    enabled: !!documentId,
  });

  const { data: topicEditSuggestions } = useQuery({
    queryKey: ['topicEditSuggestions', documentId],
    queryFn: () => base44.entities.TopicEditSuggestion.filter({ documentId, status: 'accepted' }, 'created_date'),
    initialData: [],
    enabled: !!documentId,
  });

  // Build lookup Map once: topicId → sorted array of accepted edit suggestions
  // O(n) build, O(1) lookup per topic — replaces the previous O(n²) per-render pattern
  const topicEditSuggestionsMap = React.useMemo(() => {
    const map = new Map();
    topicEditSuggestions.forEach(s => {
      if (!map.has(s.topicId)) map.set(s.topicId, []);
      map.get(s.topicId).push(s);
    });
    // Sort each topic's list by date ascending (once, not per-call)
    map.forEach(list => list.sort((a, b) => new Date(a.created_date) - new Date(b.created_date)));
    return map;
  }, [topicEditSuggestions]);

  // Get topic title as it was at a specific version
  const getTopicTitleAtVersion = (topicId, versionIndex) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return '';
    if (versionIndex === 0) return topic.title;

    const displayedSnapshot = versionGroups[versionIndex];
    if (!displayedSnapshot?.timestamp) return topic.title;

    const versionTimestamp = new Date(displayedSnapshot.timestamp).getTime();
    const allForTopic = topicEditSuggestionsMap.get(topicId) || [];

    const relevant = allForTopic.filter(s => new Date(s.created_date).getTime() <= versionTimestamp);

    if (relevant.length === 0) {
      return allForTopic.length > 0 ? allForTopic[0].originalTitle : topic.title;
    }
    return relevant[relevant.length - 1].newTitle;
  };

  // Use custom hook for version management
  const versionGroups = useDocumentVersions(document, sections, allVersions || [], suggestions || []);

  const currentSnapshot = versionGroups[currentVersionIndex] || versionGroups[0];
  const olderSnapshot = currentVersionIndex < versionGroups.length - 1 ? versionGroups[currentVersionIndex + 1] : null;
  
  // Build a complete list of all sections including deleted ones from versions
  const allSectionsMap = React.useMemo(() => {
    const sectionMap = new Map();
    
    // Add current sections
    sections.forEach(s => {
      sectionMap.set(s.id, s);
    });
    
    // Add sections from versions that might be deleted now
    (allVersions || []).forEach(v => {
      if (v.sectionId && !sectionMap.has(v.sectionId)) {
        // Find the topic for this section from versions
        const relatedVersions = (allVersions || []).filter(ver => ver.sectionId === v.sectionId);
        if (relatedVersions.length > 0) {
          // Get the earliest version (when section was created) to find original order
          const earliestVersion = relatedVersions.sort((a, b) => (a.version || 0) - (b.version || 0))[0];
          const latestVersion = relatedVersions.sort((a, b) => (b.version || 0) - (a.version || 0))[0];
          
          // Try to find the corresponding suggestion to get topic and order info
          const relatedSuggestion = (suggestions || []).find(s => 
            s.id === earliestVersion.suggestionId || 
            (allVersions || []).some(ver => ver.sectionId === v.sectionId && ver.suggestionId === s.id)
          );
          
          let topicId = null;
          let order = 999; // Default fallback
          
          if (relatedSuggestion) {
            topicId = relatedSuggestion.topicId;
            order = relatedSuggestion.insertPosition || 999;
          } else {
            // Try to infer from other sections in the same topic
            const currentSection = sections.find(s => s.id === v.sectionId);
            if (currentSection) {
              topicId = currentSection.topicId;
              order = currentSection.order;
            } else {
              const sectionWithTopic = sections.find(s => s.topicId);
              topicId = sectionWithTopic?.topicId || topics[0]?.id;
            }
          }
          
          // Prefer topicId/sectionOrder stored directly on the version record
          const topicIdFromVersion = latestVersion.topicId || earliestVersion.topicId;
          const orderFromVersion = latestVersion.sectionOrder ?? earliestVersion.sectionOrder;

          sectionMap.set(v.sectionId, {
            id: v.sectionId,
            content: latestVersion.content,
            topicId: topicIdFromVersion || topicId,
            order: orderFromVersion ?? order,
            isDeleted: true
          });
        }
      }
    });
    
    return sectionMap;
  }, [sections, allVersions, topics, suggestions]);  // eslint-disable-line
  
  // Reset version index if it's out of bounds
  React.useEffect(() => {
    if (currentVersionIndex >= versionGroups.length && versionGroups.length > 0) {
      setCurrentVersionIndex(0);
    }
  }, [versionGroups.length, currentVersionIndex]);

  // Initialize showDiffForSections with true for all sections when viewing history
  React.useEffect(() => {
    if (currentVersionIndex > 0 && sections && sections.length > 0) {
      const initialState = {};
      sections.forEach(section => {
        if (showDiffForSections[section.id] === undefined) {
          initialState[section.id] = true;
        }
      });
      if (Object.keys(initialState).length > 0) {
        setShowDiffForSections(prev => ({ ...prev, ...initialState }));
      }
    }
  }, [currentVersionIndex, sections, showDiffForSections]);

  // גלילה אוטומטית לסעיף שהשתנה או נוצר
  React.useEffect(() => {
    if (currentVersionIndex > 0 && currentSnapshot && typeof window !== 'undefined') {
      const scrollTimer = setTimeout(() => {
        let targetSectionId = null;

        // Priority: deleted > new > edited
        if (currentSnapshot.isDeleted && currentSnapshot.deletedSectionId) {
          targetSectionId = currentSnapshot.deletedSectionId;
        } else if (currentSnapshot.isNewSection && currentSnapshot.newSectionId) {
          targetSectionId = currentSnapshot.newSectionId;
        } else if (currentSnapshot.changedSectionId) {
          targetSectionId = currentSnapshot.changedSectionId;
        }

        if (targetSectionId && typeof window !== 'undefined' && window.document?.getElementById) {
          const changeElement = window.document.getElementById(`change-${targetSectionId}`);
          if (changeElement) {
            changeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            changeElement.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2', 'rounded-lg');
            
            const highlightTimer = setTimeout(() => {
              if (changeElement) {
                changeElement.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2', 'rounded-lg');
              }
            }, 2000);
            
            return () => clearTimeout(highlightTimer);
          }
        }
      }, 150);

      return () => clearTimeout(scrollTimer);
    }
  }, [currentVersionIndex, currentSnapshot]);

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
    ((document?.originalLanguage || 'he') !== language);
    
  const handleDownload = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const docTitle = (showTranslatedDoc && translatedDocTitle) || document.title;
    const isRtlDoc = isRTL;
    const dir = isRtlDoc ? 'rtl' : 'ltr';

    const topicRows = topics
      .map((topic, ti) => {
        const topicSections = Array.from(allSectionsMap.values())
          .filter(s => s.topicId === topic.id && !s.isDeleted)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        if (topicSections.length === 0) return '';

        const topicTitle = (showTranslatedTopics[topic.id] && (translatedTopics[topic.id] || topic.translations?.[language]))
          || topic.title;

        const sectionsHtml = topicSections.map((section, si) => {
          const content = (showTranslatedSections[section.id]
            ? (translatedSections[section.id] || section.translations?.[language])
            : null) || section.content || '';
          return `<div style="margin-bottom:1.5rem">
            <span style="color:#64748b;font-weight:500;margin-inline-end:0.5rem">${ti + 1}.${si + 1}</span>
            <span style="font-size:1.1rem;line-height:1.8">${content}</span>
          </div>`;
        }).join('');

        return `<div style="margin-bottom:2.5rem">
          <h2 style="font-size:1.4rem;font-weight:bold;border-bottom:1px solid #cbd5e1;padding-bottom:0.5rem;margin-bottom:1rem">${ti + 1}. ${topicTitle}</h2>
          ${sectionsHtml}
        </div>`;
      })
      .join('');

    printWindow.document.write(`<!DOCTYPE html>
<html dir="${dir}" lang="${language}">
<head>
  <meta charset="UTF-8">
  <title>${docTitle}</title>
  <style>
    body { font-family: 'Times New Roman', 'David Libre', Georgia, serif; max-width: 800px; margin: 2cm auto; padding: 1rem; color: #1e293b; }
    h1 { font-size: 2rem; margin-bottom: 2rem; }
    @page { margin: 2cm; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${docTitle}</h1>
  ${topicRows}
  <footer style="margin-top:3rem;padding-top:1rem;border-top:1px solid #cbd5e1;text-align:center;color:#94a3b8;font-size:0.8rem">
    <p>מסמך זה נוצר באמצעות פלטפורמת Consenz</p>
  </footer>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`);
    printWindow.document.close();
  };

  if (docLoading || topicsLoading || sectionsLoading || versionsLoading || suggestionsLoading) {
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

  const allTranslated = sections.every(s => 
    (s.originalLanguage || 'he') === language || translatedSections[s.id] || s.translations?.[language]
  ) && topics.every(t => 
    (t.originalLanguage || 'he') === language || translatedTopics[t.id] || t.translations?.[language]
  ) && ((document.originalLanguage || 'he') === language || translatedDocTitle || document.translations?.[language]);

  return (
    <div className="min-h-screen bg-white">
      <VersionNavigation
        currentIndex={currentVersionIndex}
        totalVersions={versionGroups.length}
        onNavigate={setCurrentVersionIndex}
        currentSnapshot={currentSnapshot}
        language={language}
        isRTL={isRTL}
      />
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

            <Button variant="outline" size="sm" onClick={handleDownload} className="hidden md:flex">
              <Download className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {language === 'en' ? 'Download' : language === 'ar' ? 'تنزيل' : 'הורד'}
            </Button>
          </div>
        </div>
      </div>

      {/* Document Content */}
      <div className="max-w-4xl mx-auto p-4 md:p-8 print:p-12 pb-24">
        {/* Version Metadata */}
        {currentVersionIndex > 0 && currentSnapshot && (
          <div 
            className={`mb-4 p-3 border rounded-lg text-xs text-slate-700 ${
              currentSnapshot.isDirectEdit
                ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200'
                : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
              {currentSnapshot.isTopicTitleChange ? (
                <span className="px-2 py-1 bg-purple-100 rounded border border-purple-300 font-semibold text-purple-800">
                  {language === 'he'
                    ? `📝 שינוי כותרת נושא: "${currentSnapshot.topicTitleChangeMeta?.originalTitle}" → "${currentSnapshot.topicTitleChangeMeta?.newTitle}"`
                    : language === 'ar'
                    ? `📝 تغيير عنوان الموضوع: "${currentSnapshot.topicTitleChangeMeta?.originalTitle}" → "${currentSnapshot.topicTitleChangeMeta?.newTitle}"`
                    : `📝 Topic title change: "${currentSnapshot.topicTitleChangeMeta?.originalTitle}" → "${currentSnapshot.topicTitleChangeMeta?.newTitle}"`}
                </span>
              ) : currentSnapshot.isDirectEdit ? (
                <span className="px-2 py-1 bg-amber-100 rounded border border-amber-300 font-semibold text-amber-800">
                  {language === 'he' ? '✏️ עריכה ישירה על ידי מנהל' : language === 'ar' ? '✏️ تعديل مباشر من المسؤول' : '✏️ Direct Admin Edit'}
                </span>
              ) : currentSnapshot.suggestionId && (
                <>
                  <span className="px-2 py-1 bg-white rounded border border-slate-300">
                    <span className="font-semibold">{language === 'he' ? 'גרסה:' : language === 'ar' ? 'إصدار:' : 'Version:'}</span>
                    {' '}<span className="text-slate-900 font-bold">{versionGroups.length - currentVersionIndex}</span>
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="px-2 py-1 bg-white rounded border border-green-200">
                    <span className="font-semibold">{language === 'he' ? 'תמכו:' : language === 'ar' ? 'مؤيدون:' : 'Pro:'}</span>
                    {' '}<span className="text-green-600 font-bold">{currentSnapshot.proVotes || 0}</span>
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="px-2 py-1 bg-white rounded border border-red-200">
                    <span className="font-semibold">{language === 'he' ? 'התנגדו:' : language === 'ar' ? 'معارضون:' : 'Con:'}</span>
                    {' '}<span className="text-red-600 font-bold">{currentSnapshot.conVotes || 0}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        )}
        
        {/* Topics and Sections */}
        <div className="space-y-8 md:space-y-12">
          {topics.length === 0 ? (
            <p className="text-slate-500 text-center py-8">{t('noTopicsYet')}</p>
          ) : (
            topics.map((topic, topicIndex) => {
              const isViewingHistory = currentVersionIndex > 0;
              
              // Filter sections for this topic using the complete sections map
              const topicSections = Array.from(allSectionsMap.values())
                .filter(s => s.topicId === topic.id)
                .filter(section => {
                  if (!isViewingHistory) {
                    // In current view, only show non-deleted sections
                    return !section.isDeleted;
                  }
                  
                  // Always show sections that exist in snapshot OR were deleted in this snapshot
                  const sectionExistsInSnapshot = currentSnapshot?.existingSections?.has(section.id) ?? 
                    currentSnapshot?.sectionContents?.hasOwnProperty(section.id);
                  const isDeletedInThisSnapshot = currentSnapshot?.isDeleted && 
                    currentSnapshot?.deletedSectionId === section.id;
                  
                  return sectionExistsInSnapshot || isDeletedInThisSnapshot;
                })
                .sort((a, b) => {
                  if ((a.order || 0) !== (b.order || 0)) return (a.order || 0) - (b.order || 0);
                  return new Date(a.created_date || 0) - new Date(b.created_date || 0);
                });
              
              // Don't show topics without sections in clean view
              if (topicSections.length === 0) {
                return null;
              }
              
              return (
                <div key={topic.id} className="space-y-4 md:space-y-6 break-inside-avoid">
                  {/* Topic Title */}
                  <div className="border-b border-slate-300 pb-2 mb-4 md:mb-6">
                    <h2 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight" style={{ fontFamily: "'Times New Roman', 'David Libre', 'Noto Serif', Georgia, serif" }}>
                      {topicIndex + 1}. {(topic.originalLanguage || 'he') !== language && showTranslatedTopics[topic.id]
                        ? (translatedTopics[topic.id] || (typeof topic.translations?.[language] === 'string' ? topic.translations[language] : topic.translations?.[language]?.title) || getTopicTitleAtVersion(topic.id, currentVersionIndex))
                        : getTopicTitleAtVersion(topic.id, currentVersionIndex)}
                      {/* Highlight topic whose title changed in this version */}
                      {currentSnapshot?.isTopicTitleChange && currentSnapshot?.topicTitleChangeMeta?.topicId === topic.id && (
                        <span className="ml-2 text-sm font-normal text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
                          {language === 'he' ? '← שונה בגרסה זו' : language === 'ar' ? '← تغيّر في هذا الإصدار' : '← changed in this version'}
                        </span>
                      )}
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
                        // Get content to display
                        const displayedContent = currentSnapshot?.sectionContents?.[section.id] || section.content;

                        // Get content from the older snapshot (for diff) - to show what changed in THIS version
                        const olderContent = olderSnapshot?.sectionContents?.[section.id];
                        
                        // Check if this section was newly created in THIS snapshot (current view)
                        const isNewlyCreatedSection = isViewingHistory && 
                          currentSnapshot?.isNewSection && 
                          currentSnapshot?.newSectionId === section.id;
                        
                        // Check if this section was deleted in THIS snapshot
                        const versionSuggestion = (suggestions || []).find(s => s.id === currentSnapshot?.suggestionId);
                        const isDeletedSection = isViewingHistory &&
                          currentSnapshot?.isDeleted &&
                          currentSnapshot?.deletedSectionId === section.id &&
                          (versionSuggestion?.type === 'delete_section' || currentSnapshot?.isDirectEdit);

                        // Check if this section was directly edited by admin in this snapshot
                        const isDirectlyEdited = isViewingHistory &&
                          currentSnapshot?.isDirectEdit &&
                          currentSnapshot?.changedSectionId === section.id;

                        // Check if this section changed between versions (content edit)
                        // olderContent = the content in the previous (newer in time) snapshot
                        // displayedContent = the content at this historical snapshot
                        const hasChanged = isViewingHistory && 
                          !isDeletedSection &&
                          !isDirectlyEdited &&
                          currentSnapshot?.changedSectionId === section.id && 
                          olderContent !== undefined &&
                          olderContent !== displayedContent;

                        return (
                          <div key={section.id} id={`section-${section.id}`} className="break-inside-avoid transition-all">
                            <div 
                              className="flex gap-2 md:gap-4 group p-2 rounded-lg transition-colors"
                            >
                                {!isDeletedSection && (
                                  <span className="text-slate-500 font-medium min-w-[1.5rem] md:min-w-[2rem] text-sm md:text-base">
                                    {topicIndex + 1}.{sectionIndex + 1}
                                  </span>
                                )}
                                <div className="flex-1">
                                {isDeletedSection ? (
                                 <div 
                                   id={`change-${section.id}`} 
                                   className="border-l-4 border-red-500 pl-3 py-2 bg-red-50 rounded cursor-pointer hover:bg-red-100 transition-colors"
                                   onClick={() => {
                                     if (currentSnapshot?.suggestionId) {
                                       setOpenSuggestionId(currentSnapshot.suggestionId);
                                     }
                                   }}
                                 >
                                   <Badge className="mb-2 bg-red-100 text-red-800 text-xs">
                                     {language === 'he' ? 'סעיף נמחק - לחץ לצפייה בדיון' : language === 'ar' ? 'تم حذف القسم - انقر لعرض النقاش' : 'Section Deleted - Click to view discussion'}
                                   </Badge>
                                   <div 
                                     className="prose prose-sm max-w-none text-slate-700 line-through opacity-60"
                                     style={{ 
                                       fontFamily: "'Times New Roman', 'David Libre', 'Noto Serif', Georgia, serif",
                                       fontSize: "1.125rem",
                                       lineHeight: "1.8"
                                     }}
                                     dangerouslySetInnerHTML={{ __html: currentSnapshot?.deletedSectionContent || displayedContent }}
                                   />
                                 </div>
                                ) : isDirectlyEdited ? (
                                  <div
                                    id={`change-${section.id}`}
                                    className="border-l-4 border-amber-500 pl-3 py-2 bg-amber-50 rounded cursor-pointer hover:bg-amber-100 transition-colors"
                                    onClick={() => setOpenSectionHistoryId(section.id)}
                                  >
                                    <Badge className="mb-2 bg-amber-100 text-amber-800 text-xs">
                                      {language === 'he' ? '✏️ עריכה ישירה של מנהל' : language === 'ar' ? '✏️ تعديل مباشر من المسؤول' : '✏️ Direct Admin Edit'}
                                    </Badge>
                                    <InlineDiff
                                      originalContent={olderContent || displayedContent}
                                      newContent={currentSnapshot?.newContent || displayedContent}
                                    />
                                  </div>
                                ) : isViewingHistory && isNewlyCreatedSection ? (
                                  <div 
                                    id={`change-${section.id}`} 
                                    className="bg-green-50 border-l-4 border-green-500 p-3 rounded cursor-pointer hover:bg-green-100 transition-colors"
                                    onClick={() => {
                                      if (currentSnapshot?.suggestionId) {
                                        setOpenSuggestionId(currentSnapshot.suggestionId);
                                      }
                                    }}
                                  >
                                    <Badge className="mb-2 bg-green-100 text-green-800 text-xs">
                                      {language === 'he' ? 'סעיף חדש - לחץ לצפייה בדיון' : language === 'ar' ? 'قسم جديد - انقر لعرض النقاش' : 'New Section - Click to view discussion'}
                                    </Badge>
                                    <div 
                                      className="prose prose-sm max-w-none text-green-800"
                                      style={{ 
                                        fontFamily: "'Times New Roman', 'David Libre', 'Noto Serif', Georgia, serif",
                                        fontSize: "1.125rem",
                                        lineHeight: "1.8"
                                      }}
                                      dangerouslySetInnerHTML={{ __html: currentSnapshot?.newSectionContent || displayedContent }}
                                    />
                                  </div>
                                ) : isViewingHistory && hasChanged ? (
                                 <div 
                                   id={`change-${section.id}`} 
                                   className="border-l-4 border-amber-400 pl-3 py-2 bg-amber-50/30 rounded"
                                 >
                                   <div className="flex items-center justify-between mb-2">
                                     <Badge className="bg-amber-100 text-amber-800 text-xs">
                                       {language === 'he' ? '✏️ שינוי בגרסה זו' : language === 'ar' ? '✏️ تغيير في هذا الإصدار' : '✏️ Changed in this version'}
                                     </Badge>
                                     {currentSnapshot?.suggestionId && (
                                       <button
                                         onClick={() => setOpenSuggestionId(currentSnapshot.suggestionId)}
                                         className="text-[11px] text-blue-600 hover:underline"
                                       >
                                         {language === 'he' ? 'צפה בדיון' : language === 'ar' ? 'عرض النقاش' : 'View discussion'}
                                       </button>
                                     )}
                                   </div>
                                   <InlineDiff
                                     originalContent={displayedContent}
                                     newContent={olderContent}
                                   />
                                 </div>
                                ) : (
                                <>
                                {isViewingHistory && olderContent && olderContent !== displayedContent ? (
                                  <div 
                                    id={`change-${section.id}`} 
                                    className="border-l-4 border-blue-400 pl-3 py-2 bg-blue-50/20 rounded cursor-pointer hover:bg-blue-50/40 transition-colors"
                                    onClick={() => setOpenSectionHistoryId(section.id)}
                                  >
                                      <div className="flex items-center justify-between mb-2">
                                        <Badge className="bg-blue-100 text-blue-800 text-xs">
                                          {language === 'he' ? '✏️ שינוי בגרסה זו' : language === 'ar' ? '✏️ تغيير في هذا الإصدار' : '✏️ Changed in this version'}
                                        </Badge>
                                        {currentSnapshot?.suggestionId && (
                                          <button
                                            onClick={() => setOpenSuggestionId(currentSnapshot.suggestionId)}
                                            className="text-[11px] text-blue-600 hover:underline"
                                          >
                                            {language === 'he' ? 'צפה בדיון' : language === 'ar' ? 'عرض النقاش' : 'View discussion'}
                                          </button>
                                        )}
                                      </div>
                                      <InlineDiff
                                        originalContent={olderContent}
                                        newContent={displayedContent}
                                      />
                                    </div>
                                  ) : (
                                    <div 
                                      className="text-slate-700 leading-relaxed prose prose-sm md:prose prose-slate max-w-none cursor-pointer hover:bg-slate-50/50 p-2 rounded transition-colors"
                                      onClick={() => setOpenSectionHistoryId(section.id)}
                                      style={{ 
                                        fontFamily: "'Times New Roman', 'David Libre', 'Noto Serif', Georgia, serif",
                                        fontSize: "1.125rem",
                                        lineHeight: "1.8",
                                        letterSpacing: "0.01em"
                                      }}
                                      dangerouslySetInnerHTML={{ 
                                        __html: showTranslatedSections[section.id] 
                                          ? (translatedSections[section.id] || section.translations?.[language] || displayedContent)
                                          : displayedContent 
                                      }}
                                    />
                                  )}
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

      <React.Suspense fallback={<div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"><div className="bg-white p-4 rounded-lg shadow-lg">טוען...</div></div>}>
        {openSectionHistoryId && (
          <SectionHistorySidebar
            sectionId={openSectionHistoryId}
            isOpen={true}
            onClose={() => setOpenSectionHistoryId(null)}
          />
        )}

        {openSuggestionId && (
          <SuggestionSidebar
            suggestionId={openSuggestionId}
            onClose={() => setOpenSuggestionId(null)}
            document={document}
            user={currentUser || null}
          />
        )}
      </React.Suspense>
    </div>
  );
}