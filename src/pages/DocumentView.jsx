import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Settings, ArrowLeft, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

import { useLanguage } from "@/components/LanguageContext";

import DocumentContent from "../components/document/DocumentContent";
import DocumentSummaryDialog from "../components/document/DocumentSummaryDialog";
import ErrorBoundary from "../components/ErrorBoundary";
import { TranslationProvider } from "../components/document/TranslationContext";
import { useDocumentData } from "../components/document/hooks/useDocumentData";
import { useDocumentSubscriptions } from "../components/document/hooks/useDocumentSubscriptions";

// Extracted memoized sub-components
import DocumentHeader from "../components/document/DocumentHeader";
import DocumentDescription from "../components/document/DocumentDescription";
import DocumentCounters from "../components/document/DocumentCounters";
import FloatingSuggestionNav from "../components/document/FloatingSuggestionNav";

// Lazy load heavy modals
const CreateSuggestionModal = React.lazy(() => import("../components/document/CreateSuggestionModal"));
const ContributorsModal = React.lazy(() => import("../components/document/ContributorsModal"));
const SuggestionSidebar = React.lazy(() => import("../components/document/SuggestionSidebar"));
const DocumentAgreementModal = React.lazy(() => import("../components/document/DocumentAgreementModal"));

export default function DocumentView() {
  const { t, isRTL, language: rawLanguage } = useLanguage();
  const language = rawLanguage || 'he';
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('id');
  const scrollToSectionId = searchParams.get('scrollTo');
  const commentIdFromUrl = searchParams.get('commentId');
  const openSuggestionFromUrl = searchParams.get('openSuggestion');

  // ── UI State ──────────────────────────────────────────────────────────────────
  const [showCreateSuggestion, setShowCreateSuggestion] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [showContributorsModal, setShowContributorsModal] = useState(false);
  const [showDescriptionComments, setShowDescriptionComments] = useState(false);
  const [openSuggestionId, setOpenSuggestionId] = useState(null);
  const [newlyCreatedSuggestion, setNewlyCreatedSuggestion] = useState(null);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const [targetSuggestionId, setTargetSuggestionId] = useState(null);
  const [showSuggestionNav, setShowSuggestionNav] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [editingSuggestion, setEditingSuggestion] = useState(null);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [pendingConVoteSectionId, setPendingConVoteSectionId] = useState(null);

  // Fire tutorial event when document page mounts
  useEffect(() => {
    const timer = setTimeout(() => window.dispatchEvent(new Event('document:entered')), 100);
    return () => clearTimeout(timer);
  }, []);

  // ── Data & Subscriptions ──────────────────────────────────────────────────────
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

  useEffect(() => {
    setTopicsRef(topics);
    setSectionsRef(sections);
    setSuggestionsRef(suggestions);
  }, [topics, sections, suggestions, setTopicsRef, setSectionsRef, setSuggestionsRef]);

  // Track accepted suggestions to flash them
  const prevSuggestionStatusesRef = React.useRef({});
  useEffect(() => {
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

  // ── Derived data (memoized) ───────────────────────────────────────────────────
  const documentComments = React.useMemo(() =>
    allComments.filter(c => c.rootEntityType === 'document' && c.rootEntityId === documentId),
    [allComments, documentId]
  );

  const consensusPct = React.useMemo(() => {
    const consensuses = document?.consensuses || [];
    if (consensuses.length === 0) return '0';
    const avg = consensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / consensuses.length;
    return Math.min(100, avg * 100).toFixed(0);
  }, [document?.consensuses]);

  const versionCount = React.useMemo(() => {
    if (!documentVersions || documentVersions.length === 0) return 1;
    const uniqueVersionNumbers = new Set(documentVersions.map(v => v.version || 0));
    return uniqueVersionNumbers.size + 1;
  }, [documentVersions]);

  const sectionCommentsCount = React.useMemo(() => {
    const sectionIds = new Set(sections.map(s => s.id));
    return allComments.filter(c => c.rootEntityType === 'section' && sectionIds.has(c.rootEntityId)).length;
  }, [allComments, sections]);

  const profileByUserId = React.useMemo(() => {
    const map = new Map();
    publicProfiles.forEach(p => { if (p.userId) map.set(p.userId, p); });
    return map;
  }, [publicProfiles]);

  const contributorsCount = React.useMemo(() => {
    const contributorEmails = new Set();
    suggestions.forEach(s => { if (s.created_by) contributorEmails.add(s.created_by); });
    allVotes.forEach(v => {
      if (v.created_by) contributorEmails.add(v.created_by);
      const profile = profileByUserId.get(v.userId);
      if (profile?.email) contributorEmails.add(profile.email);
    });
    allComments.forEach(c => { if (c.created_by) contributorEmails.add(c.created_by); });
    documentAgreements.forEach(a => { if (a.userEmail) contributorEmails.add(a.userEmail); });
    return contributorEmails.size;
  }, [suggestions, allVotes, allComments, profileByUserId, documentAgreements]);

  const topicOrderMap = React.useMemo(() => {
    const map = new Map();
    topics.forEach(tp => map.set(tp.id, tp.order));
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
  }, [suggestions, topicOrderMap, sectionOrderMap, sections, topics]);

  // ── Scroll to suggestion ──────────────────────────────────────────────────────
  const scrollToSuggestion = React.useCallback((index) => {
    const suggestion = pendingSuggestions[index];
    if (!suggestion) return;
    if (typeof window === 'undefined' || typeof window.document === 'undefined' || !window.document.getElementById) return;

    const targetId = suggestion.type === 'edit_suggestion'
      ? (suggestions.find(s => s.id === suggestion.parentSuggestionId)?.id || suggestion.id)
      : suggestion.id;

    setTargetSuggestionId(targetId);
    setTimeout(() => {
      const element = window.document.getElementById(`suggestion-${targetId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        element.classList.add('ring-4', 'ring-blue-500', 'ring-offset-4');
        setTimeout(() => element.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-4'), 2000);
      }
    }, 200);
  }, [pendingSuggestions, suggestions]);

  // ── Privacy checks ────────────────────────────────────────────────────────────
  const groupPrivacy = React.useMemo(() => {
    if (!groupData?.group) return { canView: true, canParticipate: true };
    const group = groupData.group;
    const members = groupData.members || [];
    const isSystemAdmin = user?.role === 'admin';
    const isGroupMember = user?.id && members.some(m => m.userId === user.id);
    const isGroupCreator = user?.email && group.created_by === user.email;
    const hasAccess = isSystemAdmin || isGroupMember || isGroupCreator;
    if (group.status === 'hidden') return { canView: hasAccess, canParticipate: hasAccess };
    if (group.status === 'private') return { canView: true, canParticipate: hasAccess };
    return { canView: true, canParticipate: true };
  }, [groupData, user]);

  // ── Agreement mutations ───────────────────────────────────────────────────────
  const signAgreementMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Must be logged in');
      await base44.entities.DocumentAgreement.create({ documentId, userId: user.id, userEmail: user.email });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentMetadata', documentId] });
      setShowAgreementModal(false);
    },
  });

  const conVoteAfterSuggestionMutation = useMutation({
    mutationFn: (sectionId) => base44.functions.invoke('voteOnSection', { sectionId, vote: 'con' }),
    onSuccess: (res, sectionId) => {
      const data = res?.data;
      queryClient.invalidateQueries({ queryKey: ['sectionVotes', sectionId] });
      queryClient.invalidateQueries({ queryKey: ['allSectionVotes'] });
      if (data?.sectionDeleted) {
        queryClient.invalidateQueries({ queryKey: ['sections', documentId] });
        queryClient.invalidateQueries({ queryKey: ['documentAggregatedData', documentId] });
      }
    },
  });

  // ── Scroll effects ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (scrollToSectionId && typeof window !== 'undefined' && window.document) {
      setTimeout(() => {
        let element = window.document.getElementById(
          scrollToSectionId.startsWith('section-') || scrollToSectionId.startsWith('new-suggestion-')
            ? scrollToSectionId
            : `section-${scrollToSectionId}`
        );
        if (!element && scrollToSectionId.startsWith('new-suggestion-')) {
          element = window.document.getElementById(scrollToSectionId);
        }
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
          setTimeout(() => element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2'), 2000);
        } else {
          setTimeout(() => {
            const retryElement = window.document.getElementById(
              scrollToSectionId.startsWith('section-') || scrollToSectionId.startsWith('new-suggestion-')
                ? scrollToSectionId
                : `section-${scrollToSectionId}`
            );
            if (retryElement) {
              retryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              retryElement.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
              setTimeout(() => retryElement.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2'), 2000);
            }
          }, 1000);
        }
      }, 300);
    }
  }, [scrollToSectionId, sections, suggestions]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.document) return;
    const hash = window.location.hash;
    if (hash && topics.length > 0) {
      setTimeout(() => {
        const element = window.document.querySelector(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          element.classList.add('ring-4', 'ring-blue-500', 'ring-offset-4');
          setTimeout(() => element.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-4'), 2000);
        }
      }, 300);
    }
  }, [topics]);

  useEffect(() => {
    if (openSuggestionFromUrl && !openSuggestionId) {
      setOpenSuggestionId(openSuggestionFromUrl);
    }
  }, [openSuggestionFromUrl, openSuggestionId]);

  useEffect(() => {
    if (!commentIdFromUrl || typeof window === 'undefined') return;
    let scrollTimer, highlightTimer;
    let attempts = 0;
    const maxAttempts = 6;
    const attemptScroll = () => {
      const commentElement = window.document.getElementById(`comment-${commentIdFromUrl}`);
      if (commentElement) {
        commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        commentElement.style.transition = 'background-color 0.3s ease';
        commentElement.style.backgroundColor = '#dbeafe';
        highlightTimer = setTimeout(() => { commentElement.style.backgroundColor = ''; }, 3000);
      } else if (attempts < maxAttempts) {
        attempts++;
        scrollTimer = setTimeout(attemptScroll, 400 * attempts);
      }
    };
    scrollTimer = setTimeout(attemptScroll, 600);
    return () => { clearTimeout(scrollTimer); clearTimeout(highlightTimer); };
  }, [commentIdFromUrl]);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const savedScrollPosition = sessionStorage.getItem('documentScrollPosition');
    if (savedScrollPosition) {
      setTimeout(() => {
        window.scrollTo(0, parseInt(savedScrollPosition, 10));
        sessionStorage.removeItem('documentScrollPosition');
      }, 100);
    }
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleEditSection = React.useCallback((section, isDirectEdit = false) => {
    setEditingSection(isDirectEdit ? { ...section, isDirectEdit: true } : section);
    setShowCreateSuggestion(true);
  }, []);

  const handleEditSectionThenVote = React.useCallback((section) => {
    setPendingConVoteSectionId(section.id);
    setEditingSection(section);
    setShowCreateSuggestion(true);
  }, []);

  const handleNewSection = React.useCallback((topicId, insertPosition) => {
    const currentTopic = topics.find(tp => tp.id === topicId);
    setEditingSection({ topicId, insertPosition, isNew: true, topicOrder: currentTopic?.order });
    setShowCreateSuggestion(true);
  }, [topics]);

  const handleEditSuggestion = React.useCallback((suggestion) => {
    setEditingSuggestion(suggestion);
    setShowCreateSuggestion(true);
  }, []);

  // ── Loading / Not Found / Restricted states ───────────────────────────────────
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

  // ── Main render ───────────────────────────────────────────────────────────────
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

            {/* Document title + actions */}
            <div className="document-title-section space-y-4 md:space-y-6 w-full max-w-full">
              <DocumentHeader
                document={document}
                documentId={documentId}
                isRTL={isRTL}
                language={language}
                t={t}
                isAdmin={isAdmin}
                documentComments={documentComments}
                sectionCommentsCount={sectionCommentsCount}
                showDescriptionComments={showDescriptionComments}
                setShowDescriptionComments={setShowDescriptionComments}
                topics={topics}
                sections={sections}
              />

              {/* Document description + discussion */}
              <DocumentDescription
                document={document}
                documentId={documentId}
                isRTL={isRTL}
                language={language}
                t={t}
                isAdmin={isAdmin}
                user={user}
                commentIdFromUrl={commentIdFromUrl}
                showDescriptionComments={showDescriptionComments}
              />
            </div>

            {/* Counters */}
            <DocumentCounters
              pendingSuggestions={pendingSuggestions}
              currentSuggestionIndex={currentSuggestionIndex}
              language={language}
              t={t}
              contributorsCount={contributorsCount}
              allCommentsCount={allComments.length}
              sectionCommentsCount={sectionCommentsCount}
              consensusPct={consensusPct}
              versionCount={versionCount}
              documentId={documentId}
              onShowContributors={() => setShowContributorsModal(true)}
              onShowSuggestionNav={() => {
                setShowSuggestionNav(true);
                scrollToSuggestion(currentSuggestionIndex);
              }}
            />

            {/* Document content */}
            <div className="document-sections-area w-full">
              <ErrorBoundary inline errorMessage="שגיאה בטעינת תוכן המסמך. לחץ לניסיון חוזר.">
                <DocumentContent
                  document={document}
                  topics={topics}
                  sections={sections}
                  suggestions={suggestions}
                  onEditSection={handleEditSection}
                  onEditSectionThenVote={handleEditSectionThenVote}
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
          </div>

          {/* Summary dialog */}
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

          {/* Lazy-loaded modals */}
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
                  setPendingConVoteSectionId(null);
                }}
                onSuggestionCreated={(suggestionId, sectionId, topicId) => {
                  setNewlyCreatedSuggestion({ suggestionId, sectionId, topicId });
                  if (pendingConVoteSectionId) {
                    conVoteAfterSuggestionMutation.mutate(pendingConVoteSectionId);
                    setPendingConVoteSectionId(null);
                  }
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

          {/* Floating suggestion navigation */}
          {showSuggestionNav && showScrollTop && (
            <FloatingSuggestionNav
              pendingSuggestions={pendingSuggestions}
              currentSuggestionIndex={currentSuggestionIndex}
              isRTL={isRTL}
              language={language}
              onPrev={() => {
                const newIndex = currentSuggestionIndex === 0
                  ? pendingSuggestions.length - 1
                  : currentSuggestionIndex - 1;
                setCurrentSuggestionIndex(newIndex);
                scrollToSuggestion(newIndex);
              }}
              onNext={() => {
                const newIndex = (currentSuggestionIndex + 1) % pendingSuggestions.length;
                setCurrentSuggestionIndex(newIndex);
                scrollToSuggestion(newIndex);
              }}
            />
          )}
        </div>
      </div>
    </TranslationProvider>
  );
}