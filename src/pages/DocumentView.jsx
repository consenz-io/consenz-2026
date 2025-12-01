import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Settings, Users, TrendingUp, MessageSquare, Plus, ArrowLeft, ArrowRight, History, FileText, Languages, Loader2, Edit2, Save, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";
import ReactQuill from "react-quill";

import DocumentContent from "../components/document/DocumentContent";
import CreateSuggestionModal from "../components/document/CreateSuggestionModal";
import PageHeader from "../components/PageHeader";
import ContributorsModal from "../components/document/ContributorsModal";
import CommentsSection from "../components/document/CommentsSection";
import SuggestionSidebar from "../components/document/SuggestionSidebar";

const detectLanguage = (text) => {
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  
  if (hebrewPattern.test(text)) return 'he';
  if (arabicPattern.test(text)) return 'ar';
  return 'en';
};

export default function DocumentView() {
  const { t, isRTL, language } = useLanguage();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('id');
  const scrollToSectionId = searchParams.get('scrollTo');
  const [showCreateSuggestion, setShowCreateSuggestion] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [showTranslated, setShowTranslated] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showContributorsModal, setShowContributorsModal] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [description, setDescription] = useState("");
  const [showTranslatedDescription, setShowTranslatedDescription] = useState(false);
  const [isTranslatingDescription, setIsTranslatingDescription] = useState(false);
  const [showDescriptionComments, setShowDescriptionComments] = useState(false);
  const [openSuggestionId, setOpenSuggestionId] = useState(null);
  const [newlyCreatedSuggestion, setNewlyCreatedSuggestion] = useState(null);

  // Polling interval for live sync (10 seconds for better responsiveness)
  const SYNC_INTERVAL = 10000;

  const { data: document, isLoading: docLoading } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => base44.entities.Document.filter({ id: documentId }).then(docs => docs[0]),
    enabled: !!documentId,
    refetchInterval: SYNC_INTERVAL,
    refetchIntervalInBackground: false,
  });

  const { data: topics, isLoading: topicsLoading } = useQuery({
    queryKey: ['topics', documentId],
    queryFn: () => base44.entities.Topic.filter({ documentId }, 'order'),
    initialData: [],
    enabled: !!documentId,
    refetchInterval: SYNC_INTERVAL,
    refetchIntervalInBackground: false,
  });

  const { data: sections, isLoading: sectionsLoading } = useQuery({
    queryKey: ['sections', documentId],
    queryFn: () => base44.entities.Section.filter({ documentId }, 'order'),
    initialData: [],
    enabled: !!documentId,
    refetchInterval: SYNC_INTERVAL,
    refetchIntervalInBackground: false,
  });

  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['suggestions', documentId],
    queryFn: () => base44.entities.Suggestion.filter({ documentId }, '-created_date'),
    initialData: [],
    enabled: !!documentId,
    refetchInterval: SYNC_INTERVAL,
    refetchIntervalInBackground: false,
  });

  const { data: documentComments } = useQuery({
    queryKey: ['documentComments', documentId],
    queryFn: () => base44.entities.Comment.filter({ 
      rootEntityType: 'document',
      rootEntityId: documentId 
    }),
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

  React.useEffect(() => {
    if (document) {
      setDescription(document.description || "");
    }
  }, [document]);

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

  const handleEditSection = (section, isDirectEdit = false) => {
    setEditingSection(isDirectEdit ? { ...section, isDirectEdit: true } : section);
    setShowCreateSuggestion(true);
  };

  const handleNewSection = (topicId, insertPosition) => {
    setEditingSection({ topicId, isNew: true, insertPosition });
    setShowCreateSuggestion(true);
  };

  const languagePrompts = {
    en: "English",
    he: "Hebrew",
    ar: "Arabic"
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
      setIsTranslating(true);
      setShowTranslated(true);
    },
    onSuccess: (newTranslations) => {
      setIsTranslating(false);
      queryClient.setQueryData(['document', documentId], (oldData) => {
        if (!oldData) return oldData;
        return { ...oldData, translations: newTranslations };
      });
    },
    onError: () => {
      setIsTranslating(false);
    }
  });

  const updateDescriptionMutation = useMutation({
    mutationFn: async (newDescription) => {
      await base44.entities.Document.update(documentId, {
        description: newDescription
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      setIsEditingDescription(false);
    },
  });

  const translateDescriptionMutation = useMutation({
    mutationFn: async () => {
      const descPrompt = `Translate the following HTML text to ${languagePrompts[language]}. Return ONLY the translated HTML, preserving all HTML tags:\n${document.description}`;
      const descResult = await base44.integrations.Core.InvokeLLM({
        prompt: descPrompt,
        add_context_from_internet: false,
      });
      const translatedDescription = (typeof descResult === 'string' ? descResult : descResult.content || descResult).trim();

      const newTranslations = {
        ...(document.translations || {}),
        [language]: {
          ...(document.translations?.[language] || {}),
          description: translatedDescription
        }
      };

      await base44.entities.Document.update(document.id, {
        translations: newTranslations
      });

      return newTranslations;
    },
    onMutate: () => {
      setIsTranslatingDescription(true);
      setShowTranslatedDescription(true);
    },
    onSuccess: (newTranslations) => {
      setIsTranslatingDescription(false);
      queryClient.setQueryData(['document', documentId], (oldData) => {
        if (!oldData) return oldData;
        return { ...oldData, translations: newTranslations };
      });
    },
    onError: () => {
      setIsTranslatingDescription(false);
    }
  });

  if (docLoading || topicsLoading || sectionsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-1 md:p-6 w-full max-w-full overflow-x-hidden">
      <div className="max-w-6xl mx-auto space-y-2 md:space-y-6 px-1 md:px-4 w-full max-w-full">
        <div className="flex flex-col gap-1.5 md:gap-4 w-full max-w-full">
          <div className={`flex items-center justify-between gap-1 w-full max-w-full ${isRTL ? 'flex-row-reverse' : ''}`}>
            <h1 className="text-lg md:text-3xl font-bold text-slate-900 flex-1 min-w-0 break-words leading-tight max-w-full">
              {(() => {
                const translatedTitle = document.translations?.[language]?.title;
                if (showTranslated && typeof translatedTitle === 'string') {
                  return translatedTitle;
                }
                return document.title;
              })()}
            </h1>
            {(() => {
              const detectedLanguage = document.originalLanguage || detectLanguage(document.title);
              const needsTranslation = detectedLanguage && detectedLanguage !== language;
              return needsTranslation && (
                <div className="flex-shrink-0">
                  {isTranslating ? (
                    <Loader2 className="w-3.5 h-3.5 md:w-5 md:h-5 animate-spin text-blue-600" />
                  ) : !(typeof document.translations?.[language]?.title === 'string') ? (
                    <button
                      onClick={() => translateDocumentMutation.mutate()}
                      className="p-0.5 md:p-1.5 hover:bg-blue-50 rounded transition-colors"
                      title={t('translate')}
                    >
                      <Languages className="w-3.5 h-3.5 md:w-5 md:h-5 text-blue-600" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowTranslated(!showTranslated)}
                      className="p-0.5 md:p-1.5 hover:bg-slate-100 rounded transition-colors"
                      title={showTranslated ? t('showOriginal') : t('showTranslation')}
                    >
                      <Languages className={`w-3.5 h-3.5 md:w-5 md:h-5 ${showTranslated ? 'text-slate-600' : 'text-blue-600'}`} />
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="flex gap-0.5 md:gap-2 flex-wrap justify-center w-full">
            <Badge variant="outline" className={`text-[7px] md:text-xs px-0.5 py-0.5 ${
              document.privacy === 'public_view_open_participation' 
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {document.privacy === 'public_view_open_participation' 
                ? t('publicViewOpenParticipation')
                : document.privacy === 'public_view_closed_participation'
                ? t('publicViewClosedParticipation')
                : t('privateInviteOnly')}
            </Badge>
          </div>

          {/* Document Description */}
          {(document.description || isAdmin) && (
            <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg p-4 relative">
              {document.originalLanguage && document.originalLanguage !== language && !isEditingDescription && (
                <div className="absolute top-2 left-2 z-10">
                  {isTranslatingDescription ? (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  ) : !(typeof document.translations?.[language]?.description === 'string') ? (
                    <button
                      onClick={() => translateDescriptionMutation.mutate()}
                      className="p-1.5 hover:bg-blue-50 rounded transition-colors"
                      title={t('translate')}
                    >
                      <Languages className="w-4 h-4 text-blue-600" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowTranslatedDescription(!showTranslatedDescription)}
                      className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                      title={showTranslatedDescription ? t('showOriginal') : t('showTranslation')}
                    >
                      <Languages className={`w-4 h-4 ${showTranslatedDescription ? 'text-slate-600' : 'text-blue-600'}`} />
                    </button>
                  )}
                </div>
              )}
              {isEditingDescription ? (
                <div className="space-y-3">
                  <ReactQuill
                    value={description}
                    onChange={setDescription}
                    className="bg-white"
                    modules={{
                      toolbar: [
                        ['bold', 'italic', 'underline'],
                        ['link'],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        ['clean']
                      ]
                    }}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDescription(document.description || "");
                        setIsEditingDescription(false);
                      }}
                    >
                      <X className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                      {t('cancel')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => updateDescriptionMutation.mutate(description)}
                      disabled={updateDescriptionMutation.isPending}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600"
                    >
                      <Save className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                      {t('saveChanges')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="relative group">
                  {document.description ? (
                    <div 
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ 
                        __html: showTranslatedDescription && typeof document.translations?.[language]?.description === 'string'
                          ? document.translations[language].description
                          : document.description
                      }}
                      dir={isRTL ? 'rtl' : 'ltr'}
                    />
                  ) : (
                    <p className="text-slate-400 text-sm italic">{t('noDescription')}</p>
                  )}
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingDescription(true)}
                      className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
              {!isEditingDescription && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDescriptionComments(!showDescriptionComments)}
                    className="text-blue-700 border-blue-300 bg-blue-50 hover:bg-blue-100 hover:text-blue-800 h-8 md:h-9 text-sm px-4 font-medium shadow-sm"
                  >
                    <MessageSquare className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('generalDocumentDiscussion')} ({documentComments.length})
                  </Button>
                </div>
              )}
              {showDescriptionComments && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <CommentsSection
                    entityType="document"
                    entityId={documentId}
                    user={user}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 md:gap-3 flex-wrap justify-center">
            <Link to={`${createPageUrl("DocumentVersions")}?id=${documentId}`} className="flex-shrink-0">
              <Button variant="outline" size="sm" className="text-xs md:text-sm px-3 md:px-4 h-8 md:h-9">
                <History className={`w-4 h-4 ${isRTL ? 'ml-1.5 md:ml-2' : 'mr-1.5 md:mr-2'}`} />
                <span>{t('versions')}</span>
              </Button>
            </Link>
            <Link to={`${createPageUrl("DocumentCleanView")}?id=${documentId}`} className="flex-shrink-0">
              <Button variant="outline" size="sm" className="text-xs md:text-sm px-3 md:px-4 h-8 md:h-9">
                <FileText className={`w-4 h-4 ${isRTL ? 'ml-1.5 md:ml-2' : 'mr-1.5 md:mr-2'}`} />
                <span>{t('cleanView')}</span>
              </Button>
            </Link>
            {isAdmin && (
              <Link to={`${createPageUrl("DocumentAdmin")}?id=${documentId}`} className="flex-shrink-0">
                <Button variant="outline" size="sm" className="text-xs md:text-sm px-3 md:px-4 h-8 md:h-9">
                  <Settings className={`w-4 h-4 ${isRTL ? 'ml-1.5 md:ml-2' : 'mr-1.5 md:mr-2'}`} />
                  <span>{t('admin')}</span>
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 md:gap-4 w-full max-w-full">
          <div 
            className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg p-2 md:p-3 cursor-pointer hover:border-blue-400 transition-all flex flex-col items-center justify-center gap-1"
            onClick={() => setShowContributorsModal(true)}
          >
            <Users className="w-4 h-4 md:w-6 md:h-6 text-blue-600" />
            <div className="text-base md:text-xl font-bold text-slate-900">{document.totalUsersInteracted || 0}</div>
            <div className="text-[9px] md:text-xs text-slate-600 text-center leading-tight">{t('contributors')}</div>
          </div>
          <div 
            className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg p-2 md:p-3 flex flex-col items-center justify-center gap-1"
          >
            <MessageSquare className="w-4 h-4 md:w-6 md:h-6 text-indigo-600" />
            <div className="text-base md:text-xl font-bold text-slate-900">{suggestions.length}</div>
            <div className="text-[9px] md:text-xs text-slate-600 text-center leading-tight">{t('suggestions')}</div>
          </div>
          <Link 
            to={`${createPageUrl("UnderstandingConsensus")}?id=${documentId}`}
            className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg p-2 md:p-3 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-purple-400 transition-all"
          >
            <TrendingUp className="w-4 h-4 md:w-6 md:h-6 text-purple-600" />
            <div className="text-base md:text-xl font-bold text-slate-900">
              {(() => {
                const consensuses = document.consensuses || [];
                if (consensuses.length === 0) return '0';
                const avg = consensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / consensuses.length;
                return (Math.min(100, avg * 100)).toFixed(0);
              })()}%
            </div>
            <div className="text-[9px] md:text-xs text-slate-600 text-center leading-tight">{t('consensus')}</div>
          </Link>
        </div>

        <DocumentContent
            document={document}
            topics={topics}
            sections={sections}
            suggestions={suggestions}
            onEditSection={handleEditSection}
            onNewSection={handleNewSection}
            isAdmin={isAdmin}
            user={user}
            onDirectEdit={(section) => handleEditSection(section, true)}
            onOpenSuggestionSidebar={(suggestionId) => setOpenSuggestionId(suggestionId)}
            newlyCreatedSuggestion={newlyCreatedSuggestion}
            onClearNewlyCreated={() => setNewlyCreatedSuggestion(null)}
          />
      </div>

      {showCreateSuggestion && (
        <CreateSuggestionModal
          document={document}
          topics={topics}
          sections={sections}
          editingSection={editingSection}
          user={user}
          isAdmin={isAdmin}
          onClose={() => {
            setShowCreateSuggestion(false);
            setEditingSection(null);
          }}
          onSuggestionCreated={(suggestionId, sectionId, topicId) => {
            setNewlyCreatedSuggestion({ suggestionId, sectionId, topicId });
          }}
        />
      )}

      <ContributorsModal
        isOpen={showContributorsModal}
        onClose={() => setShowContributorsModal(false)}
        documentId={documentId}
      />

      {openSuggestionId && (
        <SuggestionSidebar
          suggestionId={openSuggestionId}
          onClose={() => setOpenSuggestionId(null)}
          document={document}
          user={user}
          isAdmin={isAdmin}
        />
      )}
      </div>
  );
}