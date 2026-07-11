import React, { useState, useEffect, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, X, Edit } from "lucide-react";
import SectionVersionCarousel from "./SectionVersionCarousel";
import { useLanguage } from "@/components/LanguageContext";
import { base44 } from "@/api/base44Client";
import DeleteSectionDialog from "./DeleteSectionDialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import JoinGroupDialog from "@/components/group/JoinGroupDialog";

// Extracted memoized sub-components — each only re-renders when its own props change
import CarouselNavigation from "./section-carousel/CarouselNavigation";
import CurrentSectionView from "./section-carousel/CurrentSectionView";
import SuggestionView from "./section-carousel/SuggestionView";
import SectionActionButtons from "./section-carousel/SectionActionButtons";

const SectionCarousel = React.memo(function SectionCarousel({
  section,
  pendingSuggestions,
  document,
  user,
  canParticipate = true,
  onEditSection,
  onDirectEdit,
  toggleComments,
  showComments,
  getCommentsCount,
  getUserVote,
  voteMutation,
  getUserName,
  acceptedSuggestions,
  sectionIndex,
  isAdmin,
  onOpenSuggestionSidebar,
  newlyCreatedSuggestionId,
  onClearNewlyCreated,
  targetSuggestionId,
  publicProfiles = [],
  allDocumentSuggestions = [],
  sectionVotes = [],
  isGhost = false,
  onEditSuggestion,
  onEditSectionThenVote,
}) {
  const { t, isRTL, language: rawLanguage } = useLanguage();
  const language = rawLanguage || 'he';
  const queryClient = useQueryClient();

  // ── Memos: section suggestions derived from allDocumentSuggestions ──────────
  const allSectionSuggestions = useMemo(() => {
    if (!allDocumentSuggestions || allDocumentSuggestions.length === 0) return [];
    const directSuggestions = allDocumentSuggestions.filter(s =>
      s.sectionId === section.id &&
      (s.type === 'edit_section' || s.type === 'delete_section')
    );
    const sectionSuggestionIds = new Set(directSuggestions.map(s => s.id));
    const editSuggestions = allDocumentSuggestions.filter(s =>
      s.type === 'edit_suggestion' &&
      s.parentSuggestionId &&
      sectionSuggestionIds.has(s.parentSuggestionId)
    );
    return [...directSuggestions, ...editSuggestions];
  }, [allDocumentSuggestions, section.id]);

  // Determines which entity the comments belong to (accepted suggestion vs section)
  const activeCommentEntity = useMemo(() => {
    const acceptedEdits = allDocumentSuggestions
      .filter(s => s.sectionId === section.id && s.status === 'accepted' && s.type === 'edit_section')
      .sort((a, b) => new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date));
    if (acceptedEdits.length > 0) return { entityType: 'suggestion', entityId: acceptedEdits[0].id };
    const creationSuggestion = allDocumentSuggestions.find(
      s => s.sectionId === section.id && s.status === 'accepted' && s.type === 'new_section'
    );
    if (creationSuggestion) return { entityType: 'suggestion', entityId: creationSuggestion.id };
    return { entityType: 'section', entityId: section.id };
  }, [allDocumentSuggestions, section.id]);

  // ── State ────────────────────────────────────────────────────────────────────
  const [currentSuggestionId, setCurrentSuggestionId] = useState(null);
  const [flashingSection, setFlashingSection] = useState(false);
  const [deletingFlash, setDeletingFlash] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showJoinGroupDialog, setShowJoinGroupDialog] = useState(false);
  const [historyMode, setHistoryMode] = useState(false);

  const deleteFlashTimerRef = useRef(null);
  const flashTimerRef = useRef(null);
  const prevSuggestionsStatusRef = useRef({});
  const hasAnimatedRef = useRef(new Set());

  // ── Pending suggestions (includes edit_suggestion children) ────────────────
  const pendingSectionSuggestions = useMemo(() => {
    return allSectionSuggestions.filter(s => s.status === 'pending');
  }, [allSectionSuggestions]);

  // ── Sorted suggestions (memoized — was computed on every render) ───────────
  const sortedSuggestions = useMemo(() => {
    return [...pendingSectionSuggestions].sort((a, b) => {
      const deltaA = Math.abs((a.proVotes || 0) - (a.conVotes || 0));
      const deltaB = Math.abs((b.proVotes || 0) - (b.conVotes || 0));
      if (deltaA !== deltaB) return deltaA - deltaB;
      return new Date(b.created_date) - new Date(a.created_date);
    });
  }, [pendingSectionSuggestions]);

  // ── All views: current + sorted suggestions (or just suggestions for ghost) ─
  const allViews = useMemo(() => {
    const suggestionViews = sortedSuggestions.map(s => ({ type: 'suggestion', data: s, id: s.id }));
    if (isGhost) return suggestionViews;
    return [{ type: 'current', data: section, id: 'current' }, ...suggestionViews];
  }, [section, sortedSuggestions, isGhost]);

  const currentIndex = useMemo(() => {
    if (!currentSuggestionId) return 0;
    const idx = allViews.findIndex(v => v.id === currentSuggestionId);
    return idx >= 0 ? idx : 0;
  }, [currentSuggestionId, allViews]);

  const isFirstView = currentIndex === 0;
  const safeIndex = currentIndex >= allViews.length ? 0 : currentIndex;
  const currentView = allViews.length > 0 ? (allViews[safeIndex] || allViews[0]) : null;
  const currentSuggestionDisplayId = currentView?.type === 'suggestion'
    ? `suggestion-${currentView.data.id}`
    : `section-${section.id}`;

  // ── Effects ──────────────────────────────────────────────────────────────────

  // Red border flash on community-voted section deletion
  useEffect(() => {
    const handleDeleteFlash = (e) => {
      if (e.detail?.sectionId === section.id) {
        setDeletingFlash(true);
        clearTimeout(deleteFlashTimerRef.current);
        deleteFlashTimerRef.current = setTimeout(() => setDeletingFlash(false), 4100);
      }
    };
    window.addEventListener('section-deleted-flash', handleDeleteFlash);
    return () => {
      window.removeEventListener('section-deleted-flash', handleDeleteFlash);
      clearTimeout(deleteFlashTimerRef.current);
    };
  }, [section.id]);

  // Track status changes — when a suggestion is accepted, switch to current view + flash green
  useEffect(() => {
    if (!allSectionSuggestions || allSectionSuggestions.length === 0 || !document?.id) return;
    allSectionSuggestions.forEach(sug => {
      const prevStatus = prevSuggestionsStatusRef.current[sug.id];
      if (prevStatus === 'pending' && sug.status === 'accepted' && !hasAnimatedRef.current.has(sug.id)) {
        hasAnimatedRef.current.add(sug.id);
        setCurrentSuggestionId('current');
        queryClient.invalidateQueries({ queryKey: ['sections', document.id] });
        setFlashingSection(true);
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setFlashingSection(false), 3000);
      }
      prevSuggestionsStatusRef.current[sug.id] = sug.status;
    });
    return () => { if (flashTimerRef.current) clearTimeout(flashTimerRef.current); };
  }, [allSectionSuggestions, document.id, queryClient]);

  // Scroll to newly created suggestion
  useEffect(() => {
    if (newlyCreatedSuggestionId && sortedSuggestions.length > 0) {
      const foundSuggestion = sortedSuggestions.find(s => s.id === newlyCreatedSuggestionId);
      if (foundSuggestion) {
        setCurrentSuggestionId(newlyCreatedSuggestionId);
        if (onClearNewlyCreated) setTimeout(() => onClearNewlyCreated(), 100);
      }
    }
  }, [newlyCreatedSuggestionId, sortedSuggestions, onClearNewlyCreated]);

  // Auto-navigate to newest suggestion when list grows
  const prevSortedLengthRef = useRef(sortedSuggestions.length);
  useEffect(() => {
    const prevLen = prevSortedLengthRef.current;
    const newLen = sortedSuggestions.length;
    if (newLen > prevLen) {
      const newest = [...sortedSuggestions].sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
      if (newest) setCurrentSuggestionId(newest.id);
    }
    prevSortedLengthRef.current = newLen;
  }, [sortedSuggestions]);

  // Navigate to target suggestion (from floating nav buttons)
  useEffect(() => {
    if (targetSuggestionId && sortedSuggestions.length > 0) {
      const foundSuggestion = sortedSuggestions.find(s => s.id === targetSuggestionId);
      if (foundSuggestion) setCurrentSuggestionId(targetSuggestionId);
    }
  }, [targetSuggestionId, sortedSuggestions]);

  // Scroll target into view — waits for the carousel to navigate to the suggestion view first,
  // then retries to handle deferred LazySection mounting
  useEffect(() => {
    if (!targetSuggestionId || currentSuggestionId !== targetSuggestionId) return;
    if (typeof window === 'undefined' || !window.document) return;

    let attempts = 0;
    const maxAttempts = 6;
    let timer;

    const attemptScroll = () => {
      const targetElement = window.document.getElementById(`suggestion-${targetSuggestionId}`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (attempts < maxAttempts) {
        attempts++;
        timer = setTimeout(attemptScroll, 200 * attempts);
      }
    };

    timer = setTimeout(attemptScroll, 100);
    return () => clearTimeout(timer);
  }, [targetSuggestionId, currentSuggestionId]);

  // ── Carousel navigation handlers ─────────────────────────────────────────────
  const handleNext = () => {
    if (!allViews || allViews.length === 0) return;
    const nextIndex = (currentIndex + 1) % allViews.length;
    setCurrentSuggestionId(allViews[nextIndex]?.id);
    window.dispatchEvent(new CustomEvent('carousel:navigated'));
  };

  const handlePrev = () => {
    if (!allViews || allViews.length === 0) return;
    const prevIndex = (currentIndex - 1 + allViews.length) % allViews.length;
    setCurrentSuggestionId(allViews[prevIndex]?.id);
    window.dispatchEvent(new CustomEvent('carousel:navigated'));
  };

  // ── Delete section mutation ──────────────────────────────────────────────────
  const deleteSectionMutation = useMutation({
    mutationFn: async (saveToHistory) => {
      const versions = await base44.entities.DocumentVersion.filter({ sectionId: section.id });
      const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version)) + 1 : 1;
      await base44.entities.DocumentVersion.create({
        documentId: section.documentId, sectionId: section.id, topicId: section.topicId,
        sectionOrder: section.order, content: section.content,
        changeDescription: `לפני: ${saveToHistory ? t('deleteSection') : 'Section deletion'}`,
        version: nextVersion, changeType: 'direct_edit',
      });
      await base44.entities.DocumentVersion.create({
        documentId: section.documentId, sectionId: section.id, topicId: section.topicId,
        sectionOrder: section.order, content: '',
        changeDescription: saveToHistory ? t('deleteSection') : 'Section deletion',
        version: nextVersion + 1, changeType: 'direct_edit',
      });
      await base44.entities.Section.delete(section.id);
      const orphaned = await base44.entities.Suggestion.filter({
        documentId: section.documentId, status: 'pending', sectionId: section.id,
      });
      if (orphaned.length > 0) {
        await Promise.all(orphaned.map(s =>
          base44.entities.Suggestion.update(s.id, {
            topicId: s.topicId || section.topicId,
            originalSectionOrder: section.order,
          })
        ));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections', document.id] });
      queryClient.invalidateQueries({ queryKey: ['versions'] });
      setShowDeleteDialog(false);
    },
  });

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      id={currentSuggestionDisplayId}
      className={`section-card group relative p-3 md:p-6 border-2 rounded-lg hover:shadow-md transition-all duration-300 ${
        historyMode
          ? 'border-teal-400 bg-gradient-to-br from-teal-50 to-cyan-50/40 shadow-md'
          : deletingFlash
            ? 'section-deleted-flash border-red-500 bg-gradient-to-br from-red-50 to-red-100/30'
            : flashingSection
              ? 'suggestion-accepted-flash border-green-400 bg-gradient-to-br from-white to-slate-50/30'
              : 'border-slate-300 hover:border-blue-400 bg-gradient-to-br from-white to-slate-50/30'
      }`}
    >
      {/* Edit hint icon */}
      {isFirstView && !historyMode && (
        <div className="absolute top-3 end-3 md:top-4 md:end-4 flex items-center gap-1 pointer-events-none opacity-40 group-hover:opacity-0 transition-opacity">
          <Edit className="w-4 h-4 text-slate-600" />
        </div>
      )}

      {/* Header: section index + badge + history button */}
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div className="flex items-center gap-2 md:gap-3">
          {isGhost ? null : (
            <div className={`text-xs md:text-sm font-medium ${historyMode ? 'text-teal-700' : 'text-slate-500'}`}>
              {historyMode
                ? <span className="flex items-center gap-1"><History className="w-3.5 h-3.5" />{t('history')}</span>
                : `${t('section')} ${sectionIndex + 1}`}
            </div>
          )}
          {!historyMode && allViews.length > 1 && (
            <Badge variant="outline" className="text-[10px] md:text-xs">
              {currentIndex + 1} / {allViews.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          {!isGhost && (
            historyMode ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); setHistoryMode(false); }}
                className="text-teal-700 hover:text-teal-900 hover:bg-teal-100 h-7 md:h-8 px-2 md:px-3 border border-teal-300 bg-teal-50"
              >
                <X className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                <span className="hidden md:inline text-xs">{t('currentVersion')}</span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); setHistoryMode(true); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-teal-700 hover:bg-teal-50 h-7 md:h-8 px-2 md:px-3"
              >
                <History className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                <span className="hidden md:inline">{t('history')}</span>
              </Button>
            )
          )}
        </div>
      </div>

      {/* History mode */}
      {historyMode && !isGhost && (
        <SectionVersionCarousel
          sectionId={section.id}
          documentId={document?.id}
          document={document}
          user={user}
          getUserName={getUserName}
          isAdmin={isAdmin}
          onClose={() => setHistoryMode(false)}
        />
      )}

      {/* Carousel navigation */}
      {!historyMode && allViews.length > 1 && (
        <CarouselNavigation
          allViews={allViews}
          currentIndex={currentIndex}
          currentView={currentView}
          isFirstView={isFirstView}
          sortedSuggestionsLength={sortedSuggestions.length}
          isRTL={isRTL}
          language={language}
          t={t}
          getUserName={getUserName}
          onPrev={handlePrev}
          onNext={handleNext}
          onSelectView={(id) => setCurrentSuggestionId(id)}
        />
      )}

      {/* Content area */}
      <div className={`min-h-[40px] ${historyMode ? 'hidden' : ''}`}>
        {!currentView ? null : currentView.type === 'current' ? (
          <CurrentSectionView
            section={section}
            document={document}
            user={user}
            isRTL={isRTL}
            t={t}
            sectionVotes={sectionVotes}
            canParticipate={canParticipate}
            onEditSection={onEditSection}
            onEditSectionThenVote={onEditSectionThenVote}
            onNeedJoinGroup={() => setShowJoinGroupDialog(true)}
            activeCommentEntity={activeCommentEntity}
            getCommentsCount={getCommentsCount}
            toggleComments={toggleComments}
            showComments={showComments}
          />
        ) : (
          <SuggestionView
            currentView={currentView}
            section={section}
            document={document}
            user={user}
            isRTL={isRTL}
            language={language}
            t={t}
            canParticipate={canParticipate}
            isGhost={isGhost}
            getUserVote={getUserVote}
            voteMutation={voteMutation}
            getUserName={getUserName}
            onOpenSuggestionSidebar={onOpenSuggestionSidebar}
            onEditSuggestion={onEditSuggestion}
            onNeedJoinGroup={() => setShowJoinGroupDialog(true)}
            getCommentsCount={getCommentsCount}
            toggleComments={toggleComments}
            showComments={showComments}
          />
        )}
      </div>

      {/* Action buttons — only on current view, not in history/ghost mode */}
      {isFirstView && !historyMode && !isGhost && (
        <SectionActionButtons
          isRTL={isRTL}
          t={t}
          language={language}
          user={user}
          canParticipate={canParticipate}
          isAdmin={isAdmin}
          onEditSection={onEditSection}
          onDirectEdit={onDirectEdit}
          onDeleteSection={() => setShowDeleteDialog(true)}
          section={section}
        />
      )}

      <DeleteSectionDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={(saveToHistory) => deleteSectionMutation.mutate(saveToHistory)}
        isDeleting={deleteSectionMutation.isPending}
      />

      <JoinGroupDialog
        isOpen={showJoinGroupDialog}
        onClose={() => setShowJoinGroupDialog(false)}
        groupId={document?.groupId}
      />
    </div>
  );
});

export default SectionCarousel;