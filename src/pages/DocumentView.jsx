import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Settings, Users, TrendingUp, MessageSquare, Plus, ArrowLeft, ArrowRight, History, FileText, Languages, Loader2, Edit2, Save, X, CheckCircle, ChevronLeft, ChevronRight, ChevronDown, MoreVertical, Clock, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

import { useLanguage } from "@/components/LanguageContext";
import ReactQuill from "react-quill";

import DocumentContent from "../components/document/DocumentContent";
import DocumentSummaryDialog from "../components/document/DocumentSummaryDialog";
import ErrorBoundary from "../components/ErrorBoundary";
import PageHeader from "../components/PageHeader";
import { calculateContributorsFromData } from "../components/document/calculateContributors";
import { TranslationProvider } from "../components/document/TranslationContext";
import TranslateAllButton from "../components/document/TranslateAllButton";
import CommentsSection from "../components/document/CommentsSection";
import { useDocumentData } from "../components/document/hooks/useDocumentData";
import { useDocumentSubscriptions } from "../components/document/hooks/useDocumentSubscriptions";

// Lazy load heavy components
const CreateSuggestionModal = React.lazy(() => import("../components/document/CreateSuggestionModal"));
const ContributorsModal = React.lazy(() => import("../components/document/ContributorsModal"));
const SuggestionSidebar = React.lazy(() => import("../components/document/SuggestionSidebar"));
const DocumentAgreementModal = React.lazy(() => import("../components/document/DocumentAgreementModal"));

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
  const commentIdFromUrl = searchParams.get('commentId');
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
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const [targetSuggestionId, setTargetSuggestionId] = useState(null);
  const [showSuggestionNav, setShowSuggestionNav] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [editingSuggestion, setEditingSuggestion] = useState(null);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);

  // ── Data & Subscriptions (extracted to dedicated hooks) ──────────────────
  const {
    document, topics, sections, suggestions,
    allVotes, publicProfiles, allComments,
    documentAgreements, documentVersions,
    documentMetadata, user, isAdmin, groupData,
    isInitialLoading,
  } = useDocumentData(documentId);

  const { setTopicsRef, setSectionsRef, setSuggestionsRef } = useDocumentSubscriptions(
    documentId, document, documentMetadata
  );

  // Keep subscription refs up to date — single effect, no redundant re-renders
  React.useEffect(() => {
    setTopicsRef(topics);
    setSectionsRef(sections);
    setSuggestionsRef(suggestions);
  }, [topics, sections, suggestions]);

  // Track accepted suggestions to flash them when status changes to 'accepted'
  const prevSuggestionStatusesRef = React.useRef({});
  React.useEffect(() => {
    if (!suggestions || suggestions.length === 0) return;
    const prev = prevSuggestionStatusesRef.current;
    suggestions.forEach(s => {
      if (prev[s.id] && prev[s.id] !== 'accepted' && s.status === 'accepted') {
        setTimeout(() => {
          const el = window.document?.getElementById(`suggestion-${s.id}`);
          if (el) {
            el.classList.add('suggestion-accepted-flash');
            setTimeout(() => el.classList.remove('suggestion-accepted-flash'), 2800);
          }
        }, 100);
      }
      prev[s.id] = s.status;
    });
  }, [suggestions]);

  const allUsers = publicProfiles;

  // Derived from aggregatedData — no extra query needed
  const documentComments = React.useMemo(() =>
    allComments.filter(c => c.rootEntityType === 'document' && c.rootEntityId === documentId),
    [allComments, documentId]
  );

  // Version count = number of unique accepted changes + 1 (current state)
  // Deduplicate by version number to avoid counting multiple section changes per suggestion
  const versionCount = React.useMemo(() => {
    if (!documentVersions || documentVersions.length === 0) return 1;
    const uniqueVersionNumbers = new Set(documentVersions.map(v => v.version || 0));
    return uniqueVersionNumbers.size + 1; // +1 for current version
  }, [documentVersions]);

  const sectionCommentsCount = React.useMemo(() => {
    const sectionIds = new Set(sections.map(s => s.id));
    return allComments.filter(c =>
      c.rootEntityType === 'section' && sectionIds.has(c.rootEntityId)
    ).length;
  }, [allComments, sections]);

  // Build O(1) lookup map for profile by userId — avoids O(n²) in contributorsCount
  const profileByUserId = React.useMemo(() => {
    const map = new Map();
    publicProfiles.forEach(p => { if (p.userId) map.set(p.userId, p); });
    return map;
  }, [publicProfiles]);

  const contributorsCount = React.useMemo(() => {
    const contributorEmails = new Set();
    // Suggestion creators
    suggestions.forEach(s => { if (s.created_by) contributorEmails.add(s.created_by); });
    // Voters
    allVotes.forEach(v => {
      if (v.created_by) contributorEmails.add(v.created_by);
      const profile = profileByUserId.get(v.userId);
      if (profile?.email) contributorEmails.add(profile.email);
    });
    // Commenters
    allComments.forEach(c => { if (c.created_by) contributorEmails.add(c.created_by); });
    // Agreement signers
    documentAgreements.forEach(a => { if (a.userEmail) contributorEmails.add(a.userEmail); });
    return contributorEmails.size;
  }, [suggestions, allVotes, allComments, profileByUserId, documentAgreements]);

  // Pre-build lookup maps for O(1) access during sort
  const topicOrderMap = React.useMemo(() => {
    const map = new Map();
    topics.forEach(t => map.set(t.id, t.order));
    return map;
  }, [topics]);

  const sectionOrderMap = React.useMemo(() => {
    const map = new Map();
    sections.forEach(s => map.set(s.id, s.order));
    return map;
  }, [sections]);

  const pendingSuggestions = React.useMemo(() => {
    if (!suggestions || !sections || !topics) return [];
    
    return suggestions
      .filter(s => s.status === 'pending' && s.type !== 'edit_suggestion')
      .sort((a, b) => {
        const topicOrderA = topicOrderMap.get(a.topicId) ?? 999;
        const topicOrderB = topicOrderMap.get(b.topicId) ?? 999;
        
        if (topicOrderA !== topicOrderB) return topicOrderA - topicOrderB;
        
        if (a.type === 'edit_section' && b.type === 'edit_section') {
          return (sectionOrderMap.get(a.sectionId) ?? 999) - (sectionOrderMap.get(b.sectionId) ?? 999);
        }
        
        if (a.type === 'edit_section') return -1;
        if (b.type === 'edit_section') return 1;
        return 0;
      });
  }, [suggestions, topicOrderMap, sectionOrderMap]);

  const scrollToSuggestion = React.useCallback((index) => {
    const suggestion = pendingSuggestions[index];
    if (!suggestion) return;
    if (typeof window === 'undefined' || typeof window.document === 'undefined' || !window.document.getElementById) return;

    // אם זו הצעה לעריכת סעיף או מחיקת סעיף - צריך לגלול לסעיף ולהעביר את הקרוסלה
    if (suggestion.type === 'edit_section' || suggestion.type === 'delete_section') {
      setTargetSuggestionId(suggestion.id);

      // המתן רגע קצר שהקרוסלה תעדכן את ה-ID שלה, ואז גלול
      setTimeout(() => {
        const element = window.document.getElementById(`suggestion-${suggestion.id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
              retryElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
              retryElement.classList.add('ring-4', 'ring-blue-500', 'ring-offset-4');
              setTimeout(() => {
                retryElement.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-4');
                setTargetSuggestionId(null);
              }, 2000);
            }
          }, 300);
        }
      }, 200);
    } else if (suggestion.type === 'edit_suggestion') {
      // הצעה לעריכת הצעה - מעבר לחלון הקרוסלה שלה להצעה האב
      // קודם כל, צריך למצוא את ההצעה האב
      const parentSuggestion = suggestions.find(s => s.id === suggestion.parentSuggestionId);
      
      if (parentSuggestion) {
        // אם זו הצעה לעריכת הצעה על סעיף קיים, צריך לעבור לקרוסלה של הסעיף
        if (parentSuggestion.type === 'edit_section' || parentSuggestion.type === 'delete_section') {
          setTargetSuggestionId(parentSuggestion.id);
          setTimeout(() => {
            const element = window.document.getElementById(`suggestion-${parentSuggestion.id}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'start' });
              element.classList.add('ring-4', 'ring-blue-500', 'ring-offset-4');
              setTimeout(() => {
                element.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-4');
              }, 2000);
            }
          }, 200);
        } else {
          // הצעה לעריכת הצעה על הצעה לסעיף חדש - גלול להצעה האב והקרוסלה שלה תטפל
          setTargetSuggestionId(suggestion.id); // מעביר את ה-ID של ההצעה הספציפית (העריכה)
          setTimeout(() => {
            const element = window.document.getElementById(`suggestion-${parentSuggestion.id}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'start' });
              element.classList.add('ring-4', 'ring-blue-500', 'ring-offset-4');
              setTimeout(() => {
                element.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-4');
                setTargetSuggestionId(null);
              }, 2000);
            }
          }, 200);
        }
      }
    } else {
      // הצעה לסעיף חדש - גלילה רגילה
      setTargetSuggestionId(suggestion.id);
      setTimeout(() => {
        const element = window.document.getElementById(`suggestion-${suggestion.id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          element.classList.add('ring-4', 'ring-blue-500', 'ring-offset-4');
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-4');
            setTargetSuggestionId(null);
          }, 2000);
        }
      }, 200);
    }
  }, [pendingSuggestions, suggestions]);

  // Derived privacy checks
  const groupPrivacy = React.useMemo(() => {
    if (!groupData?.group) return { canView: true, canParticipate: true };
    const group = groupData.group;
    const members = groupData.members || [];
    const isSystemAdmin = user?.role === 'admin';
    const isGroupMember = user?.id && members.some(m => m.userId === user.id);
    const isGroupCreator = user?.email && group.created_by === user.email;
    const hasAccess = isSystemAdmin || isGroupMember || isGroupCreator;

    if (group.status === 'hidden') {
      return { canView: hasAccess, canParticipate: hasAccess };
    }
    if (group.status === 'private') {
      return { canView: true, canParticipate: hasAccess };
    }
    return { canView: true, canParticipate: true };
  }, [groupData, user]);



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
      queryClient.invalidateQueries({ queryKey: ['documentMetadata', documentId] });
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
      queryClient.invalidateQueries({ queryKey: ['documentMetadata', documentId] });
    },
  });

  React.useEffect(() => {
    if (document) {
      setDescription(document.description || "");
    }
  }, [document]);

  useEffect(() => {
    if (scrollToSectionId && typeof window !== 'undefined' && window.document) {
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
    if (typeof window === 'undefined' || !window.document) return;
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

  // Scroll to comment from notification
  useEffect(() => {
    if (!commentIdFromUrl || typeof window === 'undefined') return;

    let scrollTimer;
    let highlightTimer;
    let attempts = 0;
    const maxAttempts = 6;

    const attemptScroll = () => {
      const commentElement = window.document.getElementById(`comment-${commentIdFromUrl}`);
      if (commentElement) {
        commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        commentElement.style.transition = 'background-color 0.3s ease';
        commentElement.style.backgroundColor = '#dbeafe';
        highlightTimer = setTimeout(() => {
          commentElement.style.backgroundColor = '';
        }, 3000);
      } else if (attempts < maxAttempts) {
        attempts++;
        scrollTimer = setTimeout(attemptScroll, 400 * attempts);
      }
    };

    scrollTimer = setTimeout(attemptScroll, 600);
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(highlightTimer);
    };
  }, [commentIdFromUrl]);

  // Track scroll position for showing floating buttons
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Restore scroll position after page reload
  useEffect(() => {
    const savedScrollPosition = sessionStorage.getItem('documentScrollPosition');
    if (savedScrollPosition) {
      setTimeout(() => {
        window.scrollTo(0, parseInt(savedScrollPosition, 10));
        sessionStorage.removeItem('documentScrollPosition');
      }, 100);
    }
  }, []);

  const handleEditSection = React.useCallback((section, isDirectEdit = false) => {
    setEditingSection(isDirectEdit ? { ...section, isDirectEdit: true } : section);
    setShowCreateSuggestion(true);
  }, []);

  const handleNewSection = React.useCallback((topicId, insertPosition) => {
    // מציאת ה-order של הנושא הנוכחי
    const currentTopic = topics.find(t => t.id === topicId);
    const topicOrder = currentTopic?.order;
    setEditingSection({ topicId, insertPosition, isNew: true, topicOrder });
    setShowCreateSuggestion(true);
  }, [topics]);

  const handleEditSuggestion = React.useCallback((suggestion) => {
    setEditingSuggestion(suggestion);
    setShowCreateSuggestion(true);
  }, []);

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

  if (isInitialLoading) {
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

  // Group privacy enforcement
  if (!groupPrivacy.canView) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6">
        <div className="max-w-6xl mx-auto text-center py-12 md:py-20">
          <div className="bg-white rounded-xl shadow p-8 max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
              <Settings className="w-7 h-7 text-slate-500" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              {language === 'he' ? 'מסמך חסוי' : language === 'ar' ? 'مستند محظور' : 'Document Restricted'}
            </h1>
            <p className="text-slate-500 text-sm">
              {language === 'he'
                ? 'מסמך זה שייך לקבוצה חסויה. רק חברי הקבוצה יכולים לצפות בו.'
                : language === 'ar'
                ? 'هذا المستند ينتمي إلى مجموعة مخفية. فقط أعضاء المجموعة يمكنهم الوصول إليه.'
                : 'This document belongs to a hidden group. Only group members can view it.'}
            </p>
            {!user && (
              <Button onClick={() => base44.auth.redirectToLogin()} className="bg-gradient-to-r from-blue-600 to-indigo-600">
                {t('signIn')}
              </Button>
            )}
            <Link to={createPageUrl("Groups")}>
              <Button variant="outline" className="w-full">
                {language === 'he' ? 'לעמוד הקבוצות' : language === 'ar' ? 'إلى المجموعات' : 'Go to Groups'}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const canParticipate = groupPrivacy.canParticipate;

  return (
    <TranslationProvider>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-1 md:p-6 w-full max-w-full overflow-x-hidden pb-24">
      <div className="max-w-6xl mx-auto space-y-2 md:space-y-6 px-1 md:px-4 w-full max-w-full">
        <div className="flex flex-col gap-2 md:gap-4 w-full max-w-full">
          {document.groupId && (
            <Link
              to={`${createPageUrl("GroupView")}?id=${document.groupId}`}
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors mb-1"
            >
              {isRTL ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
              <span>{language === 'he' ? 'חזרה לקבוצה' : language === 'ar' ? 'العودة إلى المجموعة' : 'Back to Group'}</span>
            </Link>
          )}

          <div className={`flex items-center gap-2 w-full max-w-full ${isRTL ? 'flex-row-reverse' : ''}`}>
            <h1 id="document-title" className="text-lg md:text-3xl font-bold text-slate-900 flex-1 min-w-0 break-words leading-tight max-w-full" style={{ fontFamily: "'Times New Roman', 'David Libre', 'Noto Serif', Georgia, serif" }}>
              {(() => {
                const translatedTitle = document.translations?.[language]?.title;
                if (showTranslated && typeof translatedTitle === 'string') {
                  return translatedTitle;
                }
                return document.title;
              })()}
            </h1>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs md:text-sm px-2 h-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
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

                <DropdownMenuItem asChild>
                  <Link to={`${createPageUrl("RejectedSuggestions")}?id=${documentId}`} className="flex items-center">
                    <AlertCircle className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {language === 'he' ? 'הצעות שנדחו' : language === 'ar' ? 'المقترحات المرفوضة' : 'Rejected Suggestions'}
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
          <div className={`relative ${document.description || isAdmin || showDescriptionComments ? 'bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg p-4' : ''}`}>
              {!isEditingDescription && (
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
                                      if (typeof window !== 'undefined' && window.document?.getElementById) {
                                        const titleElement = window.document.getElementById('document-title');
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
                                       if (typeof window !== 'undefined' && window.document?.getElementById) {
                                         const titleElement = window.document.getElementById('document-title');
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
                  ) : isAdmin ? (
                    <p className="text-slate-400 text-sm italic">{t('noDescription')}</p>
                  ) : null}
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
                  <CommentsSection
                    entityType="document"
                    entityId={documentId}
                    user={user}
                    scrollToCommentId={commentIdFromUrl}
                  />
                </div>
              )}
            </div>


        </div>

        <div className="flex flex-col gap-2 md:gap-3 w-full max-w-full">
          {/* Open suggestions — inline nudge */}
          {pendingSuggestions.length > 0 ? (
            <div className="relative group/tip w-full">
              <button
                type="button"
                onClick={() => { setShowSuggestionNav(true); scrollToSuggestion(currentSuggestionIndex); }}
                className="w-full flex items-center justify-center gap-3 px-3 py-2.5 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 hover:border-orange-300 transition-all group cursor-pointer"
                aria-label={`${pendingSuggestions.length} ${language === 'he' ? 'הצעות פתוחות' : 'open suggestions'} — ${language === 'he' ? 'לחץ לניווט' : 'click to navigate'}`}
              >
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-orange-500 text-white text-sm font-bold shrink-0">
                  {pendingSuggestions.length}
                </span>
                <span className="text-sm font-medium text-orange-800 text-center">
                  {language === 'he' ? 'הצעות ממתינות להצבעתך' : language === 'ar' ? 'اقتراحات بانتظار تصويتك' : 'Suggestions awaiting your vote'}
                </span>
                <span className="text-xs text-orange-500 font-medium group-hover:text-orange-700 transition-colors shrink-0 flex items-center gap-1">
                  {language === 'he' ? 'להצבעה' : language === 'ar' ? 'للتصويت' : 'Vote now'}
                  <ChevronDown className="w-3 h-3" />
                </span>
              </button>
              {/* Tooltip */}
              <div className={`absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 bg-slate-800 text-white text-xs rounded-lg px-3 py-2.5 shadow-xl opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity duration-200 text-center leading-relaxed`}>
                {language === 'he'
                  ? 'הצעות פתוחות הן שינויים שמשתתפים הציעו למסמך וממתינות להצבעה. ההצבעה שלך קובעת אם השינוי יתקבל — כל קול משפיע!'
                  : language === 'ar'
                  ? 'الاقتراحات المفتوحة هي تغييرات مقترحة من المشاركين وتنتظر التصويت. صوتك يحدد ما إذا كان التغيير سيُقبل — كل صوت مهم!'
                  : 'Open suggestions are changes proposed by participants, waiting for a vote. Your vote determines whether the change is accepted — every vote counts!'}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
              </div>
            </div>
          ) : (
            <div className="w-full flex items-center justify-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 bg-white/60">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 text-slate-500 text-sm font-bold shrink-0">0</span>
              <span className="text-sm text-slate-400 text-center">
                {language === 'he' ? 'אין הצעות פתוחות כרגע' : language === 'ar' ? 'لا توجد اقتراحات مفتوحة' : 'No open suggestions'}
              </span>
            </div>
          )}

          {/* Other counters — 3 columns */}
          <div className="grid grid-cols-3 gap-2 md:gap-3 w-full">
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
            <Link 
              to={`${createPageUrl("DocumentCleanView")}?id=${documentId}`}
              className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg p-2 md:p-3 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-teal-400 hover:shadow-lg transition-all"
              aria-label={`${versionCount} ${language === 'he' ? 'גרסאות' : language === 'ar' ? 'الإصدارات' : 'versions'}. ${language === 'he' ? 'לחץ לצפייה בהיסטוריה' : 'Click to view history'}`}
            >
              <Clock className="w-4 h-4 md:w-6 md:h-6 text-teal-600" aria-hidden="true" />
              <div className="text-base md:text-xl font-bold text-slate-900">{versionCount}</div>
              <div className="text-[9px] md:text-xs text-slate-600 text-center leading-tight">{language === 'he' ? 'גרסאות' : language === 'ar' ? 'الإصدارات' : 'Versions'}</div>
            </Link>
          </div>
        </div>

        <ErrorBoundary inline errorMessage="שגיאה בטעינת תוכן המסמך. לחץ לניסיון חוזר.">
          <DocumentContent
              document={document}
              topics={topics}
              sections={sections}
              suggestions={suggestions}
              onEditSection={handleEditSection}
              onNewSection={handleNewSection}
              isAdmin={isAdmin}
              user={user}
              canParticipate={canParticipate}
              onDirectEdit={(section) => handleEditSection(section, true)}
              onOpenSuggestionSidebar={(suggestionId) => setOpenSuggestionId(suggestionId)}
              newlyCreatedSuggestion={newlyCreatedSuggestion}
              onClearNewlyCreated={() => setNewlyCreatedSuggestion(null)}
              targetSuggestionId={targetSuggestionId}
              onEditSuggestion={handleEditSuggestion}
          />
        </ErrorBoundary>
      </div>

      {showSummaryDialog && document && !isInitialLoading && (
        <DocumentSummaryDialog
          isOpen={showSummaryDialog}
          onClose={() => setShowSummaryDialog(false)}
          document={document}
          suggestions={suggestions}
          allComments={allComments}
          allVotes={allVotes}
          publicProfiles={publicProfiles}
        />
      )}

      <React.Suspense fallback={<div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"><div className="bg-white p-4 rounded-lg shadow-lg">טוען...</div></div>}>
        {showCreateSuggestion && canParticipate && (
          <CreateSuggestionModal
            document={document}
            topics={topics}
            sections={sections}
            editingSection={editingSection}
            editingSuggestion={editingSuggestion}
            user={user}
            isAdmin={isAdmin}
            onClose={() => {
              setShowCreateSuggestion(false);
              setEditingSection(null);
              setEditingSuggestion(null);
            }}
            onSuggestionCreated={(suggestionId, sectionId, topicId) => {
              setNewlyCreatedSuggestion({ suggestionId, sectionId, topicId });
            }}
            isDeletingSuggestion={editingSection?.isDeletingSuggestion}
          />
        )}

        {showContributorsModal && (
          <ContributorsModal
            isOpen={showContributorsModal}
            onClose={() => setShowContributorsModal(false)}
            documentId={documentId}
          />
        )}

        {openSuggestionId && (
          <ErrorBoundary inline errorMessage="שגיאה בטעינת ההצעה. לחץ לניסיון חוזר.">
            <SuggestionSidebar
              suggestionId={openSuggestionId}
              onClose={() => setOpenSuggestionId(null)}
              document={document}
              user={user}
              isAdmin={isAdmin}
            />
          </ErrorBoundary>
        )}

        {showAgreementModal && (
          <DocumentAgreementModal
            isOpen={showAgreementModal}
            onClose={() => setShowAgreementModal(false)}
            onConfirm={() => signAgreementMutation.mutate()}
            isLoading={signAgreementMutation.isPending}
          />
        )}
      </React.Suspense>

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