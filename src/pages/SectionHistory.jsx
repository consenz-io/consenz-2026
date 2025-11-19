import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, History, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";
import SectionDiff from "../components/document/SectionDiff";
import CommentsSection from "../components/document/CommentsSection";
import TranslatableContent from "../components/document/TranslatableContent";
import PageHeader from "../components/PageHeader";

export default function SectionHistory() {
  const { t, isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const sectionId = searchParams.get('id');
  const [showComments, setShowComments] = useState({});

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

  if (sectionLoading || versionsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6">
        <div className="max-w-5xl mx-auto space-y-4 md:space-y-6">
          <Skeleton className="h-10 md:h-12 w-48 md:w-64" />
          <Skeleton className="h-64 md:h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!section) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6">
        <div className="max-w-5xl mx-auto text-center py-12 md:py-20">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 px-4">{t('sectionNotFound')}</h1>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4 md:space-y-6">
        <PageHeader 
          title={t('sectionHistory')}
          backUrl={`${createPageUrl("DocumentView")}?id=${document?.id}&scrollTo=${sectionId}`}
        />
        
        {document && topic && (
          <p className={`text-slate-600 ${isRTL ? 'text-right' : ''}`}>
            <Link to={`${createPageUrl("DocumentView")}?id=${document.id}`} className="hover:underline">
              {document.title}
            </Link>
            {' > '}
            {topic.title}
          </p>
        )}

        {/* Current Version */}
        <Card className="bg-white border-2 border-blue-500 overflow-hidden">
          <CardHeader className="bg-blue-50 p-4 md:p-6">
            <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="text-base md:text-lg">{t('currentVersion')}</span>
              <Badge className="bg-blue-600 text-xs">{t('current')}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6">
            <TranslatableContent
              content={section.content}
              entity={section}
              entityType="section"
              onUpdate={(updated) => {
                queryClient.setQueryData(['section', sectionId], updated);
              }}
              className="prose prose-sm max-w-none text-slate-700"
            />
            <div className="text-xs text-slate-500 mt-4 pt-4 border-t">
              {t('lastUpdate')}: {new Date(section.updated_date).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {/* Version History */}
        {versionGroups.length > 0 ? (
          <div className="space-y-4 md:space-y-6">
            <h2 className="text-lg md:text-xl font-bold text-slate-900 px-2 md:px-0">{t('previousVersions')}</h2>
            {versionGroups.map((group, groupIndex) => {
              const latestVersion = group.versions[0];
              const previousVersion = group.versions[1];
              
              return (
                <Card key={groupIndex} className="bg-white border-slate-200 overflow-hidden">
                  <CardHeader className="border-b border-slate-100 p-4 md:p-6">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-base md:text-lg">
                            {t('version')} {latestVersion.version}
                          </CardTitle>
                          <p className="text-xs md:text-sm text-slate-600 mt-1 break-words">
                            {latestVersion.changeDescription || t('noDescription')}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {latestVersion.changeType === 'suggestion_accepted' ? t('suggestionAccepted') :
                             latestVersion.changeType === 'section_created' ? t('sectionCreated') :
                             t('directEdit')}
                          </Badge>
                          {group.suggestionId && (
                            <Link to={`${createPageUrl("SuggestionDetail")}?id=${group.suggestionId}`}>
                              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8">
                                <MessageSquare className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                                <span className="hidden sm:inline">{t('viewFullDiscussion')}</span>
                                <span className="sm:hidden">{t('comments')}</span>
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 md:p-6 space-y-3 md:space-y-4">
                    {/* Show content for direct edits */}
                    {latestVersion.changeType === 'direct_edit' && (
                      <div className="prose prose-sm max-w-none text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div dangerouslySetInnerHTML={{ __html: latestVersion.content }} />
                      </div>
                    )}
                    
                    {/* Show diff between this version and the previous one */}
                    {previousVersion && latestVersion.changeType === 'suggestion_accepted' && (
                      <div>
                        <h3 className="text-xs md:text-sm font-semibold text-slate-700 mb-2">{t('changesInThisVersion')}</h3>
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

                    <div className="text-[10px] md:text-xs text-slate-500 pt-3 md:pt-4 border-t break-words">
                      {t('created')} {new Date(latestVersion.created_date).toLocaleString()}
                      {latestVersion.created_by && ` ${t('by')} ${getUserName(latestVersion.created_by)}`}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-white border-slate-200">
            <CardContent className="p-6 md:p-12 text-center">
              <History className="w-12 h-12 md:w-16 md:h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-sm md:text-base text-slate-500">{t('noPreviousVersions')}</p>
              <p className="text-xs md:text-sm text-slate-400 mt-2 px-4">{t('sectionChangesAutomaticallySaved')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Component to display suggestion details
function SuggestionDetails({ suggestionId, user, getUserName, showComments, toggleComments }) {
  const { t, isRTL } = useLanguage();
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
    <div className="space-y-3 md:space-y-4 bg-blue-50/50 p-3 md:p-4 rounded-lg border border-blue-200">
      {suggestion.explanation && (
        <div>
          <h3 className="text-xs md:text-sm font-semibold text-slate-700 mb-2">{t('explanationForSuggestion')}</h3>
          <TranslatableContent
            content={suggestion.explanation}
            entity={suggestion}
            entityType="Suggestion"
            className="text-xs md:text-sm text-slate-600 break-words"
          />
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs md:text-sm">
        <div className="flex items-center gap-3 md:gap-4 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-green-600 font-semibold">{suggestion.proVotes || 0}</span>
            <span className="text-slate-500">{t('pro')}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-red-600 font-semibold">{suggestion.conVotes || 0}</span>
            <span className="text-slate-500">{t('con')}</span>
          </div>
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-xs">
            {suggestion.status === 'accepted' ? t('accepted') : suggestion.status}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleComments(suggestionId)}
          className="text-slate-600 hover:text-blue-600 text-xs h-8"
        >
          <MessageSquare className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
          {t('comments')} ({comments.length})
        </Button>
      </div>

      {showComments[suggestionId] && (
        <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-blue-300">
          <CommentsSection
            entityType="suggestion"
            entityId={suggestionId}
            user={user}
          />
        </div>
      )}

      <div className="space-y-1">
        <div className="text-[10px] md:text-xs text-slate-500 break-words">
          {t('publishedBy')} {getUserName(suggestion.created_by)} {t('created')} {new Date(suggestion.created_date).toLocaleString()}
        </div>
        {suggestion.status === 'accepted' && suggestion.updated_date && (
          <div className="text-[10px] md:text-xs text-green-600 font-medium">
            {t('acceptedOn')} {new Date(suggestion.updated_date).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}