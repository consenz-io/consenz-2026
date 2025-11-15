import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, History, GitCompare, RotateCcw, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import SectionDiff from "../components/document/SectionDiff";
import DocumentVersionHistory from "../components/document/DocumentVersionHistory";
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

  const groupedVersions = versions.reduce((acc, version) => {
    acc[version.sectionId] = acc[version.sectionId] || [];
    acc[version.sectionId].push(version);
    return acc;
  }, {});

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
      case 'suggestion_accepted': return 'הצעה התקבלה';
      case 'direct_edit': return 'עריכה ישירה';
      case 'section_created': return 'סעיף חדש נוצר';
      default: return type;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6 overflow-x-hidden">
      <div className="max-w-6xl mx-auto space-y-4 md:space-y-6 w-full overflow-x-hidden">
        <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
          <div className="flex-1 min-w-0 w-full">
            <PageHeader 
              title={t('versionHistory')}
              backUrl={`${createPageUrl("DocumentView")}?id=${documentId}`}
            />
          </div>
          <Button
            variant={compareMode ? "default" : "outline"}
            onClick={() => {
              setCompareMode(!compareMode);
              setSelectedVersions([]);
            }}
            className="w-full md:w-auto text-xs md:text-sm shrink-0"
            size="sm"
          >
            <GitCompare className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {compareMode ? t('cancelComparison') : t('compareVersions')}
          </Button>
        </div>
        
        {document && (
          <p className={`text-slate-600 ${isRTL ? 'text-right' : ''}`}>{document.title}</p>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {compareMode && selectedVersions.length === 2 && (
          <Card className="bg-white border-blue-200 w-full overflow-hidden">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-base md:text-lg">{t('compareVersions')}</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 overflow-x-hidden">
              <div className="space-y-4">
                <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 ${isRTL ? 'md:grid-flow-col-dense' : ''}`}>
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <Badge className="mb-2 text-xs">{t('version')} {selectedVersions[0].version}</Badge>
                    <p className="text-xs md:text-sm text-slate-600">
                      {new Date(selectedVersions[0].created_date).toLocaleString(isRTL ? 'he-IL' : 'en-US')}
                    </p>
                  </div>
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <Badge className="mb-2 text-xs">{t('version')} {selectedVersions[1].version}</Badge>
                    <p className="text-xs md:text-sm text-slate-600">
                      {new Date(selectedVersions[1].created_date).toLocaleString(isRTL ? 'he-IL' : 'en-US')}
                    </p>
                  </div>
                </div>
                <SectionDiff
                  key={`compare-${selectedVersions[0].id}-${selectedVersions[1].id}`}
                  originalContent={selectedVersions[0].content}
                  newContent={selectedVersions[1].content}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6 md:space-y-8">
          {versions.length === 0 ? (
            <Card className="bg-white border-slate-200 w-full overflow-hidden">
              <CardContent className="p-6 md:p-12 text-center">
                <History className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg md:text-xl font-semibold text-slate-900 mb-2">{t('noPreviousVersions')}</h3>
                <p className="text-sm md:text-base text-slate-600">{t('documentChangesSavedAutomatically')}</p>
              </CardContent>
            </Card>
          ) : (
            Object.keys(groupedVersions)
              .sort((a, b) => {
                const sectionA = sections.find(s => s.id === a);
                const sectionB = sections.find(s => s.id === b);
                return (sectionA?.order || 0) - (sectionB?.order || 0);
              })
              .map(sectionId => (
                <DocumentVersionHistory
                  key={sectionId}
                  sectionId={sectionId}
                  sectionName={getSectionName(sectionId)}
                  versions={groupedVersions[sectionId]}
                  isAdmin={isAdmin}
                  getUserName={getUserName}
                  getChangeTypeLabel={getChangeTypeLabel}
                  documentId={documentId}
                  userId={user?.id}
                  setError={setError}
                />
              ))
          )}
        </div>
      </div>
    </div>
  );
}