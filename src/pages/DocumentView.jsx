import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Users, TrendingUp, MessageSquare, Plus, ArrowLeft, History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

import DocumentContent from "../components/document/DocumentContent";
import SuggestionsList from "../components/document/SuggestionsList";
import CreateSuggestionModal from "../components/document/CreateSuggestionModal";

export default function DocumentView() {
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('id');
  const [showCreateSuggestion, setShowCreateSuggestion] = useState(false);
  const [editingSection, setEditingSection] = useState(null);

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

  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['suggestions', documentId],
    queryFn: () => base44.entities.Suggestion.filter({ documentId }, '-created_date'),
    initialData: [],
    enabled: !!documentId,
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
    staleTime: 0,
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

  const handleEditSection = (section) => {
    setEditingSection(section);
    setShowCreateSuggestion(true);
  };

  const handleNewSection = (topicId, insertPosition) => {
    setEditingSection({ topicId, isNew: true, insertPosition });
    setShowCreateSuggestion(true);
  };

  if (docLoading || topicsLoading || sectionsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <Link to={createPageUrl("Home")}>
              <Button variant="outline" size="icon">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{document.title}</h1>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className={
                  document.privacy === 'public_view_open_participation' 
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }>
                  {document.privacy.replace(/_/g, ' ')}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {user && (
              <Button
                onClick={() => {
                  setEditingSection({ isNew: true, topicId: topics[0]?.id });
                  setShowCreateSuggestion(true);
                }}
                className="bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Suggestion
              </Button>
            )}
            <Link to={`${createPageUrl("DocumentVersions")}?id=${documentId}`}>
              <Button variant="outline">
                <History className="w-4 h-4 mr-2" />
                גרסאות
              </Button>
            </Link>
            {isAdmin && (
              <Link to={`${createPageUrl("DocumentAdmin")}?id=${documentId}`}>
                <Button variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Admin
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold">{document.totalUsersInteracted || 0}</div>
                  <div className="text-xs text-slate-600">Contributors</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-8 h-8 text-indigo-600" />
                <div>
                  <div className="text-2xl font-bold">{suggestions.length}</div>
                  <div className="text-xs text-slate-600">Suggestions</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-purple-600" />
                <div>
                  <div className="text-2xl font-bold">
                    {((document.avgSuggestionConsensus || 0) * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-slate-600">Consensus</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold">
                  {document.threshold?.toFixed(0) || 0}
                </div>
                <div>
                  <div className="text-2xl font-bold">{document.threshold?.toFixed(1) || 0}</div>
                  <div className="text-xs text-slate-600">Threshold</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="document" className="space-y-6">
          <TabsList className="bg-white/80 backdrop-blur-sm">
            <TabsTrigger value="document">Document</TabsTrigger>
            <TabsTrigger value="suggestions">
              Suggestions ({suggestions.filter(s => s.status === 'pending').length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="document">
            <DocumentContent
              document={document}
              topics={topics}
              sections={sections}
              suggestions={suggestions}
              onEditSection={handleEditSection}
              onNewSection={handleNewSection}
              isAdmin={isAdmin}
              user={user}
            />
          </TabsContent>

          <TabsContent value="suggestions">
            <SuggestionsList
              suggestions={suggestions}
              document={document}
              user={user}
              isAdmin={isAdmin}
            />
          </TabsContent>
        </Tabs>
      </div>

      {showCreateSuggestion && (
        <CreateSuggestionModal
          document={document}
          topics={topics}
          sections={sections}
          editingSection={editingSection}
          user={user}
          onClose={() => {
            setShowCreateSuggestion(false);
            setEditingSection(null);
          }}
        />
      )}
    </div>
  );
}