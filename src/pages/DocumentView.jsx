import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Settings, Users, TrendingUp, MessageSquare, Plus, ArrowLeft, ArrowRight, History, FileText, Languages, Loader2, Edit2, Save, X, CheckCircle, ChevronLeft, ChevronRight, MoreVertical, Bell } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/components/LanguageContext";
import ReactQuill from "react-quill";

import DocumentContent from "../components/document/DocumentContent";
import CreateSuggestionModal from "../components/document/CreateSuggestionModal";
import PageHeader from "../components/PageHeader";
import ContributorsModal from "../components/document/ContributorsModal";
import CommentsSection from "../components/document/CommentsSection";
import SuggestionSidebar from "../components/document/SuggestionSidebar";
import { calculateContributorsFromData } from "../components/document/calculateContributors";
import { TranslationProvider } from "../components/document/TranslationContext";
import TranslateAllButton from "../components/document/TranslateAllButton";
import DocumentAgreementModal from "../components/document/DocumentAgreementModal";
import SignersListModal from "../components/document/SignersListModal";
import FollowDocumentButton from "../components/document/FollowDocumentButton";

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
  const openSuggestionFromUrl = searchParams.get('openSuggestion');
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
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [showSignersListModal, setShowSignersListModal] = useState(false);
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const [targetSuggestionId, setTargetSuggestionId] = useState(null);
  const [showSuggestionNav, setShowSuggestionNav] = useState(false);

  // Polling interval for live sync (10 seconds for better responsiveness)
  const SYNC_INTERVAL = 10000;

  const { data: document, isLoading: docLoading } = useQuery({
    queryKey: ['document', documentId],
    queryFn: async () => {
      const docs = await base44.entities.Document.filter({ id: documentId });
      return docs && docs.length > 0 ? docs[0] : null;
    },
    enabled: !!documentId,
    refetchInterval: SYNC_INTERVAL,
    refetchIntervalInBackground: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
    staleTime: 5000,
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

  const { data: allVotes } = useQuery({
    queryKey: ['allVotes'],
    queryFn: () => base44.entities.Vote.list(),
    initialData: [],
    enabled: !!documentId,
    staleTime: 30000,
  });

  const { data: allUsers } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
    staleTime: 60000,
  });

  const { data: allArguments } = useQuery({
    queryKey: ['allArguments'],
    queryFn: () => base44.entities.Argument.list(),
    initialData: [],
    staleTime: 30000,
  });

  const { data: allComments } = useQuery({
    queryKey: ['allComments'],
    queryFn: () => base44.entities.Comment.list(),
    initialData: [],
    staleTime: 30000,
  });

  const { data: documentComments } = useQuery({
    queryKey: ['documentComments', documentId],
    queryFn: () => base44.entities.Comment.filter({ 
      rootEntityType: 'document',
      rootEntityId: documentId 
    }),
    initialData: [],
    enabled: !!documentId,
    refetchInterval: SYNC_INTERVAL,
    refetchIntervalInBackground: false,
  });

  const { data: documentAgreements } = useQuery({
    queryKey: ['documentAgreements', documentId],
    queryFn: () => base44.entities.DocumentAgreement.filter({ documentId }),
    initialData: [],
    enabled: !!documentId,
  });

  // Count all section comments for this document
  const sectionCommentsCount = React.useMemo(() => {
    const sectionIds = sections.map(s => s.id);
    return allComments.filter(c => 
      c.rootEntityType === 'section' && sectionIds.includes(c.rootEntityId)
    ).length;
  }, [allComments, sections]);

  // Calculate real contributors count using shared logic
  const contributorsCount = React.useMemo(() => {
    return calculateContributorsFromData({
      document,
      suggestions,
      allVotes,
      allUsers,
      allArguments,
      allComments,
      sections
    });
  }, [document, suggestions, allVotes, allUsers, allArguments, allComments, sections]);

  // Get pending suggestions ordered by section appearance
  const pendingSuggestions = React.useMemo(() => {
    if (!suggestions || !sections || !topics) return [];
    
    return suggestions
      .filter(s => s.status === 'pending')
      .sort((a, b) => {
        // Sort by topic order first
        const topicA = topics.find(t => t.id === a.topicId);
        const topicB = topics.find(t => t.id === b.topicId);
        const topicOrderA = topicA?.order ?? 999;
        const topicOrderB = topicB?.order ?? 999;
        
        if (topicOrderA !== topicOrderB) {
          return topicOrderA - topicOrderB;
        }
        
        // Then by section order
        if (a.type === 'edit_section' && b.type === 'edit_section') {
          const sectionA = sections.find(s => s.id === a.sectionId);
          const sectionB = sections.find(s => s.id === b.sectionId);
          const orderA = sectionA?.order ?? 999;
          const orderB = sectionB?.order ?? 999;
          return orderA - orderB;
        }
        
        // edit_section before new_section
        if (a.type === 'edit_section') return -1;
        if (b.type === 'edit_section') return 1;
        
        return 0;
      });
  }, [suggestions, sections, topics]);

  const scrollToSuggestion = (index) => {
    const suggestion = pendingSuggestions[index];
    if (!suggestion) return;
    
    // אם זו הצעה לעריכת סעיף - צריך לגלול לסעיף ולהעביר את הקרוסלה
    if (suggestion.type === 'edit_section') {
      setTargetSuggestionId(suggestion.id);
      
      // המתן רגע קצר שהקרוסלה תעדכן את ה-ID שלה, ואז גלול
      setTimeout(() => {
        const element = window.document.getElementById(`suggestion-${suggestion.id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-4', 'ring-blue-500', 'ring-offset-4');
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-4');
            setTargetSuggestionId(null);
          }, 2000);
        } else {
          // אם לא מצאנו עדיין, נסה שוב אחרי delay נוסף
          setTimeout(() => {
            const retryElement = window.document.getElementById(`suggestion-${suggestion.id}`);
            if (retryElement) {
              retryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              retryElement.classList.add('ring-4', 'ring-blue-500', 'ring-offset-4');
              setTimeout(() => {
                retryElement.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-4');
                setTargetSuggestionId(null);
              }, 2000);
            }
          }, 300);
        }
      }, 200);
    } else {
      // הצעה לסעיף חדש - גלילה רגילה
      const elementId = `suggestion-${suggestion.id}`;
      setTimeout(() => {
        const element = window.document.getElementById(elementId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-4', 'ring-blue-500', 'ring-offset-4');
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-4');
          }, 2000);
        }
      }, 100);
    }
  };

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

  const userHasAgreed = React.useMemo(() => {
    if (!user?.id) return false;
    return documentAgreements.some(a => a.userId === user.id);
  }, [documentAgreements, user?.id]);

  const signAgreementMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Must be logged in');
      await base44.entities.DocumentAgreement.create({
        documentId,
        userId: user.id,
        userEmail: user.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentAgreements', documentId] });
      setShowAgreementModal(false);
    },
  });

  const removeSignatureMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Must be logged in');
      const userAgreement = documentAgreements.find(a => a.userId === user.id);
      if (userAgreement) {
        await base44.entities.DocumentAgreement.delete(userAgreement.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentAgreements', documentId] });
    },
  });

  React.useEffect(() => {
    if (document) {
      setDescription(document.description || "");
    }
  }, [document]);

  useEffect(() => {
    if (scrollToSectionId) {
      setTimeout(() => {
        // Try both section-X and new-suggestion-X patterns
        let element = window.document.getElementById(scrollToSectionId.startsWith('section-') || scrollToSectionId.startsWith('new-suggestion-') 
          ? scrollToSectionId 
          : `section-${scrollToSectionId}`
        );
        
        // If not found, try the alternative pattern
        if (!element && scrollToSectionId.startsWith('new-suggestion-')) {
          element = window.document.getElementById(scrollToSectionId);
        }
        
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
          }, 2000);
        } else {
          // Retry after a longer delay if suggestions haven't loaded yet
          setTimeout(() => {
            const retryElement = window.document.getElementById(scrollToSectionId.startsWith('section-') || scrollToSectionId.startsWith('new-suggestion-') 
              ? scrollToSectionId 
              : `section-${scrollToSectionId}`
            );
            if (retryElement) {
              retryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              retryElement.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
              setTimeout(() => {
                retryElement.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
              }, 2000);
            }
          }, 1000);
        }
      }, 300);
    }
  }, [scrollToSectionId, sections, suggestions]);

  // Scroll to topic from URL hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && topics.length > 0) {
      setTimeout(() => {
        const element = window.document.querySelector(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Add highlight effect
          element.classList.add('ring-4', 'ring-blue-500', 'ring-offset-4');
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-4');
          }, 2000);
        }
      }, 300);
    }
  }, [topics]);

  // Open suggestion sidebar from URL param
  useEffect(() => {
    if (openSuggestionFromUrl && !openSuggestionId) {
      setOpenSuggestionId(openSuggestionFromUrl);
    }
  }, [openSuggestionFromUrl]);

  const handleEditSection = (section, isDirectEdit = false) => {
    setEditingSection(isDirectEdit ? { ...section, isDirectEdit: true } : section);
    setShowCreateSuggestion(true);
  };

  const handleNewSection = (topicId, insertPosition) => {
    // מציאת ה-order של הנושא הנוכחי
    const currentTopic = topics.find(t => t.id === topicId);
    const topicOrder = currentTopic?.order;
    setEditingSection({ topicId, insertPosition, isNew: true, topicOrder });
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
    <TranslationProvider>
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

          {/* Document Discussion and Comments */}
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
                <div className="flex gap-2 flex-wrap mt-3 pt-3 border-t border-slate-200 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSignersListModal(true)}
                    className={`h-8 md:h-9 text-xs md:text-sm px-2 md:px-4 font-medium shadow-sm ${
                      userHasAgreed 
                        ? 'text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800' 
                        : 'text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle className={`w-4 h-4 ${isRTL ? 'ml-1 md:ml-2' : 'mr-1 md:mr-2'} ${userHasAgreed ? 'text-emerald-600' : ''}`} />
                    <span className="hidden sm:inline">{language === 'he' ? 'חתומים' : language === 'ar' ? 'الموقعون' : 'Signers'}</span>
                    <span className={isRTL ? 'mr-1' : 'ml-1'}>({documentAgreements.length})</span>
                    {userHasAgreed && <span className="hidden sm:inline text-emerald-600 mr-1 ml-1">✓</span>}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDescriptionComments(!showDescriptionComments)}
                    className="text-blue-700 border-blue-300 bg-blue-50 hover:bg-blue-100 hover:text-blue-800 h-8 md:h-9 text-xs md:text-sm px-2 md:px-4 font-medium shadow-sm"
                  >
                    <MessageSquare className={`w-4 h-4 ${isRTL ? 'ml-1 md:ml-2' : 'mr-1 md:mr-2'}`} />
                    <span className="hidden sm:inline">{t('documentDiscussion')}</span>
                    <span className="sm:hidden">{language === 'he' ? 'דיון' : language === 'ar' ? 'نقاش' : 'Discuss'}</span>
                    {documentComments.length > 0 && <span className={isRTL ? 'mr-1' : 'ml-1'}>({documentComments.length})</span>}
                  </Button>
                  <Link to={`${createPageUrl("DocumentComments")}?id=${documentId}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-indigo-700 border-indigo-300 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-800 h-8 md:h-9 text-xs md:text-sm px-2 md:px-4 font-medium shadow-sm"
                    >
                      <MessageSquare className={`w-4 h-4 ${isRTL ? 'ml-1 md:ml-2' : 'mr-1 md:mr-2'}`} />
                      <span className="hidden sm:inline">{t('sectionComments')}</span>
                      <span className="sm:hidden">{language === 'he' ? 'תגובות' : language === 'ar' ? 'تعليقات' : 'Comments'}</span>
                      <span className="ml-1">({sectionCommentsCount})</span>
                    </Button>
                  </Link>
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

          <div className="flex justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs md:text-sm px-4 h-9">
                    <MoreVertical className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {language === 'he' ? 'תפריט' : language === 'ar' ? 'القائمة' : 'Menu'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56">
                  <DropdownMenuItem onSelect={() => setShowCreateSuggestion(true)}>
                    <Plus className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('newSuggestion')}
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem onSelect={() => setShowSignersListModal(true)}>
                    <CheckCircle className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'} ${userHasAgreed ? 'text-emerald-600' : ''}`} />
                    {language === 'he' ? 'חתומים' : language === 'ar' ? 'الموقعون' : 'Signers'} ({documentAgreements.length})
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onSelect={() => setShowDescriptionComments(!showDescriptionComments)}>
                    <MessageSquare className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('documentDiscussion')}
                    {documentComments.length > 0 && ` (${documentComments.length})`}
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem asChild>
                    <Link to={`${createPageUrl("DocumentComments")}?id=${documentId}`} className="flex items-center">
                      <MessageSquare className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                      {t('sectionComments')} ({sectionCommentsCount})
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem asChild>
                    <Link to={`${createPageUrl("DocumentCleanView")}?id=${documentId}`} className="flex items-center">
                      <FileText className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                      {t('cleanView')}
                    </Link>
                  </DropdownMenuItem>
                  
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to={`${createPageUrl("DocumentAdmin")}?id=${documentId}`} className="flex items-center">
                          <Settings className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                          {t('admin')}
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
        </div>

        <div className="grid grid-cols-3 gap-3 md:gap-4 w-full max-w-full">
          <div 
            className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg p-2 md:p-3 cursor-pointer hover:border-blue-400 transition-all flex flex-col items-center justify-center gap-1"
            onClick={() => setShowContributorsModal(true)}
          >
            <Users className="w-4 h-4 md:w-6 md:h-6 text-blue-600" />
            <div className="text-base md:text-xl font-bold text-slate-900">{contributorsCount}</div>
            <div className="text-[9px] md:text-xs text-slate-600 text-center leading-tight">{t('contributors')}</div>
          </div>
          <div 
            className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-400 rounded-lg p-2 md:p-3 cursor-pointer hover:border-indigo-600 hover:shadow-lg transition-all flex flex-col items-center justify-center gap-1 relative overflow-hidden"
            onClick={() => {
              if (pendingSuggestions.length > 0) {
                setShowSuggestionNav(true);
                scrollToSuggestion(currentSuggestionIndex);
              }
            }}
          >
            {pendingSuggestions.length > 0 && (
              <div className="absolute top-1 right-1">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                </span>
              </div>
            )}
            <MessageSquare className="w-5 h-5 md:w-7 md:h-7 text-indigo-600" />
            <div className="text-lg md:text-2xl font-bold text-indigo-900">{pendingSuggestions.length}</div>
            <div className="text-[10px] md:text-sm text-indigo-700 text-center leading-tight font-medium">{language === 'he' ? 'הצעות פתוחות' : language === 'ar' ? 'مقترحات مفتوحة' : 'Open Suggestions'}</div>
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
            targetSuggestionId={targetSuggestionId}
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

      <DocumentAgreementModal
        isOpen={showAgreementModal}
        onClose={() => setShowAgreementModal(false)}
        onConfirm={() => signAgreementMutation.mutate()}
        isLoading={signAgreementMutation.isPending}
      />

      <SignersListModal
        isOpen={showSignersListModal}
        onClose={() => setShowSignersListModal(false)}
        signers={documentAgreements}
        allUsers={allUsers}
        user={user}
        userHasAgreed={userHasAgreed}
        onJoinClick={() => {
          setShowSignersListModal(false);
          setShowAgreementModal(true);
        }}
        onRemoveSignature={() => removeSignatureMutation.mutate()}
        isRemoving={removeSignatureMutation.isPending}
      />

      {/* Floating navigation for suggestions */}
      {pendingSuggestions.length > 0 && showSuggestionNav && (
        <div className="fixed bottom-20 right-6 z-40 flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 border border-slate-200">
          <Button
            size="sm"
            variant="default"
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg h-10 px-3"
            onClick={() => {
              const newIndex = currentSuggestionIndex === 0 
                ? pendingSuggestions.length - 1 
                : currentSuggestionIndex - 1;
              setCurrentSuggestionIndex(newIndex);
              scrollToSuggestion(newIndex);
            }}
          >
            {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
          <span className="text-sm font-medium text-slate-700 px-2">
            {currentSuggestionIndex + 1} / {pendingSuggestions.length}
          </span>
          <Button
            size="sm"
            variant="default"
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg h-10 px-3"
            onClick={() => {
              const newIndex = (currentSuggestionIndex + 1) % pendingSuggestions.length;
              setCurrentSuggestionIndex(newIndex);
              scrollToSuggestion(newIndex);
            }}
          >
            {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      )}
      </div>
    </TranslationProvider>
  );
}