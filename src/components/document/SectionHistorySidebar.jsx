import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, History, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";
import SectionDiff from "./SectionDiff";
import CommentsSection from "./CommentsSection";
import TranslatableContent from "./TranslatableContent";

export default function SectionHistorySidebar({ sectionId, isOpen, onClose }) {
  const { t, isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState({});

  const { data: section, isLoading: sectionLoading } = useQuery({
    queryKey: ['section', sectionId],
    queryFn: () => base44.entities.Section.filter({ id: sectionId }).then(s => s[0]),
    enabled: !!sectionId && isOpen,
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
    enabled: !!sectionId && isOpen,
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

  if (!isOpen) return null;

  // Sort versions by version number descending and pair each with its previous version
  const sortedVersions = [...versions].sort((a, b) => b.version - a.version);
  
  // Create version groups - each version paired with the one before it for diff display
  const versionGroups = sortedVersions.map((version, index) => {
    const previousVersion = sortedVersions[index + 1]; // The older version
    return {
      version,
      previousVersion,
      suggestionId: version.suggestionId,
      changeDescription: version.changeDescription
    };
  });

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className={`fixed inset-y-0 ${isRTL ? 'right-0' : 'left-0'} w-full max-w-2xl bg-white shadow-2xl z-50 overflow-y-auto`}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <History className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">{t('sectionHistory')}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Breadcrumb */}
          {document && topic && (
            <p className={`text-sm text-slate-600 ${isRTL ? 'text-right' : ''}`}>
              <Link to={`${createPageUrl("DocumentView")}?id=${document.id}`} className="hover:underline">
                {document.title}
              </Link>
              {' > '}
              {topic.title}
            </p>
          )}

          {(sectionLoading || versionsLoading) ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : !section ? (
            <div className="text-center py-12">
              <p className="text-slate-500">{t('sectionNotFound')}</p>
            </div>
          ) : (
            <>
              {/* Current Version */}
              <Card className="border-2 border-blue-500">
                <CardHeader className="bg-blue-50 p-4">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>{t('currentVersion')}</span>
                    <Badge className="bg-blue-600 text-xs">{t('current')}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
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
                <div className="space-y-4">
                  <h3 className="text-base font-bold text-slate-900">{t('previousVersions')}</h3>
                  {versionGroups.filter(g => g.version && g.version.changeType).map((group, groupIndex) => {
                    const currentVer = group.version;
                    const prevVer = group.previousVersion;
                    const isOldestVersion = groupIndex === versionGroups.length - 1;
                    
                    return (
                      <Card key={groupIndex} className="border-slate-200">
                        <CardHeader className="border-b border-slate-100 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <CardTitle className="text-sm">
                                {t('version')} {currentVer.version}
                              </CardTitle>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {currentVer.changeType === 'suggestion_accepted' ? t('suggestionAccepted') :
                                 currentVer.changeType === 'section_created' ? t('sectionCreated') :
                                 t('directEdit')}
                              </Badge>
                              {group.suggestionId && (
                                <Link to={`${createPageUrl("SuggestionDetail")}?id=${group.suggestionId}`}>
                                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7">
                                    <MessageSquare className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                                    {t('viewFullDiscussion')}
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                          {/* Show content for direct edits or oldest version */}
                          {(currentVer.changeType === 'direct_edit' || currentVer.changeType === 'section_created' || isOldestVersion) && (
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                              <TranslatableContent
                                content={currentVer.content}
                                entity={currentVer}
                                entityType="DocumentVersion"
                                onUpdate={(updated) => {
                                  queryClient.setQueryData(['versions', sectionId], (old) => 
                                    old?.map(v => v.id === currentVer.id ? updated : v)
                                  );
                                }}
                                className="prose prose-sm max-w-none text-slate-700"
                              />
                            </div>
                          )}
                          
                          {/* Show diff between this version and the previous one */}
                          {prevVer && currentVer.changeType === 'suggestion_accepted' && !isOldestVersion && (
                            <div>
                              <h4 className="text-xs font-semibold text-slate-700 mb-2">{t('changesInThisVersion')}</h4>
                              <SectionDiff
                                originalContent={prevVer.content}
                                newContent={currentVer.content}
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
                              users={users}
                            />
                          )}

                          <div className="text-xs text-slate-500 pt-3 border-t">
                            {t('created')} {new Date(currentVer.created_date).toLocaleString()}
                            {currentVer.created_by && ` ${t('by')} ${getUserName(currentVer.created_by)}`}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="border-slate-200">
                  <CardContent className="p-8 text-center">
                    <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">{t('noPreviousVersions')}</p>
                    <p className="text-xs text-slate-400 mt-2">{t('sectionChangesAutomaticallySaved')}</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// Component to display suggestion details
function SuggestionDetails({ suggestionId, user, getUserName, showComments, toggleComments, users }) {
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
    <div className="space-y-3 bg-blue-50/50 p-3 rounded-lg border border-blue-200">
      {suggestion.explanation && (
        <div>
          <h4 className="text-xs font-semibold text-slate-700 mb-1">{t('explanationForSuggestion')}</h4>
          <TranslatableContent
            content={suggestion.explanation}
            entity={suggestion}
            entityType="Suggestion"
            fieldName="explanation"
            className="text-xs text-slate-600"
          />
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-green-600 font-semibold">{suggestion.proVotes || 0}</span>
            <span className="text-slate-500">{t('pro')}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-red-600 font-semibold">{suggestion.conVotes || 0}</span>
            <span className="text-slate-500">{t('con')}</span>
          </div>
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-xs">
            {suggestion.status === 'accepted' ? t('accepted') : t(suggestion.status)}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleComments(suggestionId)}
          className="text-slate-600 hover:text-blue-600 text-xs h-7"
        >
          <MessageSquare className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
          {t('comments')} ({comments.length})
        </Button>
      </div>

      {showComments[suggestionId] && (
        <div className="mt-3 pt-3 border-t border-blue-300">
          <CommentsSection
            entityType="suggestion"
            entityId={suggestionId}
            user={user}
          />
        </div>
      )}

      <div className="text-xs text-slate-500">
        {t('publishedBy')} <Link to={`${createPageUrl("Profile")}?userId=${users?.find(u => u.email === suggestion.created_by)?.id}`} className="hover:underline text-blue-600">{getUserName(suggestion.created_by)}</Link> • {t('created')} {new Date(suggestion.created_date).toLocaleString()}
        {suggestion.status === 'accepted' && suggestion.updated_date && (
          <span className="text-green-600 font-medium block mt-1">
            {t('acceptedOn')} {new Date(suggestion.updated_date).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}