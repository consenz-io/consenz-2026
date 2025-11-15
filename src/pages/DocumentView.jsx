import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Users, TrendingUp, MessageSquare, Plus, ArrowLeft, History, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";

import DocumentContent from "../components/document/DocumentContent";
import SuggestionsList from "../components/document/SuggestionsList";
import CreateSuggestionModal from "../components/document/CreateSuggestionModal";
import PointsDebugger from "../components/document/PointsDebugger";

export default function DocumentView() {
  const { t, isRTL } = useLanguage();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('id');
  const scrollToSectionId = searchParams.get('scrollTo');
  const [showCreateSuggestion, setShowCreateSuggestion] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [activeTab, setActiveTab] = useState("document");

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

  useEffect(() => {
    if (scrollToSectionId && sections.length > 0) {
      setTimeout(() => {
        const element = window.document.getElementById(`section-${scrollToSectionId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
          }, 2000);
        }
      }, 300);
    }
  }, [scrollToSectionId, sections]);

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6 overflow-x-hidden">
        <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
          <Skeleton className="h-10 md:h-12 w-48 md:w-64" />
          <Skeleton className="h-24 md:h-32 w-full" />
          <Skeleton className="h-48 md:h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6 overflow-x-hidden">
        <div className="max-w-6xl mx-auto text-center py-12 md:py-20">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 px-4">{t('documentNotFound')}</h1>
          <Link to={createPageUrl("Home")}>
            <Button className="mt-4">{t('goHome')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6 overflow-x-hidden">
      <div className="max-w-6xl mx-auto space-y-4 md:space-y-6 overflow-x-hidden">
        <div className={`flex flex-col gap-3 md:gap-4 ${isRTL ? 'md:flex-row-reverse' : ''} md:flex-row md:justify-between md:items-start`}>
          <div className={`flex items-start gap-2 md:gap-3 ${isRTL ? 'flex-row-reverse' : ''} flex-1 min-w-0`}>
            <Link to={createPageUrl("Home")}>
              <Button variant="outline" size="icon" className="shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-3xl font-bold text-slate-900 break-words leading-tight">{document.title}</h1>
              <div className="flex gap-2 mt-1 md:mt-2 flex-wrap">
                <Badge variant="outline" className={`text-[10px] md:text-xs ${
                  document.privacy === 'public_view_open_participation' 
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {document.privacy.replace(/_/g, ' ')}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-1.5 md:gap-2 flex-wrap w-full md:w-auto">
            {user && (
              <Button
                onClick={() => {
                  setEditingSection({ isNew: true, topicId: topics[0]?.id });
                  setShowCreateSuggestion(true);
                }}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-xs md:text-sm px-2 md:px-4"
                size="sm"
              >
                <Plus className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                <span className="hidden sm:inline">{t('newSuggestion')}</span>
                <span className="sm:hidden">הצעה</span>
              </Button>
            )}
            <Link to={`${createPageUrl("DocumentVersions")}?id=${documentId}`}>
              <Button variant="outline" size="sm" className="text-xs md:text-sm px-2 md:px-4">
                <History className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
                <span className="hidden md:inline">{t('versions')}</span>
              </Button>
            </Link>
            <Link to={`${createPageUrl("DocumentCleanView")}?id=${documentId}`} className="hidden sm:block">
              <Button variant="outline" size="sm" className="text-xs md:text-sm px-2 md:px-4">
                <FileText className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-1 md:ml-2' : 'mr-1 md:mr-2'}`} />
                {t('viewCurrentVersion')}
              </Button>
            </Link>
            {isAdmin && (
              <Link to={`${createPageUrl("DocumentAdmin")}?id=${documentId}`}>
                <Button variant="outline" size="sm" className="text-xs md:text-sm px-2 md:px-4">
                  <Settings className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
                  <span className="hidden md:inline">{t('admin')}</span>
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card className="bg-white/80 backdrop-blur-sm cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all" onClick={() => setActiveTab("document")}>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <Users className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
                <div>
                  <div className="text-xl md:text-2xl font-bold">{document.totalUsersInteracted || 0}</div>
                  <div className="text-[10px] md:text-xs text-slate-600">{t('contributors')}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur-sm cursor-pointer hover:shadow-lg hover:border-indigo-300 transition-all" onClick={() => setActiveTab("suggestions")}>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <MessageSquare className="w-6 h-6 md:w-8 md:h-8 text-indigo-600" />
                <div>
                  <div className="text-xl md:text-2xl font-bold">{suggestions.length}</div>
                  <div className="text-[10px] md:text-xs text-slate-600">{t('suggestions')}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur-sm cursor-pointer hover:shadow-lg hover:border-purple-300 transition-all" onClick={() => setActiveTab("document")}>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <TrendingUp className="w-6 h-6 md:w-8 md:h-8 text-purple-600" />
                <div>
                  <div className="text-xl md:text-2xl font-bold">
                    {((document.avgSuggestionConsensus || 0) * 100).toFixed(0)}%
                  </div>
                  <div className="text-[10px] md:text-xs text-slate-600">{t('consensus')}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur-sm cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all" onClick={() => setActiveTab("document")}>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs md:text-sm">
                  {(() => {
                    const acceptedDocSuggestions = suggestions.filter(s => s.status === 'accepted');
                    if (acceptedDocSuggestions.length === 0) return '0';
                    const avg = acceptedDocSuggestions.reduce((sum, s) => {
                      const total = (s.proVotes || 0) + (s.conVotes || 0);
                      return sum + (total > 0 ? (s.proVotes / total) : 0);
                    }, 0) / acceptedDocSuggestions.length;
                    return (avg * 100).toFixed(0);
                  })()}
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-bold">
                    {(() => {
                      const acceptedDocSuggestions = suggestions.filter(s => s.status === 'accepted');
                      if (acceptedDocSuggestions.length === 0) return '0.0';
                      const avg = acceptedDocSuggestions.reduce((sum, s) => {
                        const total = (s.proVotes || 0) + (s.conVotes || 0);
                        return sum + (total > 0 ? (s.proVotes / total) : 0);
                      }, 0) / acceptedDocSuggestions.length;
                      return avg.toFixed(2);
                    })()}
                  </div>
                  <div className="text-[10px] md:text-xs text-slate-600">{t('threshold')}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 md:space-y-6">
          <TabsList className="bg-white/80 backdrop-blur-sm w-full md:w-auto">
            <TabsTrigger value="document" className="flex-1 md:flex-none text-sm md:text-base">{t('document')}</TabsTrigger>
            <TabsTrigger value="suggestions" className="flex-1 md:flex-none text-sm md:text-base">
              {t('suggestions')} ({suggestions.filter(s => s.status === 'pending').length})
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

      {user && document?.gamificationEnabled && (
        <PointsDebugger userId={user.id} documentId={documentId} />
      )}
    </div>
  );
}