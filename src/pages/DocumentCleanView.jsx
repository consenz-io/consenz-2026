import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Globe, Loader2, ChevronLeft, ChevronRight, Eye, EyeOff, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/LanguageContext";
import InlineDiff from "@/components/document/InlineDiff";
import PageHeader from "@/components/PageHeader";
import SectionHistorySidebar from "@/components/document/SectionHistorySidebar";
import SuggestionSidebar from "@/components/document/SuggestionSidebar";

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
    initialData: [],
    enabled: !!documentId,
  });

  const { data: suggestions } = useQuery({
    queryKey: ['suggestions', documentId],
    queryFn: () => base44.entities.Suggestion.filter({ documentId }),
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
    const displayedSnapshot = versionGroups[versionIndex];
    if (!displayedSnapshot || !displayedSnapshot.timestamp) {
      return topic.title;
    }
    
    const versionTimestamp = new Date(displayedSnapshot.timestamp).getTime();
    
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

  // Build document snapshots - each suggestion acceptance creates one snapshot
  const versionGroups = React.useMemo(() => {
    // Always start with current snapshot if we have sections
    const snapshots = [];
    
    // Collect all section IDs that ever existed (from sections + versions)
    const allSectionIds = new Set();
    sections.forEach(s => allSectionIds.add(s.id));
    allVersions.forEach(v => {
      if (v.sectionId) allSectionIds.add(v.sectionId);
    });
    
    // Calculate current weighted consensus from document.consensuses
    const consensuses = document?.consensuses || [];
    const currentWeightedConsensus = consensuses.length === 0 ? 0.5 :
      consensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / consensuses.length;
    
    // Current state snapshot
    const currentSnapshot = {
      version: 'current',
      label: 'נוכחית',
      timestamp: new Date().toISOString(),
      sectionContents: {},
      existingSections: new Set(),
      allSectionIds: allSectionIds,
      weightedConsensus: currentWeightedConsensus,
      documentThreshold: document?.threshold || 2,
      totalParticipants: document?.totalUsersInteracted || 0
    };
    sections.forEach(s => {
      currentSnapshot.sectionContents[s.id] = s.content;
      currentSnapshot.existingSections.add(s.id);
    });
    snapshots.push(currentSnapshot);
    
    // If no versions, return just current snapshot
    if (!allVersions || allVersions.length === 0) {
      return snapshots;
    }
    
    // Sort all versions by created_date descending (newest first)
    const sortedVersions = [...allVersions].sort((a, b) => {
      const dateA = new Date(a.created_date || 0).getTime();
      const dateB = new Date(b.created_date || 0).getTime();
      return dateB - dateA;
    });
    
    // Track section states as we go backwards
    let currentSectionContents = { ...currentSnapshot.sectionContents };
    let currentExistingSections = new Set(currentSnapshot.existingSections);
    
    // Group versions by suggestionId to handle paired versions (before/after)
    const versionsBySuggestion = new Map();
    sortedVersions.forEach(v => {
      if (v.suggestionId) {
        if (!versionsBySuggestion.has(v.suggestionId)) {
          versionsBySuggestion.set(v.suggestionId, []);
        }
        versionsBySuggestion.get(v.suggestionId).push(v);
      }
    });
    
    // Process each suggestion (newest first)
    const processedSuggestions = new Set();
    sortedVersions.forEach(v => {
      if (!v.suggestionId || processedSuggestions.has(v.suggestionId)) return;
      processedSuggestions.add(v.suggestionId);
      
      const versionsForSuggestion = versionsBySuggestion.get(v.suggestionId);
      // Sort by version to get after (higher) and before (lower)
      versionsForSuggestion.sort((a, b) => (b.version || 0) - (a.version || 0));
      const afterVersion = versionsForSuggestion[0];
      const beforeVersion = versionsForSuggestion[1];
      
      // Find the related suggestion
      const relatedSuggestion = suggestions.find(s => s.id === afterVersion.suggestionId);
      
      // Calculate weighted consensus at this point in time
      // Include all suggestions accepted up to and including this one
      const acceptedSuggestionsUpToHere = suggestions
        .filter(s => s.status === 'accepted' && new Date(s.created_date) <= new Date(afterVersion.created_date))
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

      const weightedConsensusAtTime = acceptedSuggestionsUpToHere.length === 0 ? 0.5 : 
        acceptedSuggestionsUpToHere.reduce((sum, s) => {
          const total = (s.proVotes || 0) + (s.conVotes || 0);
          const consensus = total > 0 ? (s.proVotes || 0) / total : 0;
          return sum + Math.min(1, consensus);
        }, 0) / acceptedSuggestionsUpToHere.length;

      // This snapshot shows the state RIGHT AFTER this change was applied
      const snapshotAfterChange = {
        version: afterVersion.version,
        label: `גרסה ${afterVersion.version}`,
        timestamp: afterVersion.created_date,
        changeDescription: afterVersion.changeDescription,
        changeType: afterVersion.changeType,
        suggestionId: afterVersion.suggestionId,
        sectionContents: { ...currentSectionContents },
        existingSections: new Set(currentExistingSections),
        changedSectionId: afterVersion.sectionId,
        newContent: afterVersion.content,
        allSectionIds: allSectionIds,
        // Metadata from the suggestion
        proVotes: relatedSuggestion?.proVotes || 0,
        conVotes: relatedSuggestion?.conVotes || 0,
        participantsAtAcceptance: relatedSuggestion?.participantsAtAcceptance || 0,
        suggestionConsensus: relatedSuggestion?.suggestionConsensus || 0,
        weightedConsensus: weightedConsensusAtTime,
        documentThresholdAtTime: document?.threshold || 2
      };
      
      // Mark if this is a new section creation
      if (afterVersion.changeType === 'section_created') {
        snapshotAfterChange.isNewSection = true;
        snapshotAfterChange.newSectionId = afterVersion.sectionId;
        snapshotAfterChange.newSectionContent = afterVersion.content;
      }
      
      // Mark if this is a deletion
      if (afterVersion.content === '' && beforeVersion) {
        snapshotAfterChange.isDeleted = true;
        snapshotAfterChange.deletedSectionId = afterVersion.sectionId;
        snapshotAfterChange.deletedSectionContent = beforeVersion.content;
        // Keep the deleted section in sectionContents so it can be displayed
        snapshotAfterChange.sectionContents[afterVersion.sectionId] = beforeVersion.content;
        snapshotAfterChange.existingSections.add(afterVersion.sectionId);
      }
      
      snapshots.push(snapshotAfterChange);
      
      // Now update state for the OLDER version (before this change)
      if (afterVersion.changeType === 'section_created') {
        // This section didn't exist before, remove it
        delete currentSectionContents[afterVersion.sectionId];
        currentExistingSections.delete(afterVersion.sectionId);
      } else if (afterVersion.content === '' && beforeVersion) {
        // This is a section deletion - section existed BEFORE deletion
        // So add it back with its previous content
        currentSectionContents[afterVersion.sectionId] = beforeVersion.content;
        currentExistingSections.add(afterVersion.sectionId);
      } else if (beforeVersion) {
        // Section existed with different content
        currentSectionContents[afterVersion.sectionId] = beforeVersion.content;
      }
    });
    
    // Add the ORIGINAL version (before any changes) as the last snapshot
    if (Object.keys(currentSectionContents).length > 0) {
      const originalSnapshot = {
        version: 0,
        label: 'גרסה מקורית',
        timestamp: document?.created_date || new Date(0).toISOString(),
        sectionContents: { ...currentSectionContents },
        existingSections: new Set(currentExistingSections),
        allSectionIds: allSectionIds,
        isOriginal: true
      };
      snapshots.push(originalSnapshot);
    }
    
    return snapshots;
  }, [allVersions, sections, document]);

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
    allVersions.forEach(v => {
      if (v.sectionId && !sectionMap.has(v.sectionId)) {
        // Find the topic for this section from versions
        const relatedVersions = allVersions.filter(ver => ver.sectionId === v.sectionId);
        if (relatedVersions.length > 0) {
          // Try to get topic info
          const latestVersion = relatedVersions.sort((a, b) => (b.version || 0) - (a.version || 0))[0];
          
          // Find the topic by checking current sections or create a placeholder
          let topicId = null;
          const currentSection = sections.find(s => s.id === v.sectionId);
          if (currentSection) {
            topicId = currentSection.topicId;
          } else {
            // Try to infer from other versions or default to first topic
            const sectionWithTopic = sections.find(s => s.topicId);
            topicId = sectionWithTopic?.topicId || topics[0]?.id;
          }
          
          sectionMap.set(v.sectionId, {
            id: v.sectionId,
            content: latestVersion.content,
            topicId: topicId,
            order: 999, // Put deleted sections at end
            isDeleted: true // Mark as deleted
          });
        }
      }
    });
    
    return sectionMap;
  }, [sections, allVersions, topics]);
  
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
          {versionGroups.length > 1 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 print:hidden">
              <div className="bg-white/95 backdrop-blur-sm border-2 border-slate-300 rounded-full shadow-lg px-4 py-2">
                <div className={`flex items-center gap-3`}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentVersionIndex(Math.min(currentVersionIndex + 1, versionGroups.length - 1))}
                    disabled={currentVersionIndex >= versionGroups.length - 1}
                    title={language === 'he' ? 'גרסה קודמת' : 'Previous version'}
                    className="h-9 w-9 p-0 rounded-full"
                  >
                    {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  </Button>
                  <div className="flex flex-col items-center min-w-[80px]">
                    <Badge variant="outline" className={`px-3 text-xs font-semibold ${currentVersionIndex === 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {currentVersionIndex === 0 ? (
                        language === 'he' ? 'נוכחית' : language === 'ar' ? 'حالية' : 'Current'
                      ) : (
                        `${versionGroups.length - currentVersionIndex}/${versionGroups.length}`
                      )}
                    </Badge>
                    {currentSnapshot?.changeDescription && currentVersionIndex > 0 && (
                      <span className="text-[10px] text-slate-500 mt-0.5 max-w-[150px] truncate text-center" title={currentSnapshot.changeDescription}>
                        {currentSnapshot.changeDescription.replace('לפני: ', '')}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentVersionIndex(Math.max(0, currentVersionIndex - 1))}
                    disabled={currentVersionIndex === 0}
                    title={language === 'he' ? 'גרסה חדשה יותר' : 'Newer version'}
                    className="h-9 w-9 p-0 rounded-full"
                  >
                    {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">

            <Button variant="outline" size="sm" onClick={handlePrint} className="hidden md:flex">
              <Printer className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {language === 'en' ? 'Print' : language === 'ar' ? 'طباعة' : 'הדפס'}
            </Button>
          </div>
        </div>
      </div>

      {/* Document Content */}
      <div className="max-w-4xl mx-auto p-4 md:p-8 print:p-12">
        {/* Version Metadata */}
        {currentVersionIndex > 0 && currentSnapshot && currentSnapshot.suggestionId && (
          <Link 
            to={`${createPageUrl("UnderstandingConsensus")}?id=${documentId}`}
            className="mb-4 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg text-xs text-slate-700 block hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
            title={language === 'he' ? 'לחץ להסבר על הקונצנזוס' : language === 'ar' ? 'انقر للحصول على شرح الإجماع' : 'Click to understand consensus'}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
              <span className="px-2 py-1 bg-white rounded border border-green-200">
                <span className="font-semibold">{language === 'he' ? 'תמכו:' : language === 'ar' ? 'مؤيدون:' : 'Pro:'}</span>
                {' '}<span className="text-green-600 font-bold">{currentSnapshot.proVotes || 0}</span>
              </span>
              <span className="text-slate-300">|</span>
              <span className="px-2 py-1 bg-white rounded border border-red-200">
                <span className="font-semibold">{language === 'he' ? 'התנגדו:' : language === 'ar' ? 'معارضون:' : 'Con:'}</span>
                {' '}<span className="text-red-600 font-bold">{currentSnapshot.conVotes || 0}</span>
              </span>
              <span className="text-slate-300">|</span>
              <span className="px-2 py-1 bg-white rounded border border-blue-200">
                <span className="font-semibold">{language === 'he' ? 'משתתפים:' : language === 'ar' ? 'مشاركون:' : 'Participants:'}</span>
                {' '}<span className="text-blue-600 font-bold">{currentSnapshot.participantsAtAcceptance || 0}</span>
              </span>
              <span className="text-slate-300">|</span>
              <span className="px-2 py-1 bg-white rounded border border-purple-200">
                <span className="font-semibold">{language === 'he' ? 'קונצנזוס גרסה:' : language === 'ar' ? 'إجماع الإصدار:' : 'Version consensus:'}</span>
                {' '}<span className="text-purple-600 font-bold">
                  {(() => {
                    const proVotes = currentSnapshot.proVotes || 0;
                    const conVotes = currentSnapshot.conVotes || 0;
                    const totalVotes = proVotes + conVotes;
                    if (totalVotes === 0) return '0';
                    const percentage = (proVotes / totalVotes) * 100;
                    return percentage.toFixed(0);
                  })()}%
                </span>
              </span>
              <span className="text-slate-300">|</span>
              <span className="px-2 py-1 bg-white rounded border border-indigo-200">
                <span className="font-semibold">{language === 'he' ? 'קונצנזוס משוקלל:' : language === 'ar' ? 'إجماع موزون:' : 'Weighted consensus:'}</span>
                {' '}<span className="text-indigo-600 font-bold">{((currentSnapshot.weightedConsensus || 0.5) * 100).toFixed(0)}%</span>
              </span>
            </div>
          </Link>
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
                .sort((a, b) => (a.order || 0) - (b.order || 0));
              
              // Don't show topics without sections in clean view
              if (topicSections.length === 0) {
                return null;
              }
              
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

                        // Get content to display
                        const displayedContent = currentSnapshot?.sectionContents?.[section.id] || section.content;

                        // Get content from the older snapshot (for diff) - to show what changed in THIS version
                        const olderContent = olderSnapshot?.sectionContents?.[section.id];
                        
                        // Check if this section was newly created in THIS snapshot (current view)
                        const isNewlyCreatedSection = isViewingHistory && 
                          currentSnapshot?.isNewSection && 
                          currentSnapshot?.newSectionId === section.id;
                        
                        // Check if this section was deleted in THIS snapshot
                        const isDeletedSection = isViewingHistory &&
                          currentSnapshot?.isDeleted &&
                          currentSnapshot?.deletedSectionId === section.id;



                        // Check if this section changed between versions (content edit)
                        // Compare the snapshot's content with the newer version's content
                        const hasChanged = isViewingHistory && 
                          !isDeletedSection &&
                          currentSnapshot?.changedSectionId === section.id && 
                          currentSnapshot?.newContent && 
                          currentSnapshot?.newContent !== '' &&
                          displayedContent !== currentSnapshot?.newContent;

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
                                   className="border-l-4 border-amber-400 pl-3 py-2 bg-amber-50/50 rounded cursor-pointer hover:bg-amber-100 transition-colors"
                                   onClick={() => {
                                     if (currentSnapshot?.suggestionId) {
                                       setOpenSuggestionId(currentSnapshot.suggestionId);
                                     }
                                   }}
                                 >
                                   <Badge className="mb-2 bg-amber-100 text-amber-800 text-xs">
                                     {language === 'he' ? 'שינוי - לחץ לצפייה בדיון' : language === 'ar' ? 'تغيير - انقر لعرض النقاش' : 'Change - Click to view discussion'}
                                   </Badge>
                                   <InlineDiff
                                     originalContent={displayedContent}
                                     newContent={currentSnapshot?.newContent}
                                   />
                                 </div>
                                ) : (
                                <>
                                  {isViewingHistory && olderContent && olderContent !== displayedContent ? (
                                    <div 
                                      id={`change-${section.id}`} 
                                      className="border-l-4 border-blue-400 pl-3 py-2 bg-blue-50/30 rounded cursor-pointer hover:bg-blue-100 transition-colors"
                                      onClick={() => {
                                        if (currentSnapshot?.suggestionId) {
                                          setOpenSuggestionId(currentSnapshot.suggestionId);
                                        }
                                      }}
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <Badge className="bg-blue-100 text-blue-800 text-xs">
                                          {language === 'he' ? 'השוואה - לחץ לצפייה בדיון' : language === 'ar' ? 'مقارنة - انقر لعرض النقاش' : 'Comparison - Click to view discussion'}
                                        </Badge>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setShowDiffForSections(prev => ({
                                                ...prev,
                                                [section.id]: !prev[section.id]
                                              }));
                                            }}
                                            className="h-7 px-2 text-xs"
                                          >
                                            {showDiffForSections[section.id] ? (
                                              <>
                                                <EyeOff className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                                                {t('hideChanges')}
                                              </>
                                            ) : (
                                              <>
                                                <Eye className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                                                {t('showDiff')}
                                              </>
                                            )}
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setOpenSectionHistoryId(section.id);
                                            }}
                                            className="h-7 px-2 text-xs"
                                          >
                                            {language === 'he' ? 'היסטוריית סעיף' : language === 'ar' ? 'تاريخ القسم' : 'Section History'}
                                          </Button>
                                        </div>
                                      </div>
                                      {showDiffForSections[section.id] ? (
                                        <InlineDiff
                                          originalContent={olderContent}
                                          newContent={displayedContent}
                                        />
                                      ) : (
                                        <div
                                          className="prose prose-sm max-w-none text-slate-700"
                                          style={{ 
                                            direction: isRTL ? 'rtl' : 'ltr', 
                                            textAlign: isRTL ? 'right' : 'left',
                                            fontFamily: "'Times New Roman', 'David Libre', 'Noto Serif', Georgia, serif",
                                            fontSize: "1.125rem",
                                            lineHeight: "1.8",
                                            letterSpacing: "0.01em"
                                          }}
                                          dangerouslySetInnerHTML={{ __html: displayedContent }}
                                        />
                                      )}
                                    </div>
                                  ) : (
                                    <div 
                                      className="text-slate-700 leading-relaxed prose prose-sm md:prose prose-slate max-w-none"
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
          user={null}
          isAdmin={false}
        />
      )}
    </div>
  );
}