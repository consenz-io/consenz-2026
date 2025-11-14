import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, History, GitCompare, RotateCcw, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import SectionDiff from "../components/document/SectionDiff";

export default function DocumentVersions() {
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('id');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState([]);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

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

  if (docLoading || versionsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto text-center py-20">
          <h1 className="text-2xl font-bold text-slate-900">Document not found</h1>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to={`${createPageUrl("DocumentView")}?id=${documentId}`}>
              <Button variant="outline" size="icon">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">היסטוריית גרסאות</h1>
              <p className="text-slate-600 mt-1">{document.title}</p>
            </div>
          </div>
          <Button
            variant={compareMode ? "default" : "outline"}
            onClick={() => {
              setCompareMode(!compareMode);
              setSelectedVersions([]);
            }}
          >
            <GitCompare className="w-4 h-4 mr-2" />
            {compareMode ? 'בטל השוואה' : 'השווה גרסאות'}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {compareMode && selectedVersions.length === 2 && (
          <Card className="bg-white border-blue-200">
            <CardHeader>
              <CardTitle>השוואת גרסאות</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <Badge className="mb-2">גרסה {selectedVersions[0].version}</Badge>
                    <p className="text-sm text-slate-600">
                      {new Date(selectedVersions[0].created_date).toLocaleString('he-IL')}
                    </p>
                  </div>
                  <div>
                    <Badge className="mb-2">גרסה {selectedVersions[1].version}</Badge>
                    <p className="text-sm text-slate-600">
                      {new Date(selectedVersions[1].created_date).toLocaleString('he-IL')}
                    </p>
                  </div>
                </div>
                <SectionDiff
                  originalContent={selectedVersions[0].content}
                  newContent={selectedVersions[1].content}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {versions.length === 0 ? (
            <Card className="bg-white border-slate-200">
              <CardContent className="p-12 text-center">
                <History className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">אין גרסאות קודמות</h3>
                <p className="text-slate-600">שינויים במסמך ישמרו אוטומטית כגרסאות</p>
              </CardContent>
            </Card>
          ) : (
            versions.map((version, index) => (
              <Card
                key={version.id}
                className={`bg-white border-slate-200 hover:shadow-lg transition-all ${
                  compareMode && selectedVersions.find(v => v.id === version.id)
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : ''
                } ${compareMode ? 'cursor-pointer' : ''}`}
                onClick={() => handleVersionSelect(version)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">גרסה {version.version}</Badge>
                        <Badge className="bg-blue-100 text-blue-800">
                          {getSectionName(version.sectionId)}
                        </Badge>
                        <Badge variant="outline">{getChangeTypeLabel(version.changeType)}</Badge>
                      </div>
                      <CardTitle className="text-lg">{version.changeDescription || 'שינוי ללא תיאור'}</CardTitle>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(version.created_date).toLocaleString('he-IL')}
                        </div>
                        <span>על ידי {getUserName(version.created_by)}</span>
                      </div>
                    </div>
                    {isAdmin && !compareMode && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm('האם לשחזר גרסה זו? הגרסה הנוכחית תישמר בהיסטוריה.')) {
                            restoreVersionMutation.mutate(version);
                          }
                        }}
                        disabled={restoreVersionMutation.isPending}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        שחזר גרסה
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {index < versions.length - 1 ? (
                    <SectionDiff
                      originalContent={versions[index + 1].content}
                      newContent={version.content}
                    />
                  ) : (
                    <div 
                      className="prose prose-sm max-w-none text-slate-700 p-4 bg-slate-50 rounded-lg"
                      dangerouslySetInnerHTML={{ __html: version.content }}
                    />
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}