import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, MessageSquare, Clock, RotateCcw, ExternalLink, Languages, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/components/LanguageContext";
import SectionDiff from "../components/document/SectionDiff";
import CommentsSection from "../components/document/CommentsSection";
import TranslatableContent from "../components/document/TranslatableContent";
import PageHeader from "../components/PageHeader";

const detectLanguage = (text) => {
  if (!text) return 'en';
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  const cleanText = text.replace(/<[^>]*>/g, '');
  if (hebrewPattern.test(cleanText)) return 'he';
  if (arabicPattern.test(cleanText)) return 'ar';
  return 'en';
};

export default function SectionHistory() {
  const { t, isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const sectionId = searchParams.get('id');
  const [showComments, setShowComments] = useState({});
  const [error, setError] = useState(null);

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

  const { data: isAdmin } = useQuery({
    queryKey: ['isAdmin', document?.id, user?.id],
    queryFn: async () => {
      if (!user?.id || !document?.id) return false;
      const admins = await base44.entities.DocumentAdmin.filter({ documentId: document.id, userId: user.id });
      return admins.length > 0;
    },
    enabled: !!user?.id && !!document?.id,
  });

  const restoreVersionMutation = useMutation({
    mutationFn: async (versionToRestore) => {
      if (!isAdmin) throw new Error(t("adminAccessRequired"));

      const allSectionVersions = await base44.entities.DocumentVersion.filter({ sectionId });
      const nextVersion = allSectionVersions.length > 0 ? Math.max(...allSectionVersions.map(v => v.version)) + 1 : 1;

      await base44.entities.DocumentVersion.create({
        documentId: document.id,
        sectionId,
        content: section.content,
        changeDescription: t("restoredFromVersion", { version: versionToRestore.version }),
        version: nextVersion,
        changeType: 'direct_edit'
      });

      await base44.entities.Section.update(sectionId, {
        content: versionToRestore.content,
        lastEditedBy: user.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['section', sectionId] });
      queryClient.invalidateQueries({ queryKey: ['versions', sectionId] });
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
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

  const getChangeTypeLabel = (type) => {
    switch (type) {
      case 'suggestion_accepted': return t('suggestionAccepted');
      case 'direct_edit': return t('directEdit');
      case 'section_created': return t('sectionCreated');
      default: return type;
    }
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

  // Sort versions by version number descending and filter duplicates
  const sortedVersions = [...versions]
    .sort((a, b) => b.version - a.version)
    .filter((version, index, arr) => {
      // הגרסה האחרונה תמיד נשארת
      if (index === arr.length - 1) return true;
      // אם התוכן זהה לגרסה הבאה (הקודמת כרונולוגית), נסנן אותה
      const nextVersion = arr[index + 1];
      return version.content !== nextVersion?.content;
    });
  
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4 md:space-y-6">
        <PageHeader 
          title={t('sectionHistory')}
          backUrl={`${createPageUrl("DocumentView")}?id=${document?.id}&scrollTo=${sectionId}`}
        />
        
        {document && topic && (
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <p className={`text-slate-600 ${isRTL ? 'text-right' : ''}`}>
              <Link to={`${createPageUrl("DocumentView")}?id=${document.id}`} className="hover:underline">
                {document.title}
              </Link>
              {' > '}
              {topic.title}
            </p>
            <Link to={`${createPageUrl("DocumentView")}?id=${document.id}&scrollTo=${sectionId}`}>
              <Button variant="ghost" size="sm">
                <ExternalLink className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t('viewInDocument')}
              </Button>
            </Link>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Version History */}
        {versionGroups.length > 0 ? (
          <div className="space-y-4">
            {versionGroups.filter(g => g.version && g.version.changeType).map((group, groupIndex) => {
              const currentVer = group.version;
              const prevVer = group.previousVersion;
              
              return (
                <Card key={groupIndex} className="bg-white border-slate-200 hover:shadow-lg transition-all">
                  <CardHeader>
                    <div className={`flex justify-between items-start gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className="flex-1">
                        <div className={`flex items-center gap-2 mb-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <Badge variant="outline">{t('version')} {currentVer.version}</Badge>
                          <Badge className="bg-blue-100 text-blue-800">
                            {getChangeTypeLabel(currentVer.changeType)}
                          </Badge>
                          {group.suggestionId && (
                            <Link to={`${createPageUrl("SuggestionDetail")}?id=${group.suggestionId}`}>
                              <Badge className="bg-green-600 hover:bg-green-700 cursor-pointer flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                {t('viewFullDiscussion')}
                              </Badge>
                            </Link>
                          )}
                        </div>
                        <CardTitle className={`text-lg ${isRTL ? 'text-right' : 'text-left'}`}>
                          {typeof currentVer.changeDescription === 'string' 
                            ? currentVer.changeDescription 
                            : (currentVer.changeDescription?.title || t('changeWithoutDescription'))}
                        </CardTitle>
                        <div className={`flex items-center gap-4 mt-2 text-sm text-slate-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <Clock className="w-4 h-4" />
                            {new Date(currentVer.created_date).toLocaleString(isRTL ? 'he-IL' : 'en-US')}
                          </div>
                          {currentVer.created_by && (
                            <span>{t('by')} {getUserName(currentVer.created_by)}</span>
                          )}
                        </div>
                      </div>
                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (confirm(t('confirmRestoreVersion'))) {
                              restoreVersionMutation.mutate(currentVer);
                            }
                          }}
                          disabled={restoreVersionMutation.isPending}
                        >
                          <RotateCcw className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                          {t('restoreVersion')}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {prevVer ? (
                      <SectionDiff
                        key={`${currentVer.id}-${prevVer.id}`}
                        originalContent={prevVer.content}
                        newContent={currentVer.content}
                        documentId={document?.id}
                        sectionId={sectionId}
                      />
                    ) : (
                      <div
                        className="prose prose-sm max-w-none text-slate-700 p-4 bg-slate-50 rounded-lg"
                        style={{ 
                          direction: isRTL ? 'rtl' : 'ltr', 
                          textAlign: isRTL ? 'right' : 'left',
                          fontFamily: "'Times New Roman', 'David Libre', 'Noto Serif', Georgia, serif",
                          fontSize: "1.125rem",
                          lineHeight: "1.8",
                          letterSpacing: "0.01em"
                        }}
                        dangerouslySetInnerHTML={{ __html: currentVer.content }}
                      />
                    )}

                    {/* Show suggestion details if available */}
                    {group.suggestionId && (
                      <div className="mt-4">
                        <SuggestionDetails 
                          suggestionId={group.suggestionId}
                          user={user}
                          getUserName={getUserName}
                          showComments={showComments}
                          toggleComments={toggleComments}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-white border-slate-200">
            <CardContent className="p-6 md:p-12 text-center">
              <History className="w-12 h-12 md:w-16 md:h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg md:text-xl font-semibold text-slate-900 mb-2">{t('noPreviousVersions')}</h3>
              <p className="text-sm md:text-base text-slate-600">{t('sectionChangesAutomaticallySaved')}</p>
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
  
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });
  
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
          {t('publishedBy')} <Link to={`${createPageUrl("Profile")}?userId=${users.find(u => u.email === suggestion.created_by)?.id}`} className="hover:underline text-blue-600">{getUserName(suggestion.created_by)}</Link> • {t('created')} {new Date(suggestion.created_date).toLocaleString()}
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