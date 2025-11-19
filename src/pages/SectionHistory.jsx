import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, History, MessageSquare, Languages, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";
import SectionDiff from "../components/document/SectionDiff";
import CommentsSection from "../components/document/CommentsSection";
import PageHeader from "../components/PageHeader";
import TranslatableContent from "../components/document/TranslatableContent";

export default function SectionHistory() {
  const { t, isRTL, language } = useLanguage();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const sectionId = searchParams.get('id');
  const [showComments, setShowComments] = useState({});
  const [translatingDocTitle, setTranslatingDocTitle] = useState(false);
  const [translatingTopicTitle, setTranslatingTopicTitle] = useState(false);
  const [showTranslatedDocTitle, setShowTranslatedDocTitle] = useState(false);
  const [showTranslatedTopicTitle, setShowTranslatedTopicTitle] = useState(false);

  const languagePrompts = {
    en: "English",
    he: "Hebrew",
    ar: "Arabic"
  };

  const { data: section, isLoading: sectionLoading } = useQuery({
    queryKey: ['section', sectionId],
    queryFn: () => base44.entities.Section.filter({ id: sectionId }).then(s => s[0]),
    enabled: !!sectionId,
  });

  const { data: document } = useQuery({
    queryKey: ['document', section?.documentId],
    queryFn: () => base44.entities.Document.filter({ id: section.documentId }).then(d => d[0]),
    enabled: !!section?.documentId,
  });

  const { data: topic } = useQuery({
    queryKey: ['topic', section?.topicId],
    queryFn: () => base44.entities.Topic.filter({ id: section.topicId }).then(t => t[0]),
    enabled: !!section?.topicId,
  });

  const { data: versions, isLoading: versionsLoading } = useQuery({
    queryKey: ['versions', sectionId],
    queryFn: () => base44.entities.DocumentVersion.filter({ sectionId }, '-version'),
    initialData: [],
    enabled: !!sectionId,
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const getUserName = (email) => {
    const foundUser = users.find(u => u.email === email);
    return foundUser?.full_name || email;
  };

  const toggleComments = (suggestionId) => {
    setShowComments(prev => ({
      ...prev,
      [suggestionId]: !prev[suggestionId]
    }));
  };

  const translateDocumentMutation = useMutation({
    mutationFn: async () => {
      const titlePrompt = `Translate the following text to ${languagePrompts[language]}. Return ONLY the translated text:\n${document.title}`;
      const titleResult = await base44.integrations.Core.InvokeLLM({
        prompt: titlePrompt,
        add_context_from_internet: false,
      });
      const translatedTitle = (typeof titleResult === 'string' ? titleResult : titleResult.content || titleResult).trim();

      const newTranslations = {
        ...(document.translations || {}),
        [language]: {
          title: translatedTitle
        }
      };

      await base44.entities.Document.update(document.id, {
        translations: newTranslations
      });

      return newTranslations;
    },
    onMutate: () => {
      setTranslatingDocTitle(true);
      setShowTranslatedDocTitle(true);
    },
    onSuccess: (newTranslations) => {
      setTranslatingDocTitle(false);
      queryClient.setQueryData(['document', document.id], (oldData) => {
        if (!oldData) return oldData;
        return { ...oldData, translations: newTranslations };
      });
    },
    onError: () => {
      setTranslatingDocTitle(false);
    }
  });

  const translateTopicMutation = useMutation({
    mutationFn: async () => {
      const titlePrompt = `Translate the following text to ${languagePrompts[language]}. Return ONLY the translated text:\n${topic.title}`;
      const titleResult = await base44.integrations.Core.InvokeLLM({
        prompt: titlePrompt,
        add_context_from_internet: false,
      });
      const translatedTitle = (typeof titleResult === 'string' ? titleResult : titleResult.content || titleResult).trim();

      const newTranslations = {
        ...(topic.translations || {}),
        [language]: {
          title: translatedTitle
        }
      };

      await base44.entities.Topic.update(topic.id, {
        translations: newTranslations
      });

      return newTranslations;
    },
    onMutate: () => {
      setTranslatingTopicTitle(true);
      setShowTranslatedTopicTitle(true);
    },
    onSuccess: (newTranslations) => {
      setTranslatingTopicTitle(false);
      queryClient.setQueryData(['topic', topic.id], (oldData) => {
        if (!oldData) return oldData;
        return { ...oldData, translations: newTranslations };
      });
    },
    onError: () => {
      setTranslatingTopicTitle(false);
    }
  });

  if (sectionLoading || versionsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!section) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-5xl mx-auto text-center py-20">
          <h1 className="text-2xl font-bold text-slate-900">{t('sectionNotFound')}</h1>
          <Link to={createPageUrl("Home")}>
            <Button className="mt-4">{t('goHome')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Group versions by suggestion to show related versions together
  const versionGroups = [];
  versions.forEach(version => {
    if (version.changeType === 'suggestion_accepted' && version.suggestionId) {
      const existingGroup = versionGroups.find(g => g.suggestionId === version.suggestionId);
      if (existingGroup) {
        existingGroup.versions.push(version);
      } else {
        versionGroups.push({
          suggestionId: version.suggestionId,
          versions: [version],
          changeDescription: version.changeDescription
        });
      }
    } else {
      versionGroups.push({
        suggestionId: null,
        versions: [version],
        changeDescription: version.changeDescription
      });
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <PageHeader 
          title={t('sectionHistory')}
          backUrl={`${createPageUrl("DocumentView")}?id=${document?.id}&scrollTo=${sectionId}`}
        />
        
        {document && topic && (
          <div className={`flex items-center gap-2 text-slate-600 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Link to={`${createPageUrl("DocumentView")}?id=${document.id}`} className="hover:underline">
              {showTranslatedDocTitle && document.translations?.[language]?.title
                ? document.translations[language].title
                : document.title}
            </Link>
            {document.originalLanguage && document.originalLanguage !== language && (
              translatingDocTitle ? (
                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
              ) : !document.translations?.[language]?.title ? (
                <button
                  onClick={() => translateDocumentMutation.mutate()}
                  className="p-0.5 hover:bg-blue-50 rounded transition-colors"
                  title={t('translate')}
                >
                  <Languages className="w-3 h-3 text-blue-600" />
                </button>
              ) : (
                <button
                  onClick={() => setShowTranslatedDocTitle(!showTranslatedDocTitle)}
                  className="p-0.5 hover:bg-slate-100 rounded transition-colors"
                  title={showTranslatedDocTitle ? t('showOriginal') : t('showTranslation')}
                >
                  <Languages className={`w-3 h-3 ${showTranslatedDocTitle ? 'text-slate-600' : 'text-blue-600'}`} />
                </button>
              )
            )}
            <span>{' > '}</span>
            <span>
              {showTranslatedTopicTitle && topic.translations?.[language]?.title
                ? topic.translations[language].title
                : topic.title}
            </span>
            {topic.originalLanguage && topic.originalLanguage !== language && (
              translatingTopicTitle ? (
                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
              ) : !topic.translations?.[language]?.title ? (
                <button
                  onClick={() => translateTopicMutation.mutate()}
                  className="p-0.5 hover:bg-blue-50 rounded transition-colors"
                  title={t('translate')}
                >
                  <Languages className="w-3 h-3 text-blue-600" />
                </button>
              ) : (
                <button
                  onClick={() => setShowTranslatedTopicTitle(!showTranslatedTopicTitle)}
                  className="p-0.5 hover:bg-slate-100 rounded transition-colors"
                  title={showTranslatedTopicTitle ? t('showOriginal') : t('showTranslation')}
                >
                  <Languages className={`w-3 h-3 ${showTranslatedTopicTitle ? 'text-slate-600' : 'text-blue-600'}`} />
                </button>
              )
            )}
          </div>
        )}

        {/* Current Version */}
        <Card className="bg-white border-2 border-blue-500">
          <CardHeader className="bg-blue-50">
            <CardTitle className="flex items-center justify-between">
              <span>{t('currentVersion')}</span>
              <Badge className="bg-blue-600">{t('current')}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <TranslatableContent
              content={section.content}
              entity={section}
              entityType="section"
              onUpdate={(updated) => {
                queryClient.setQueryData(['section', sectionId], updated);
              }}
              className="prose prose-sm max-w-none text-slate-700"
            />
            <div className={`text-xs text-slate-500 mt-4 pt-4 border-t ${isRTL ? 'text-right' : ''}`}>
              {t('lastUpdate')}: {new Date(section.updated_date).toLocaleString(language === 'en' ? 'en-US' : language === 'ar' ? 'ar-EG' : 'he-IL')}
            </div>
          </CardContent>
        </Card>

        {/* Version History */}
        {versionGroups.length > 0 ? (
          <div className="space-y-6">
            <h2 className={`text-xl font-bold text-slate-900 ${isRTL ? 'text-right' : ''}`}>{t('previousVersions')}</h2>
            {versionGroups.map((group, groupIndex) => {
              const latestVersion = group.versions[0];
              const previousVersion = group.versions[1];
              
              return (
                <Card key={groupIndex} className="bg-white border-slate-200">
                  <CardHeader className="border-b border-slate-100">
                    <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div>
                        <CardTitle className="text-lg">
                          {t('version')} {latestVersion.version}
                        </CardTitle>
                        <p className="text-sm text-slate-600 mt-1">
                          {latestVersion.changeDescription || t('noDescription')}
                        </p>
                      </div>
                      <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <Badge variant="outline">
                          {latestVersion.changeType === 'suggestion_accepted' ? t('suggestionAccepted') :
                           latestVersion.changeType === 'section_created' ? t('sectionCreated') :
                           t('directEdit')}
                        </Badge>
                        {group.suggestionId && (
                          <Link to={`${createPageUrl("SuggestionDetail")}?id=${group.suggestionId}`}>
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                              <MessageSquare className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                              {t('viewFullDiscussion')}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    {/* Show diff between this version and the previous one */}
                    {previousVersion && latestVersion.changeType === 'suggestion_accepted' && (
                      <div>
                        <h3 className={`text-sm font-semibold text-slate-700 mb-2 ${isRTL ? 'text-right' : ''}`}>{t('changesInVersion')}</h3>
                        <SectionDiff
                          originalContent={previousVersion.content}
                          newContent={latestVersion.content}
                        />
                      </div>
                    )}

                    {/* Show suggestion details if available */}
                    {group.suggestionId && (
                      <SuggestionDetails 
                        suggestionId={group.suggestionId}
                        user={user}
                        getUserName={getUserName}
                        showComments={showComments}
                        toggleComments={toggleComments}
                      />
                    )}

                    <div className={`text-xs text-slate-500 pt-4 border-t ${isRTL ? 'text-right' : ''}`}>
                      {t('createdOn')} {new Date(latestVersion.created_date).toLocaleString(language === 'en' ? 'en-US' : language === 'ar' ? 'ar-EG' : 'he-IL')}
                      {latestVersion.created_by && ` ${t('by')} ${getUserName(latestVersion.created_by)}`}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-white border-slate-200">
            <CardContent className="p-12 text-center">
              <History className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{t('noPreviousVersions')}</p>
              <p className="text-sm text-slate-400 mt-2">{t('changesWillBeSaved')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Component to display suggestion details
function SuggestionDetails({ suggestionId, user, getUserName, showComments, toggleComments }) {
  const { t, isRTL, language } = useLanguage();
  const queryClient = useQueryClient();
  const { data: suggestion } = useQuery({
    queryKey: ['suggestion', suggestionId],
    queryFn: () => base44.entities.Suggestion.filter({ id: suggestionId }).then(s => s[0]),
    enabled: !!suggestionId,
  });

  const { data: comments } = useQuery({
    queryKey: ['suggestionComments', suggestionId],
    queryFn: () => base44.entities.Comment.filter({ 
      rootEntityType: 'suggestion',
      rootEntityId: suggestionId 
    }),
    initialData: [],
    enabled: !!suggestionId,
  });

  if (!suggestion) {
    return null;
  }

  return (
    <div className="space-y-4 bg-blue-50/50 p-4 rounded-lg border border-blue-200">
      {suggestion.explanation && (
        <div>
          <h3 className={`text-sm font-semibold text-slate-700 mb-2 ${isRTL ? 'text-right' : ''}`}>{t('suggestionExplanation')}</h3>
          <p className={`text-sm text-slate-600 ${isRTL ? 'text-right' : ''}`}>{suggestion.explanation}</p>
        </div>
      )}

      <div className={`flex items-center justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-green-600 font-semibold">{suggestion.proVotes || 0}</span>
            <span className="text-slate-500">{t('pro')}</span>
          </div>
          <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-red-600 font-semibold">{suggestion.conVotes || 0}</span>
            <span className="text-slate-500">{t('con')}</span>
          </div>
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
            {suggestion.status === 'accepted' ? t('accepted') : suggestion.status}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleComments(suggestionId)}
          className="text-slate-600 hover:text-blue-600"
        >
          <MessageSquare className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
          {t('comments')} ({comments.length})
        </Button>
      </div>

      {showComments[suggestionId] && (
        <div className="mt-4 pt-4 border-t border-blue-300">
          <CommentsSection
            entityType="suggestion"
            entityId={suggestionId}
            user={user}
          />
        </div>
      )}

      <div className={`space-y-1 ${isRTL ? 'text-right' : ''}`}>
        <div className="text-xs text-slate-500">
          {t('publishedBy')} {getUserName(suggestion.created_by)} {t('on')} {new Date(suggestion.created_date).toLocaleString(language === 'en' ? 'en-US' : language === 'ar' ? 'ar-EG' : 'he-IL')}
        </div>
        {suggestion.status === 'accepted' && suggestion.updated_date && (
          <div className="text-xs text-green-600 font-medium">
            {t('acceptedOn')} {new Date(suggestion.updated_date).toLocaleString(language === 'en' ? 'en-US' : language === 'ar' ? 'ar-EG' : 'he-IL')}
          </div>
        )}
      </div>
    </div>
  );
}