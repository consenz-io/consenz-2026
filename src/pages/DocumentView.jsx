import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Settings, Users, TrendingUp, MessageSquare, Plus, ArrowLeft, ArrowRight, History, FileText, Languages, Loader2, Edit2, Save, X, CheckCircle, ChevronLeft, ChevronRight, MoreVertical, Bell, BellOff } from "lucide-react";
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
  const { t, isRTL, language: rawLanguage } = useLanguage();
  const language = rawLanguage || 'he';
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
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);

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

  // Load accepted suggestions as "sections" - they serve the same purpose when accepted
  const { data: sections, isLoading: sectionsLoading } = useQuery({
    queryKey: ['sections', documentId],
    queryFn: async () => {
      // Get all accepted suggestions that are functioning as sections
      const acceptedSuggestions = await base44.entities.Suggestion.filter({ 
        documentId, 
        status: 'accepted',
        type: ['new_section', 'edit_section']
      }, 'order');
      return acceptedSuggestions;
    },
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

  // Count all comments on accepted suggestions (which function as sections)
  const sectionCommentsCount = React.useMemo(() => {
    const sectionIds = sections.map(s => s.id);
    return allComments.filter(c => 
      c.suggestionId && sectionIds.includes(c.suggestionId)
    ).length;
  }, [allComments, sections]);

  // Calculate real contributors count using shared logic
  const contributorsCount = React.useMemo(() => {
    return calculateContributorsFromData({
      document,
      suggestions,
      allVotes,
      allUsers,
      allComments,
      sections,
      documentAgreements
    });
  }, [document, suggestions, allVotes, allUsers, allComments, sections, documentAgreements]);

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

  const scrollToSuggestion = React.useCallback((index) => {
    const suggestion = pendingSuggestions[index];
    if (!suggestion || !document) return;

    setTargetSuggestionId(suggestion.id);

    // Find the suggestion card in DocumentContent by looking for the section carousel containing it
    const scrollWithRetry = (attemptCount = 0) => {
      // Look for the suggestion card by searching through the page
      const allSectionCarousels = document.querySelectorAll('[id^="suggestion-"]');
      let foundElement = null;

      // Check all carousels for the suggestion we need
      allSectionCarousels.forEach(el => {
        if (el.textContent && el.textContent.includes(suggestion.id)) {
          foundElement = el;
        }
      });

      if (!foundElement) {
        // Fallback: try to find any element with the suggestion ID
        foundElement = document.querySelector(`div[class*="carousel"]`);
      }

      if (foundElement) {
        // Scroll to the section carousel that contains this suggestion
        window.scrollTo({ 
          top: foundElement.getBoundingClientRect().top + window.scrollY - 100,
          behavior: 'smooth'
        });
        foundElement.classList.add('ring-4', 'ring-blue-500');
        setTimeout(() => {
          foundElement.classList.remove('ring-4', 'ring-blue-500');
        }, 2000);
      } else if (attemptCount < 5) {
        setTimeout(() => scrollWithRetry(attemptCount + 1), 300);
      }
    };

    setTimeout(() => scrollWithRetry(), 100);
  }, [pendingSuggestions]);

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

  const { data: following } = useQuery({
    queryKey: ['documentFollow', documentId, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const follows = await base44.entities.DocumentFollow.filter({
        documentId,
        userId: user.id
      });
      return follows.length > 0 ? follows[0] : null;
    },
    enabled: !!user?.id && !!documentId,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (following) {
        await base44.entities.DocumentFollow.delete(following.id);
      } else {
        await base44.entities.DocumentFollow.create({
          documentId,
          userId: user.id,
          followedAt: new Date().toISOString()
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentFollow', documentId, user?.id] });
    },
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
    if (scrollToSectionId && typeof window !== 'undefined' && typeof document !== 'undefined' && document.getElementById) {
      setTimeout(() => {
        // Try both section-X and new-suggestion-X patterns
        let element = document.getElementById(scrollToSectionId.startsWith('section-') || scrollToSectionId.startsWith('new-suggestion-') 
          ? scrollToSectionId 
          : `section-${scrollToSectionId}`
        );
        
        // If not found, try the alternative pattern
        if (!element && scrollToSectionId.startsWith('new-suggestion-')) {
          element = document.getElementById(scrollToSectionId);
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
            const retryElement = document.getElementById(scrollToSectionId.startsWith('section-') || scrollToSectionId.startsWith('new-suggestion-') 
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
    if (typeof window === 'undefined' || typeof document === 'undefined' || !document.querySelector) return;
    const hash = window.location.hash;
    if (hash && topics.length > 0) {
      setTimeout(() => {
        const element = document.querySelector(hash);
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

  // Track scroll position for showing floating buttons
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-1 md:p-6 w-full max-w-full overflow-x-hidden pb-24">
      <div className="max-w-6xl mx-auto space-y-2 md:space-y-6 px-1 md:px-4 w-full max-w-full">
        <div className="flex flex-col gap-1.5 md:gap-4 w-full max-w-full">
          <div className={`flex items-center justify-between gap-1 w-full max-w-full ${isRTL ? 'flex-row-reverse' : ''}`}>
            <h1 id="document-title" className="text-lg md:text-3xl font-bold text-slate-900 flex-1 min-w-0 break-words leading-tight max-w-full">
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
                      type="button"
                      onClick={() => translateDocumentMutation.mutate()}
                      className="p-0.5 md:p-1.5 hover:bg-blue-50 rounded transition-colors"
                      aria-label={t('translate')}
                    >
                      <Languages className="w-3.5 h-3.5 md:w-5 md:h-5 text-blue-600" aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowTranslated(!showTranslated)}
                      className="p-0.5 md:p-1.5 hover:bg-slate-100 rounded transition-colors"
                      aria-label={showTranslated ? t('showOriginal') : t('showTranslation')}
                    >
                      <Languages className={`w-3.5 h-3.5 md:w-5 md:h-5 ${showTranslated ? 'text-slate-600' : 'text-blue-600'}`} aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="flex gap-2 items-center justify-between w-full">
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
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs md:text-sm px-4 h-8">
                  <MoreVertical className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {language === 'he' ? 'תפריט' : language === 'ar' ? 'القائمة' : 'Menu'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                
                <DropdownMenuItem onSelect={() => followMutation.mutate()} disabled={!user}>
                  {following ? <BellOff className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} /> : <Bell className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />}
                  {following 
                    ? (language === 'he' ? 'הפסק מעקב' : language === 'ar' ? 'إلغاء المتابعة' : 'Unfollow')
                    : (language === 'he' ? 'עקוב' : language === 'ar' ? 'متابعة' : 'Follow')}
                </DropdownMenuItem>
                
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
                
                <DropdownMenuItem>
                  <div className="w-full" id="translate-all-wrapper">
                    <TranslateAllButton 
                      document={document} 
                      topics={topics} 
                      sections={sections} 
                    />
                  </div>
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
                    <>
                      {(() => {
                        const currentDescription = showTranslatedDescription && typeof document.translations?.[language]?.description === 'string'
                          ? document.translations[language].description
                          : document.description;
                        
                        const readMoreMarker = '<!-- READ_MORE -->';
                        const hasMarker = currentDescription.includes(readMoreMarker);
                        
                        if (hasMarker) {
                          const parts = currentDescription.split(readMoreMarker);
                          const beforeMarker = parts[0];
                          const afterMarker = parts.slice(1).join('');
                          
                          return (
                            <>
                              <div 
                                className="prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: beforeMarker }}
                                dir={isRTL ? 'rtl' : 'ltr'}
                              />
                              {!showFullDescription ? (
                                <Button
                                  variant="link"
                                  size="sm"
                                  onClick={() => setShowFullDescription(true)}
                                  className="mt-2 p-0 h-auto text-blue-600 hover:text-blue-800"
                                >
                                  {language === 'he' ? 'קרא עוד' : language === 'ar' ? 'اقرأ المزيد' : 'Read more'}
                                </Button>
                              ) : (
                                <>
                                  <div 
                                    className="prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: afterMarker }}
                                    dir={isRTL ? 'rtl' : 'ltr'}
                                  />
                                  <Button
                                   variant="link"
                                   size="sm"
                                   onClick={() => {
                                     setShowFullDescription(false);
                                     setTimeout(() => {
                                       if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.getElementById) {
                                         const titleElement = document.getElementById('document-title');
                                         if (titleElement) {
                                           titleElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                         }
                                       }
                                     }, 50);
                                   }}
                                   className="mt-2 p-0 h-auto text-blue-600 hover:text-blue-800"
                                  >
                                   {language === 'he' ? 'הצג פחות' : language === 'ar' ? 'عرض أقل' : 'Show less'}
                                  </Button>
                                </>
                              )}
                            </>
                          );
                        } else {
                          const stripHtml = currentDescription.replace(/<[^>]*>/g, '');
                          const hasLongContent = stripHtml.length > 600;
                          
                          return (
                            <>
                              <div 
                                className="prose prose-sm max-w-none relative"
                                dir={isRTL ? 'rtl' : 'ltr'}
                              >
                                <div
                                  className={!showFullDescription && hasLongContent ? 'max-h-[15rem] overflow-hidden relative' : ''}
                                  dangerouslySetInnerHTML={{ __html: currentDescription }}
                                />
                                {!showFullDescription && hasLongContent && (
                                  <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                                )}
                              </div>
                              {hasLongContent && (
                                <Button
                                  variant="link"
                                  size="sm"
                                  onClick={() => {
                                   if (showFullDescription) {
                                     setShowFullDescription(false);
                                     setTimeout(() => {
                                       if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.getElementById) {
                                         const titleElement = document.getElementById('document-title');
                                         if (titleElement) {
                                           titleElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                         }
                                       }
                                     }, 50);
                                   } else {
                                     setShowFullDescription(true);
                                   }
                                  }}
                                  className="mt-2 p-0 h-auto text-blue-600 hover:text-blue-800"
                                >
                                  {showFullDescription 
                                    ? (language === 'he' ? 'הצג פחות' : language === 'ar' ? 'عرض أقل' : 'Show less')
                                    : (language === 'he' ? 'קרא עוד' : language === 'ar' ? 'اقرأ المزيد' : 'Read more')}
                                </Button>
                              )}
                            </>
                          );
                        }
                      })()}
                    </>
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

              {showDescriptionComments && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  {/* Removed document comments for now - focus on suggestion comments */}
                </div>
              )}
            </div>


        </div>

        <div className="grid grid-cols-3 gap-3 md:gap-4 w-full max-w-full">
          <button
            type="button"
            className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg p-2 md:p-3 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-blue-400 hover:shadow-lg transition-all"
            onClick={() => setShowContributorsModal(true)}
            aria-label={`${contributorsCount} ${t('contributors')}. ${language === 'he' ? 'לחץ לצפייה ברשימה' : 'Click to view list'}`}
          >
            <Users className="w-4 h-4 md:w-6 md:h-6 text-blue-600" aria-hidden="true" />
            <div className="text-base md:text-xl font-bold text-slate-900">{contributorsCount}</div>
            <div className="text-[9px] md:text-xs text-slate-600 text-center leading-tight">{t('contributors')}</div>
          </button>
          <button
            type="button"
            className={`bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-400 rounded-lg p-2 md:p-3 hover:border-indigo-600 hover:shadow-lg transition-all flex flex-col items-center justify-center gap-1 relative overflow-hidden ${pendingSuggestions.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
            onClick={() => {
              if (pendingSuggestions.length > 0) {
                setShowSuggestionNav(true);
                setCurrentSuggestionIndex(0);
                setTimeout(() => scrollToSuggestion(0), 100);
              }
            }}
            aria-label={`${pendingSuggestions.length} ${language === 'he' ? 'הצעות פתוחות' : 'open suggestions'}. ${pendingSuggestions.length > 0 ? (language === 'he' ? 'לחץ לניווט להצעות' : 'Click to navigate to suggestions') : ''}`}
          >
            {pendingSuggestions.length > 0 && (
              <div className="absolute top-1 right-1">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                </span>
              </div>
            )}
            <MessageSquare className="w-5 h-5 md:w-7 md:h-7 text-indigo-600" aria-hidden="true" />
            <div className="text-lg md:text-2xl font-bold text-indigo-900">{pendingSuggestions.length}</div>
            <div className="text-[10px] md:text-sm text-indigo-700 text-center leading-tight font-medium">{language === 'he' ? 'הצעות פתוחות' : language === 'ar' ? 'مقترحات مفتوحة' : 'Open Suggestions'}</div>
          </button>
          <Link 
            to={`${createPageUrl("UnderstandingConsensus")}?id=${documentId}`}
            className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg p-2 md:p-3 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-purple-400 transition-all"
            aria-label={`${(() => {
              const consensuses = document.consensuses || [];
              if (consensuses.length === 0) return '0';
              const avg = consensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / consensuses.length;
              return (Math.min(100, avg * 100)).toFixed(0);
            })()}% ${t('consensus')}. ${language === 'he' ? 'לחץ להסבר על הקונצנזוס' : 'Click to learn about consensus'}`}
          >
            <TrendingUp className="w-4 h-4 md:w-6 md:h-6 text-purple-600" aria-hidden="true" />
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
          isDeletingSuggestion={editingSection?.isDeletingSuggestion}
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
      {pendingSuggestions.length > 0 && showSuggestionNav && showScrollTop && (
        <nav 
          className="fixed bottom-6 right-20 z-40 flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 border border-slate-200"
          aria-label={language === 'he' ? 'ניווט בין הצעות' : 'Navigate between suggestions'}
        >
          <Button
            size="sm"
            variant="default"
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg h-10 px-3"
            aria-label={language === 'he' ? 'הצעה קודמת' : 'Previous suggestion'}
            onClick={() => {
              const newIndex = currentSuggestionIndex === 0 
                ? pendingSuggestions.length - 1 
                : currentSuggestionIndex - 1;
              setCurrentSuggestionIndex(newIndex);
              scrollToSuggestion(newIndex);
            }}
          >
            {isRTL ? <ChevronRight className="w-4 h-4" aria-hidden="true" /> : <ChevronLeft className="w-4 h-4" aria-hidden="true" />}
          </Button>
          <span className="text-sm font-medium text-slate-700 px-2" aria-live="polite" aria-atomic="true">
            {currentSuggestionIndex + 1} / {pendingSuggestions.length}
          </span>
          <Button
            size="sm"
            variant="default"
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg h-10 px-3"
            aria-label={language === 'he' ? 'הצעה הבאה' : 'Next suggestion'}
            onClick={() => {
              const newIndex = (currentSuggestionIndex + 1) % pendingSuggestions.length;
              setCurrentSuggestionIndex(newIndex);
              scrollToSuggestion(newIndex);
            }}
          >
            {isRTL ? <ChevronLeft className="w-4 h-4" aria-hidden="true" /> : <ChevronRight className="w-4 h-4" aria-hidden="true" />}
          </Button>
        </nav>
      )}
      </div>
    </TranslationProvider>
  );
}