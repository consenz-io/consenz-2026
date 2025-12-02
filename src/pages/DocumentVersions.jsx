import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, RotateCcw, Clock, MessageSquare, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import SectionDiff from "../components/document/SectionDiff";
import { useLanguage } from "@/components/LanguageContext";
import PageHeader from "../components/PageHeader";

export default function DocumentVersions() {
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('id');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState([]);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();
  const { t, isRTL } = useLanguage();

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

  const { data: versions, isLoading: versionsLoading } = useQuery({
    queryKey: ['versions', documentId],
    queryFn: () => base44.entities.DocumentVersion.filter({ documentId }, '-created_date'),
    initialData: [],
    enabled: !!documentId,
  });

  const { data: topics } = useQuery({
    queryKey: ['topics', documentId],
    queryFn: () => base44.entities.Topic.filter({ documentId }),
    initialData: [],
    enabled: !!documentId,
  });

  const { data: topicEditSuggestions } = useQuery({
    queryKey: ['topicEditSuggestions', documentId],
    queryFn: () => base44.entities.TopicEditSuggestion.filter({ documentId, status: 'accepted' }, '-created_date'),
    initialData: [],
    enabled: !!documentId,
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: isAdmin } = useQuery({
    queryKey: ['isAdmin', documentId, user?.id],
    queryFn: async () => {
      if (!user?.id || !documentId) return false;
      const admins = await base44.entities.DocumentAdmin.filter({ documentId, userId: user.id });
      return admins.length > 0;
    },
    enabled: !!user?.id && !!documentId,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const getUserName = (email) => {
    const user = users.find(u => u.email === email);
    return user?.full_name || email;
  };

  const restoreVersionMutation = useMutation({
    mutationFn: async (version) => {
      if (!isAdmin) throw new Error("Admin access required");
      
      const section = sections.find(s => s.id === version.sectionId);
      if (!section) throw new Error("Section not found");

      // Save current state as new version before restoring
      const allVersions = await base44.entities.DocumentVersion.filter({ sectionId: section.id });
      const nextVersion = allVersions.length > 0 ? Math.max(...allVersions.map(v => v.version)) + 1 : 1;
      
      await base44.entities.DocumentVersion.create({
        documentId,
        sectionId: section.id,
        content: section.content,
        changeDescription: `שוחזר מגרסה ${version.version}`,
        version: nextVersion,
        changeType: 'direct_edit'
      });

      await base44.entities.Section.update(section.id, {
        content: version.content,
        lastEditedBy: user.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections', documentId] });
      queryClient.invalidateQueries({ queryKey: ['versions', documentId] });
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  });

  const handleVersionSelect = (version) => {
    if (!compareMode) return;
    
    if (selectedVersions.find(v => v.id === version.id)) {
      setSelectedVersions(selectedVersions.filter(v => v.id !== version.id));
    } else if (selectedVersions.length < 2) {
      setSelectedVersions([...selectedVersions, version]);
    }
  };

  const getSectionName = (sectionId) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return "Unknown Section";
    
    const sectionIndex = sections
      .filter(s => s.topicId === section.topicId)
      .sort((a, b) => a.order - b.order)
      .findIndex(s => s.id === sectionId);
    
    return `Section ${sectionIndex + 1}`;
  };

  // מיון וסינון כפילויות - כל הגרסאות ברשימה אחת ממוינת לפי תאריך
  const allVersionsSorted = [...versions]
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .filter((version, index, arr) => {
      if (index === arr.length - 1) return true;
      const nextVersion = arr.find(v => v.sectionId === version.sectionId && new Date(v.created_date) < new Date(version.created_date));
      return !nextVersion || version.content !== nextVersion.content;
    });

  // מיפוי גרסאות עם הגרסה הקודמת שלהן
  const versionGroups = allVersionsSorted.map((version) => {
    const previousVersion = allVersionsSorted.find(
      v => v.sectionId === version.sectionId && new Date(v.created_date) < new Date(version.created_date)
    );
    return { version, previousVersion };
  });

  if (docLoading || versionsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6 overflow-x-hidden">
        <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
          <Skeleton className="h-10 md:h-12 w-48 md:w-64" />
          <Skeleton className="h-64 md:h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6 overflow-x-hidden">
        <div className="max-w-6xl mx-auto text-center py-12 md:py-20">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Document not found</h1>
          <Link to={createPageUrl("Home")}>
            <Button className="mt-4">Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const getChangeTypeLabel = (type) => {
    switch (type) {
      case 'suggestion_accepted': return t('suggestionAccepted');
      case 'direct_edit': return t('directEdit');
      case 'section_created': return t('sectionCreated');
      case 'topic_title_changed': return t('topicTitleChanged') || 'כותרת נושא שונתה';
      default: return type;
    }
  };

  const getTopicName = (topicId) => {
    const topic = topics.find(t => t.id === topicId);
    return topic?.title || 'Unknown Topic';
  };

  const restoreVersionMutation = useMutation({
    mutationFn: async (versionToRestore) => {
      if (!isAdmin) throw new Error(t("adminAccessRequired"));

      const allSectionVersions = await base44.entities.DocumentVersion.filter({ sectionId: versionToRestore.sectionId });
      const nextVersion = allSectionVersions.length > 0 ? Math.max(...allSectionVersions.map(v => v.version)) + 1 : 1;

      const currentSection = sections.find(s => s.id === versionToRestore.sectionId);
      if (!currentSection) throw new Error("Section not found");

      await base44.entities.DocumentVersion.create({
        documentId,
        sectionId: versionToRestore.sectionId,
        content: currentSection.content,
        changeDescription: t("restoredFromVersion", { version: versionToRestore.version }),
        version: nextVersion,
        changeType: 'direct_edit'
      });

      await base44.entities.Section.update(versionToRestore.sectionId, {
        content: versionToRestore.content,
        lastEditedBy: user?.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections', documentId] });
      queryClient.invalidateQueries({ queryKey: ['versions', documentId] });
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6 overflow-x-hidden">
      <div className="max-w-6xl mx-auto space-y-4 md:space-y-6 w-full overflow-x-hidden">
        <PageHeader 
          title={t('versionHistory')}
          backUrl={`${createPageUrl("DocumentView")}?id=${documentId}`}
        />
        
        {document && (
          <p className={`text-slate-600 ${isRTL ? 'text-right' : ''}`}>{document.title}</p>
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
              const sectionTopic = topics.find(t => t.id === sections.find(s => s.id === currentVer.sectionId)?.topicId);
              
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
                          {sectionTopic && (
                            <Badge variant="outline" className="bg-slate-50">
                              {sectionTopic.title}
                            </Badge>
                          )}
                          {currentVer.suggestionId && (
                            <Link to={`${createPageUrl("SuggestionDetail")}?id=${currentVer.suggestionId}`}>
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
                      <div className="flex items-center gap-2">
                        <Link to={`${createPageUrl("DocumentView")}?id=${documentId}&scrollTo=${currentVer.sectionId}`}>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                            {t('viewInDocument')}
                          </Button>
                        </Link>
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
                    </div>
                  </CardHeader>
                  <CardContent>
                    {prevVer ? (
                      <SectionDiff
                        key={`${currentVer.id}-${prevVer.id}`}
                        originalContent={prevVer.content}
                        newContent={currentVer.content}
                        documentId={documentId}
                        sectionId={currentVer.sectionId}
                      />
                    ) : (
                      <div
                        className="prose prose-sm max-w-none text-slate-700 p-4 bg-slate-50 rounded-lg"
                        style={{ direction: isRTL ? 'rtl' : 'ltr', textAlign: isRTL ? 'right' : 'left' }}
                        dangerouslySetInnerHTML={{ __html: currentVer.content }}
                      />
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
              <p className="text-sm md:text-base text-slate-600">{t('documentChangesSavedAutomatically')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}