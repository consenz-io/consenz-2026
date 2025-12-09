import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ArrowLeft, MessageSquare, FileText, Languages, Loader2, Eye } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";

const detectLanguage = (text) => {
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  
  if (hebrewPattern.test(text)) return 'he';
  if (arabicPattern.test(text)) return 'ar';
  return 'en';
};

const languagePrompts = {
  en: "English",
  he: "Hebrew",
  ar: "Arabic"
};

export default function DocumentComments() {
  const { t, isRTL, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('id');
  const queryClient = useQueryClient();
  const [translatingComment, setTranslatingComment] = React.useState(null);
  const [showTranslatedComments, setShowTranslatedComments] = React.useState({});
  const [expandedSections, setExpandedSections] = React.useState({});
  const [openSectionSidebar, setOpenSectionSidebar] = React.useState(null);

  const { data: document, isLoading: docLoading } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => base44.entities.Document.filter({ id: documentId }).then(docs => docs[0]),
    enabled: !!documentId,
  });

  const { data: sections } = useQuery({
    queryKey: ['sections', documentId],
    queryFn: () => base44.entities.Section.filter({ documentId }),
    initialData: [],
    enabled: !!documentId,
  });

  const { data: topics } = useQuery({
    queryKey: ['topics', documentId],
    queryFn: () => base44.entities.Topic.filter({ documentId }),
    initialData: [],
    enabled: !!documentId,
  });

  const { data: suggestions } = useQuery({
    queryKey: ['suggestions', documentId],
    queryFn: () => base44.entities.Suggestion.filter({ documentId }),
    initialData: [],
    enabled: !!documentId,
  });

  const { data: sectionComments } = useQuery({
    queryKey: ['allSectionComments', documentId],
    queryFn: async () => {
      const sectionIds = sections.map(s => s.id);
      if (sectionIds.length === 0) return [];
      const allComments = await base44.entities.Comment.filter({ rootEntityType: 'section' });
      return allComments.filter(c => sectionIds.includes(c.rootEntityId));
    },
    initialData: [],
    enabled: sections.length > 0,
  });

  const { data: suggestionComments } = useQuery({
    queryKey: ['allSuggestionComments', documentId],
    queryFn: async () => {
      const suggestionIds = suggestions.map(s => s.id);
      if (suggestionIds.length === 0) return [];
      const allComments = await base44.entities.Comment.filter({ rootEntityType: 'suggestion' });
      return allComments.filter(c => suggestionIds.includes(c.rootEntityId));
    },
    initialData: [],
    enabled: suggestions.length > 0,
  });

  const { data: publicProfiles } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    initialData: [],
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const getUserName = (email) => {
    const profile = publicProfiles.find(p => p.email === email);
    if (profile?.fullName) return profile.fullName;
    
    const user = users.find(u => u.email === email);
    if (user?.full_name) return user.full_name;
    
    return email ? email.split('@')[0] : 'User';
  };

  const getUserId = (email) => {
    const profile = publicProfiles.find(p => p.email === email);
    if (profile?.userId) return profile.userId;
    
    const user = users.find(u => u.email === email);
    return user?.id;
  };

  // Translate comment mutation
  const translateCommentMutation = useMutation({
    mutationFn: async (comment) => {
      const prompt = `Translate the following text to ${languagePrompts[language]}. Return ONLY the translated text:\n${comment.content}`;
      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false,
      });
      const translatedContent = (typeof result === 'string' ? result : result.content || result).trim();

      const newTranslations = {
        ...(comment.translations || {}),
        [language]: translatedContent
      };

      await base44.entities.Comment.update(comment.id, { translations: newTranslations });
      return { commentId: comment.id, translations: newTranslations };
    },
    onMutate: (comment) => {
      setTranslatingComment(comment.id);
      setShowTranslatedComments(prev => ({ ...prev, [comment.id]: true }));
    },
    onSuccess: (data) => {
      setTranslatingComment(null);
      // Update the comment in the local state
      queryClient.invalidateQueries({ queryKey: ['allSectionComments', documentId] });
      queryClient.invalidateQueries({ queryKey: ['allSuggestionComments', documentId] });
    },
    onError: () => {
      setTranslatingComment(null);
    }
  });

  const getCommentDisplayContent = (comment) => {
    const translatedContent = comment.translations?.[language];
    if (showTranslatedComments[comment.id] && typeof translatedContent === 'string') {
      return translatedContent;
    }
    return comment.content;
  };

  const needsCommentTranslation = (comment) => {
    const detectedLang = comment.originalLanguage || detectLanguage(comment.content || '');
    return detectedLang && detectedLang !== language;
  };

  const getTopicName = (topicId) => {
    const topic = topics.find(t => t.id === topicId);
    return topic?.title || '';
  };

  // Get section number based on its position in the document
  const getSectionNumber = (sectionId) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return '';
    
    // Sort topics by order
    const sortedTopics = [...topics].sort((a, b) => a.order - b.order);
    
    // Find topic index
    const topicIndex = sortedTopics.findIndex(t => t.id === section.topicId);
    if (topicIndex === -1) return '';
    
    // Get sections for this topic sorted by order
    const topicSections = sections
      .filter(s => s.topicId === section.topicId)
      .sort((a, b) => a.order - b.order);
    
    // Find section index within topic
    const sectionIndex = topicSections.findIndex(s => s.id === sectionId);
    if (sectionIndex === -1) return '';
    
    return `${topicIndex + 1}.${sectionIndex + 1}`;
  };

  const getSectionPreview = (sectionId, expanded = false) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return { text: '', needsExpand: false };
    const text = section.content?.replace(/<[^>]*>/g, '') || '';
    const needsExpand = text.length > 80;
    if (expanded) {
      return { text, needsExpand };
    }
    return { 
      text: needsExpand ? text.substring(0, 80) + '...' : text, 
      needsExpand 
    };
  };

  const getSuggestionTitle = (suggestionId) => {
    const suggestion = suggestions.find(s => s.id === suggestionId);
    return suggestion?.title || '';
  };

  // Group comments by section/suggestion
  const groupedComments = React.useMemo(() => {
    const groups = [];

    // Group section comments
    const sectionGroups = {};
    sectionComments.forEach(comment => {
      if (!sectionGroups[comment.rootEntityId]) {
        const section = sections.find(s => s.id === comment.rootEntityId);
        sectionGroups[comment.rootEntityId] = {
          type: 'section',
          entityId: comment.rootEntityId,
          section,
          topicName: section ? getTopicName(section.topicId) : '',
          comments: []
        };
      }
      sectionGroups[comment.rootEntityId].comments.push(comment);
    });
    Object.values(sectionGroups).forEach(g => groups.push(g));

    // Group suggestion comments
    const suggestionGroups = {};
    suggestionComments.forEach(comment => {
      if (!suggestionGroups[comment.rootEntityId]) {
        const suggestion = suggestions.find(s => s.id === comment.rootEntityId);
        suggestionGroups[comment.rootEntityId] = {
          type: 'suggestion',
          entityId: comment.rootEntityId,
          suggestion,
          comments: []
        };
      }
      suggestionGroups[comment.rootEntityId].comments.push(comment);
    });
    Object.values(suggestionGroups).forEach(g => groups.push(g));

    // Sort groups by most recent comment
    groups.sort((a, b) => {
      const aLatest = Math.max(...a.comments.map(c => new Date(c.created_date).getTime()));
      const bLatest = Math.max(...b.comments.map(c => new Date(c.created_date).getTime()));
      return bLatest - aLatest;
    });

    // Sort comments within each group
    groups.forEach(g => {
      g.comments.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    });

    return groups;
  }, [sectionComments, suggestionComments, sections, suggestions, topics]);

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  if (docLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <p className="text-slate-500">{t('documentNotFound')}</p>
          <Link to={createPageUrl("Home")}>
            <Button className="mt-4">{t('goHome')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to={`${createPageUrl("DocumentView")}?id=${documentId}`} className={isRTL ? 'order-first' : ''}>
            <Button variant="ghost" size="icon">
              <BackArrow className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">{t('allSectionComments')}</h1>
            <p className="text-sm text-slate-600">{document.title}</p>
          </div>
        </div>

        {/* Comments List */}
        {groupedComments.length === 0 ? (
          <Card className="bg-white border-slate-200">
            <CardContent className="p-8 text-center">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{t('noCommentsYet')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {groupedComments.map((group, idx) => (
              <Card key={idx} className="bg-white border-slate-200">
                <CardContent className="p-4">
                  {/* Group Header */}
                  <div className={`mb-3 pb-3 border-b border-slate-100`}>
                    <div className="flex-1 min-w-0">
                      {group.type === 'section' ? (
                        <>
                          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            <Badge variant="outline" className="text-xs font-semibold">{t('section')} {getSectionNumber(group.entityId)}</Badge>
                            <Badge variant="outline" className="text-xs">{group.topicName}</Badge>
                          </div>
                          {(() => {
                            const isExpanded = expandedSections[group.entityId];
                            const { text, needsExpand } = getSectionPreview(group.entityId, isExpanded);
                            return (
                              <div className="w-full">
                                <p 
                                  className={`text-slate-700 mt-1 ${isExpanded ? '' : 'line-clamp-2'}`}
                                  style={{ 
                                    fontFamily: "'Times New Roman', 'David Libre', 'Noto Serif', Georgia, serif",
                                    fontSize: "1rem",
                                    lineHeight: "1.6"
                                  }}
                                >
                                  {text}
                                </p>
                                {needsExpand && (
                                  <button
                                    onClick={() => setExpandedSections(prev => ({ ...prev, [group.entityId]: !prev[group.entityId] }))}
                                    className="text-xs text-blue-600 hover:text-blue-700 mt-1 font-medium"
                                  >
                                    {isExpanded ? t('showLess') : t('showMore')}
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </>
                      ) : (
                        <Link to={`${createPageUrl("SuggestionDetail")}?id=${group.entityId}`} className={`block w-full ${isRTL ? 'text-right' : 'text-left'}`}>
                          <span className="text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors">{t('suggestion')}: {getSuggestionTitle(group.entityId)}</span>
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Comments */}
                  <div className="space-y-3">
                    {group.comments.slice(0, 3).map((comment) => {
                      const suggestionCreatorEmail = group.type === 'suggestion' ? group.suggestion?.created_by : null;
                      return (
                     <div key={comment.id} className={`${isRTL ? 'text-right' : 'text-left'}`}>
                       <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                         <div className={`flex items-center gap-2 ${isRTL ? 'justify-start' : ''}`}>
                           {group.type === 'suggestion' && suggestionCreatorEmail && (
                             <>
                               <span className="text-xs text-slate-500">{t('suggestion')}: {getUserName(suggestionCreatorEmail)}</span>
                               <span className="text-xs text-slate-400">•</span>
                             </>
                           )}
                           <Link 
                             to={`${createPageUrl("Profile")}?userId=${getUserId(comment.created_by)}`}
                             className="text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors"
                           >
                             {getUserName(comment.created_by)}
                           </Link>
                           <span className="text-xs text-slate-500">{new Date(comment.created_date).toLocaleDateString()}</span>
                            {needsCommentTranslation(comment) && (
                              translatingComment === comment.id ? (
                                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                              ) : !comment.translations?.[language] ? (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    translateCommentMutation.mutate(comment);
                                  }}
                                  className="p-0.5 hover:bg-blue-50 rounded transition-colors"
                                  title={t('translate')}
                                >
                                  <Languages className="w-3 h-3 text-blue-600" />
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setShowTranslatedComments(prev => ({ ...prev, [comment.id]: !prev[comment.id] }));
                                  }}
                                  className="p-0.5 hover:bg-slate-100 rounded transition-colors"
                                  title={showTranslatedComments[comment.id] ? t('showOriginal') : t('showTranslation')}
                                >
                                  <Languages className={`w-3 h-3 ${showTranslatedComments[comment.id] ? 'text-slate-600' : 'text-blue-600'}`} />
                                </button>
                              )
                            )}
                          </div>
                          <p className={`text-sm text-slate-700 mt-0.5 ${isRTL ? 'text-right' : 'text-left'}`}>{getCommentDisplayContent(comment)}</p>
                        </div>
                      </div>
                       );
                    })}
                    {group.comments.length > 3 && (
                      <p className="text-xs text-slate-500 text-center">
                        +{group.comments.length - 3} {t('comments')}
                      </p>
                    )}
                  </div>

                  {/* View in Document button at bottom */}
                  {group.type === 'section' && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <Link to={`${createPageUrl("DocumentView")}?id=${documentId}&scrollTo=${group.entityId}`}>
                        <Button variant="outline" size="sm" className="text-xs h-6 px-2">
                          <Eye className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                          {t('viewInDocument')}
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}