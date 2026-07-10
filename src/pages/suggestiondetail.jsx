import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { PAGE_NAMES } from "@/components/pageNames";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ThumbsUp, ThumbsDown, Clock,
  CheckCircle, XCircle, AlertCircle, Loader2, Trash2, ChevronLeft, ChevronRight, Edit2, X, Save, FileText, ShieldCheck
} from "lucide-react";
import SuggestionCountdown from "@/components/document/SuggestionCountdown";
import VotingProgressSection from "../components/document/VotingProgressSection";
import { Skeleton } from "@/components/ui/skeleton";
import CommentsSection from "../components/document/CommentsSection";
import SectionDiff from "../components/document/SectionDiff";
import TranslatableContent from "../components/document/TranslatableContent";
import DocumentTextContent from "../components/document/DocumentTextContent";
import { votingQueue } from "../components/document/VotingQueue";
import { useOptimizedUserProfiles } from "@/components/hooks/useOptimizedUserProfiles";
import { useLanguage } from "@/components/LanguageContext";
import { notifySuggestionStatusChange } from "../components/notifications/createNotification";
import PageHeader from "../components/PageHeader";
import CreateSuggestionModal from "../components/document/CreateSuggestionModal";
import { toast } from "sonner";

export default function SuggestionDetail() {
  const { t, isRTL, language: rawLanguage } = useLanguage();
  const language = rawLanguage || 'he';
  const [searchParams] = useSearchParams();
  const suggestionId = searchParams.get('id');
  const commentId = searchParams.get('commentId');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newArgument, setNewArgument] = useState({ type: null, content: "" });
  const [error, setError] = useState(null);
  const [isEditingExplanation, setIsEditingExplanation] = useState(false);
  const [editedExplanation, setEditedExplanation] = useState("");
  const [showEditSectionModal, setShowEditSectionModal] = useState(false);
  const [showEditSuggestionModal, setShowEditSuggestionModal] = useState(false);
  const [isAutoAccepting, setIsAutoAccepting] = useState(false);
  const [rateLimitRetryAfter, setRateLimitRetryAfter] = useState(null);

  const { data: suggestion, isLoading: suggestionLoading, error: suggestionError } = useQuery({
    queryKey: ['suggestion', suggestionId],
    queryFn: async () => {
      if (!suggestionId) return null;
      // Canonical fetch-by-id — more reliable than filter({ id }) which can intermittently
      // surface empty results under rate-limiting / transient errors and falsely report "not found".
      return await base44.entities.Suggestion.get(suggestionId);
    },
    enabled: !!suggestionId,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 4000),
    throwOnError: false,
    staleTime: 30 * 1000, // 30s — allows real-time updates to show after invalidation
  });

  // Real-time subscription for suggestion updates
  React.useEffect(() => {
    if (!suggestionId) return;
    const unsubscribe = base44.entities.Suggestion.subscribe((event) => {
      if (event.id === suggestionId || event.data?.id === suggestionId) {
        queryClient.invalidateQueries({ queryKey: ['suggestion', suggestionId] });
        queryClient.invalidateQueries({ queryKey: ['allDocumentSuggestions', suggestion?.documentId] });
      }
    });
    return () => unsubscribe();
  }, [suggestionId, queryClient, suggestion?.documentId]);

  const { data: allDocumentSuggestions } = useQuery({
    queryKey: ['allDocumentSuggestions', suggestion?.documentId],
    queryFn: () => base44.entities.Suggestion.filter({ documentId: suggestion.documentId }),
    enabled: !!suggestion?.documentId,
    initialData: [],
    staleTime: Infinity
  });

  const { data: document } = useQuery({
    queryKey: ['document', suggestion?.documentId],
    queryFn: async () => {
      // Canonical fetch-by-id — filter({ id }) can intermittently return empty
      // under rate-limiting, which would hide the voting buttons permanently
      // (staleTime: Infinity caches the null result).
      return await base44.entities.Document.get(suggestion.documentId);
    },
    enabled: !!suggestion?.documentId,
    staleTime: Infinity
  });

  const { data: section } = useQuery({
    queryKey: ['section', suggestion?.sectionId],
    queryFn: async () => {
      const sections = await base44.entities.Section.filter({ id: suggestion.sectionId });
      return sections?.[0] ?? null;
    },
    enabled: !!suggestion?.sectionId,
    staleTime: Infinity
  });

  const { data: topic } = useQuery({
    queryKey: ['topic', suggestion?.topicId],
    queryFn: async () => {
      const topics = await base44.entities.Topic.filter({ id: suggestion.topicId });
      return topics?.[0] ?? null;
    },
    enabled: !!suggestion?.topicId,
    staleTime: 5000
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false
  });

  const { data: isAdmin } = useQuery({
    queryKey: ['isAdmin', document?.id, user?.id],
    queryFn: async () => {
      if (!user?.id || !document?.id) return false;
      const admins = await base44.entities.DocumentAdmin.filter({ documentId: document.id, userId: user.id });
      return admins.length > 0;
    },
    enabled: !!user?.id && !!document?.id
  });

  const { data: userVote } = useQuery({
    queryKey: ['userVote', suggestionId, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const allVotes = await base44.entities.Vote.filter({ suggestionId });
      const userVotes = allVotes.filter((v) => v.userId === user.id);
      return userVotes.length > 0 ? userVotes[0] : null;
    },
    enabled: !!suggestionId && !!user?.id,
    staleTime: 30 * 1000,
  });

  // Real-time subscription for votes
  React.useEffect(() => {
    if (!suggestionId || !user?.id) return;
    let voteTimer;
    const unsubscribe = base44.entities.Vote.subscribe(() => {
      clearTimeout(voteTimer);
      voteTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['userVote', suggestionId, user.id] });
        queryClient.invalidateQueries({ queryKey: ['suggestion', suggestionId] });
      }, 500);
    });
    return () => { unsubscribe(); clearTimeout(voteTimer); };
  }, [suggestionId, user?.id, queryClient]);

  const { data: args } = useQuery({
    queryKey: ['arguments', suggestionId],
    queryFn: () => base44.entities.Argument.filter({ suggestionId }, '-created_date'),
    initialData: [],
    enabled: !!suggestionId
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', 'suggestion', suggestionId],
    queryFn: () => base44.entities.Comment.filter({ rootEntityType: 'suggestion', rootEntityId: suggestionId }),
    initialData: [],
    enabled: !!suggestionId
  });

  const totalCommentsCount = React.useMemo(() => comments.length, [comments]);

  const { data: sectionVersions } = useQuery({
    queryKey: ['sectionVersions', suggestion?.sectionId],
    queryFn: () => base44.entities.DocumentVersion.filter({ sectionId: suggestion.sectionId }, '-version'),
    initialData: [],
    enabled: !!suggestion?.sectionId && suggestion?.type === 'edit_section'
  });

  // Bulk public profiles (up to 1000, cached) — admins aren't required to read these
  const { data: publicProfiles = [] } = useOptimizedUserProfiles();

  // Fetch the author's profile specifically in case it falls outside the bulk list
  const { data: authorProfile } = useQuery({
    queryKey: ['authorProfile', suggestion?.created_by_id],
    queryFn: async () => {
      if (!suggestion?.created_by_id) return null;
      const profiles = await base44.entities.UserPublicProfile.filter({ userId: suggestion.created_by_id });
      return profiles?.[0] ?? null;
    },
    enabled: !!suggestion?.created_by_id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: topics } = useQuery({
    queryKey: ['topics', suggestion?.documentId],
    queryFn: () => base44.entities.Topic.filter({ documentId: suggestion.documentId }, 'order'),
    enabled: !!suggestion?.documentId,
    placeholderData: []
  });

  const { data: sections } = useQuery({
    queryKey: ['sections', suggestion?.documentId],
    queryFn: () => base44.entities.Section.filter({ documentId: suggestion.documentId }),
    enabled: !!suggestion?.documentId,
    placeholderData: []
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const voteMutation = useMutation({
    mutationFn: async (vote) => {
      if (!user) throw new Error(t('mustBeLoggedInToVote'));
      if (!suggestion) throw new Error('Suggestion not found');
      const response = await base44.functions.invoke('voteOnSuggestion', { suggestionId, vote });
      if (!response.data.success) throw new Error(response.data.error || 'שגיאה בהצבעה');
      return { accepted: response.data.accepted, newProVotes: response.data.newProVotes, newConVotes: response.data.newConVotes };
    },
    onMutate: async (vote) => {
      return await votingQueue.add(async () => {
        await queryClient.cancelQueries({ queryKey: ['suggestion', suggestionId] });
        await queryClient.cancelQueries({ queryKey: ['userVote', suggestionId, user?.id] });

        const previousSuggestion = queryClient.getQueryData(['suggestion', suggestionId]);
        const previousVote = queryClient.getQueryData(['userVote', suggestionId, user?.id]);

        queryClient.setQueryData(['suggestion', suggestionId], (old) => {
          if (!old) return old;
          let newProVotes = old.proVotes || 0;
          let newConVotes = old.conVotes || 0;
          if (userVote) {
            if (userVote.vote === vote) {
              if (vote === 'pro') newProVotes = Math.max(0, newProVotes - 1);
              else newConVotes = Math.max(0, newConVotes - 1);
            } else {
              if (vote === 'pro') { newProVotes += 1; newConVotes = Math.max(0, newConVotes - 1); }
              else { newConVotes += 1; newProVotes = Math.max(0, newProVotes - 1); }
            }
          } else {
            if (vote === 'pro') newProVotes += 1;
            else newConVotes += 1;
          }
          return { ...old, proVotes: newProVotes, conVotes: newConVotes };
        });

        queryClient.setQueryData(['userVote', suggestionId, user?.id], (old) => {
          if (userVote) {
            if (userVote.vote === vote) return null;
            return { ...old, vote };
          }
          return { id: 'temp-' + Date.now(), suggestionId, userId: user.id, vote };
        });

        return { previousSuggestion, previousVote };
      });
    },
    onError: (err, variables, context) => {
      if (context?.previousSuggestion) queryClient.setQueryData(['suggestion', suggestionId], context.previousSuggestion);
      if (context?.previousVote !== undefined) queryClient.setQueryData(['userVote', suggestionId, user?.id], context.previousVote);

      const startRateLimitCountdown = (seconds) => {
        setRateLimitRetryAfter(seconds);
        const interval = setInterval(() => {
          setRateLimitRetryAfter((prev) => {
            if (prev === null || prev <= 1) { clearInterval(interval); return null; }
            return prev - 1;
          });
        }, 1000);
      };

      if (err.response?.status === 429 || err.response?.data?.remainingSeconds) {
        startRateLimitCountdown(err.response.data?.remainingSeconds || 30);
      } else if (err.message?.includes('המתן') || err.message?.toLowerCase().includes('wait')) {
        const match = err.message.match(/(\d+)\s*(?:שניות|seconds)/);
        startRateLimitCountdown(match ? parseInt(match[1]) : 30);
      } else {
        setError(err.response?.data?.error || err.message);
        setTimeout(() => setError(null), 5000);
      }
    },
    onSuccess: (data) => {
      // Always refresh suggestion to get accurate server-side vote counts
      queryClient.invalidateQueries({ queryKey: ['suggestion', suggestionId] });
      queryClient.invalidateQueries({ queryKey: ['userVote', suggestionId, user?.id] });
      if (data?.accepted === true) {
        toast.success(isRTL ? 'ההצעה התקבלה! ✓' : 'Suggestion accepted! ✓', { duration: 4000 });
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['sections', document?.id] });
          queryClient.invalidateQueries({ queryKey: ['document', document?.id] });
        }, 2000);
      }
    }
  });

  const addArgumentMutation = useMutation({
    mutationFn: async ({ type, content }) => {
      if (!user) throw new Error(t('mustBeLoggedIn'));
      if (!content.trim()) throw new Error(t('argumentContentRequired'));
      await base44.entities.Argument.create({ suggestionId, type, content: content.trim(), convincedCount: 0 });
      if (suggestion?.documentId) {
        try {
          const { calculateDocumentContributors } = await import('../components/document/calculateContributors');
          const count = await calculateDocumentContributors(suggestion.documentId);
          await base44.entities.Document.update(suggestion.documentId, { totalUsersInteracted: count });
        } catch (err) {
          console.error('[UPDATE CONTRIBUTORS ERROR]', err);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['arguments', suggestionId] });
      setNewArgument({ type: null, content: "" });
    },
    onError: (err) => { setError(err.message); setTimeout(() => setError(null), 5000); }
  });

  // Retry helper with exponential backoff
  const retryWithBackoff = async (fn, maxAttempts = 3, initialDelayMs = 500) => {
    let lastError;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try { return await fn(); } catch (error) {
        lastError = error;
        if (attempt < maxAttempts - 1) await new Promise((r) => setTimeout(r, initialDelayMs * Math.pow(2, attempt)));
      }
    }
    throw lastError;
  };

  const updateStatusMutation = useMutation({
    mutationFn: async (status) => {
      if (!isAdmin) throw new Error(t('adminAccessRequired'));

      // If restoring to pending, set a new timer based on document's default lifetime
      let updateData = { status };
      if (status === 'pending') {
        // If defaultSuggestionLifetimeHours is null, no time limit (timerEndsAt = null)
        const timerEndsAt = document?.defaultSuggestionLifetimeHours === null 
          ? null 
          : new Date(Date.now() + (document?.defaultSuggestionLifetimeHours || 72) * 60 * 60 * 1000).toISOString();
        updateData.timerEndsAt = timerEndsAt;
        updateData.rejectedByAdmin = false; // Clear the rejected flag
      } else if (status === 'rejected') {
        updateData.rejectedByAdmin = true; // Mark as rejected by admin
      } else if (status === 'accepted') {
        updateData.approvedByAdmin = true; // Mark as approved by admin
      }

      if (status === 'accepted' && suggestion.type === 'edit_section' && section) {
        const versions = await retryWithBackoff(() => base44.entities.DocumentVersion.filter({ sectionId: section.id }));
        const nextVersion = versions.length > 0 ? Math.max(...versions.map((v) => v.version)) + 1 : 1;
        await retryWithBackoff(() => base44.entities.DocumentVersion.create({
          documentId: suggestion.documentId, sectionId: section.id, content: section.content,
          changeDescription: `לפני: ${suggestion.title}`, version: nextVersion, changeType: 'suggestion_accepted', suggestionId: suggestion.id
        }));
        await new Promise((r) => setTimeout(r, 300));
        await retryWithBackoff(() => base44.entities.Section.update(section.id, { content: suggestion.newContent, lastEditedBy: user.id, originalLanguage: suggestion.originalLanguage || 'he', translations: {} }));
        await new Promise((r) => setTimeout(r, 300));
        await retryWithBackoff(() => base44.entities.DocumentVersion.create({
          documentId: suggestion.documentId, sectionId: section.id, content: suggestion.newContent,
          changeDescription: suggestion.title, version: nextVersion + 1, changeType: 'suggestion_accepted', suggestionId: suggestion.id
        }));
      } else if (status === 'accepted' && suggestion.type === 'new_section') {
        const existingSections = await retryWithBackoff(() =>
          base44.entities.Section.filter({ documentId: suggestion.documentId, topicId: suggestion.topicId }, 'order')
        );
        let newOrder;
        if (suggestion.insertPosition !== undefined && suggestion.insertPosition !== null) {
          for (const sec of existingSections.filter((s) => s.order >= suggestion.insertPosition)) {
            await retryWithBackoff(() => base44.entities.Section.update(sec.id, { order: sec.order + 1 }));
            await new Promise((r) => setTimeout(r, 200));
          }
          newOrder = suggestion.insertPosition;
        } else {
          newOrder = existingSections.length > 0 ? Math.max(...existingSections.map((s) => s.order)) + 1 : 0;
        }
        const newSection = await retryWithBackoff(() => base44.entities.Section.create({
          documentId: suggestion.documentId, topicId: suggestion.topicId,
          content: suggestion.newContent, order: newOrder, lastEditedBy: user.id,
          originalLanguage: suggestion.originalLanguage || 'he', translations: {}
        }));
        await new Promise((r) => setTimeout(r, 300));
        await retryWithBackoff(() => base44.entities.DocumentVersion.create({
          documentId: suggestion.documentId, sectionId: newSection.id, content: suggestion.newContent,
          changeDescription: suggestion.title, version: 1, changeType: 'section_created', suggestionId: suggestion.id
        }));
        // Update suggestion with sectionId so SectionCarousel can link it
        updateData.sectionId = newSection.id;
        updateData.type = 'edit_section';
        updateData.originalContent = suggestion.newContent;
      }

      await new Promise((r) => setTimeout(r, 300));
      await retryWithBackoff(() => base44.entities.Suggestion.update(suggestionId, updateData));

      const updatedSuggestions = await retryWithBackoff(() => base44.entities.Suggestion.filter({ id: suggestionId }));
      const updatedSuggestion = updatedSuggestions[0] || { ...suggestion, status };

      await new Promise((r) => setTimeout(r, 300));
      await notifySuggestionStatusChange({ suggestion: updatedSuggestion, newStatus: status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestion', suggestionId] });
      queryClient.invalidateQueries({ queryKey: ['sections', document?.id] });
      queryClient.invalidateQueries({ queryKey: ['versions'] });
    },
    onError: (err) => { setError(err.message); setTimeout(() => setError(null), 5000); }
  });

  const deleteSuggestionMutation = useMutation({
    mutationFn: async () => {
      if (!user || user.id !== suggestion.created_by_id) throw new Error(t('onlyCreatorCanDelete'));
      await base44.entities.Suggestion.delete(suggestionId);
    },
    onSuccess: () => navigate(`${createPageUrl(PAGE_NAMES.DOCUMENT_VIEW)}?id=${suggestion.documentId}`),
    onError: (err) => { setError(err.message); setTimeout(() => setError(null), 5000); }
  });

  const updateExplanationMutation = useMutation({
    mutationFn: async (newExplanation) => base44.entities.Suggestion.update(suggestionId, { explanation: newExplanation }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestion', suggestionId] });
      setIsEditingExplanation(false);
    },
    onError: (err) => { setError(err.message); setTimeout(() => setError(null), 5000); }
  });

  // ── Side Effects ───────────────────────────────────────────────────────────

  // Scroll to comment from notification link
  React.useEffect(() => {
    if (!commentId || !comments || comments.length === 0 || typeof window === 'undefined') return;
    let scrollTimer, highlightTimer, attempts = 0;
    const attemptScroll = () => {
      const el = window.document.getElementById(`comment-${commentId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'background-color 0.3s ease';
        el.style.backgroundColor = '#dbeafe';
        highlightTimer = setTimeout(() => { el.style.backgroundColor = ''; }, 3000);
      } else if (attempts < 5) {
        attempts++;
        scrollTimer = setTimeout(attemptScroll, 300 * attempts);
      }
    };
    scrollTimer = setTimeout(attemptScroll, 500);
    return () => { clearTimeout(scrollTimer); clearTimeout(highlightTimer); };
  }, [commentId, comments]);

  // ── Derived values (hooks must run before early returns) ──────────────────

  const isContentStillCurrent = React.useMemo(() => {
    if (suggestion?.type !== 'edit_section' || !suggestion?.originalContent || !section?.content) return false;
    return suggestion.originalContent.trim() === section.content.trim();
  }, [suggestion, section]);

  const proArgs = args.filter((a) => a.type === 'pro');
  const conArgs = args.filter((a) => a.type === 'con');
  const consensusScore = suggestion && suggestion.proVotes + suggestion.conVotes > 0
    ? (suggestion.proVotes / (suggestion.proVotes + suggestion.conVotes) * 100).toFixed(0)
    : 50;

  const suggestionVersions = sectionVersions.filter((v) => v.suggestionId);
  const currentVersionIndex = suggestionVersions.findIndex((v) => v.suggestionId === suggestionId);

  const suggestionChain = useMemo(() => {
    if (!suggestion || !allDocumentSuggestions || allDocumentSuggestions.length === 0) return [];
    let chain = [];
    let current = allDocumentSuggestions.find((s) => s.id === suggestion.id);
    while (current && current.parentSuggestionId) {
      const parent = allDocumentSuggestions.find((s) => s.id === current.parentSuggestionId);
      if (!parent || chain.some((item) => item.id === parent.id)) break;
      chain.unshift(parent);
      current = parent;
    }
    if (current && !chain.some((item) => item.id === current.id)) chain.unshift(current);
    const root = chain[0];
    if (!root) {
      return (suggestion.type === 'new_section' || suggestion.type === 'edit_suggestion') ? [suggestion] : [];
    }
    let fullChain = [...chain];
    let head = chain[chain.length - 1];
    let visitedIds = new Set(fullChain.map((s) => s.id));
    while (head) {
      const next = allDocumentSuggestions
        .filter((s) => s.parentSuggestionId === head.id)
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0];
      if (next && !visitedIds.has(next.id)) { fullChain.push(next); visitedIds.add(next.id); head = next; }
      else head = null;
    }
    return fullChain.filter((s) => s.type === 'new_section' || s.type === 'edit_suggestion');
  }, [suggestion, allDocumentSuggestions]);

  const currentSuggestionIndexInChain = useMemo(() => suggestionChain.findIndex((s) => s.id === suggestionId), [suggestionChain, suggestionId]);

  // ── Helper fns ─────────────────────────────────────────────────────────────

  const getUserName = (userId) => {
    if (!userId) return '';
    const profile = (publicProfiles || []).find((p) => p.userId === userId)
      || (authorProfile?.userId === userId ? authorProfile : null);
    return profile?.fullName || '';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'accepted': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  // ── Early returns (AFTER all hooks) ────────────────────────────────────────

  if (suggestionLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (suggestionError || (!suggestion && !suggestionLoading)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-5xl mx-auto text-center py-20">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-slate-400" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{t('suggestionNotFound')}</h1>
          <p className="text-slate-600 mb-6">
            {isRTL ? 'ההצעה אולי נמחקה או שאין לך הרשאה לצפות בה' : "The suggestion may have been deleted or you don't have permission to view it"}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button variant="outline" onClick={() => navigate(createPageUrl("MyDocuments"))}>
              {t('myDocuments')}
            </Button>
            <Button onClick={() => navigate(createPageUrl("Home"))}>{t('goHome')}</Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6 overflow-x-hidden">
      <div className="max-w-5xl mx-auto space-y-4 md:space-y-6 w-full overflow-x-hidden">

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex-1 min-w-0 w-full">
            <PageHeader
              title={suggestion.title}
              documentTitle={document?.title}
              backUrl={`${createPageUrl(PAGE_NAMES.DOCUMENT_VIEW)}?id=${suggestion.documentId}`}
            />
          </div>
          {user && user.id === suggestion.created_by_id && suggestion.status !== 'accepted' &&
            <button
              onClick={() => { if (confirm(t('confirmDeleteSuggestion'))) deleteSuggestionMutation.mutate(); }}
              disabled={deleteSuggestionMutation.isPending}
              className="shrink-0 p-1 text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
              title={t('deleteSuggestion')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          }
        </div>

        {error &&
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        }

        <Card className="bg-white border-slate-200 w-full overflow-hidden">
          <CardHeader className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row items-start md:justify-between gap-3">
              <div className="flex flex-wrap gap-2 items-center">
                <Badge variant="outline" className={`text-xs ${suggestion.type === 'delete_section' ? 'bg-red-100 text-red-800 border-red-200' : ''}`}>
                  {suggestion.type === 'new_section' ? t('newSection')
                    : suggestion.type === 'delete_section' ? (language === 'he' ? 'מחיקת סעיף' : language === 'ar' ? 'حذف قسم' : 'Delete Section')
                    : suggestion.type === 'edit_suggestion' ? (isRTL ? 'הצעה לעריכת הצעה' : 'Edit Suggestion')
                    : t('suggestionToEditSection')}
                </Badge>

                {suggestion.status === 'rejected' && suggestion.rejectedByAdmin
                  ? <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 text-xs">
                      {language === 'he' ? 'נדחתה על ידי אדמין' : language === 'ar' ? 'مرفوضة من المشرف' : 'Rejected by Admin'}
                    </Badge>
                  : suggestion.status === 'rejected' && !suggestion.rejectedByAdmin
                  ? <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200 text-xs">
                      {language === 'he' ? 'פג תוקפה' : language === 'ar' ? 'انتهت صلاحيتها' : 'Expired'}
                    </Badge>
                  : <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Badge variant="outline" className={`${getStatusColor(suggestion.status)} text-xs cursor-default`}>
                              {t(suggestion.status)}
                            </Badge>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          {suggestion.status === 'pending' ? (language === 'he' ? 'ממתינה להצבעה' : language === 'ar' ? 'في انتظار التصويت' : 'Awaiting votes')
                            : suggestion.status === 'accepted' ? (language === 'he' ? 'ההצעה התקבלה ויושמה במסמך' : language === 'ar' ? 'تمت الموافقة على الاقتراح' : 'Proposal accepted and applied')
                            : suggestion.status === 'rejected' ? (language === 'he' ? 'ההצעה נדחתה' : language === 'ar' ? 'تم رفض الاقتراح' : 'Proposal rejected')
                            : suggestion.status === 'discussion' ? (language === 'he' ? 'בדיון פתוח' : language === 'ar' ? 'قيد النقاش' : 'Open for discussion')
                            : suggestion.status}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                }

                <span className="text-xs text-slate-500">
                  {t('by')} <Link to={`${createPageUrl("Profile")}?userId=${suggestion.created_by_id || ''}`} className="hover:underline text-blue-600">{getUserName(suggestion.created_by_id)}</Link>
                </span>
                {suggestion.created_date &&
                  <span className="text-xs text-slate-400">
                    • {new Date(suggestion.created_date).toLocaleString(language === 'he' ? 'he-IL' : language === 'ar' ? 'ar-SA' : 'en-GB', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                }
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {suggestion.timerEndsAt &&
                  <SuggestionCountdown timerEndsAt={suggestion.timerEndsAt} size="sm" status={suggestion.status} />
                }

                {suggestion.approvedByAdmin && suggestion.status === 'accepted' &&
                  <Badge variant="outline" className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                    <ShieldCheck className="w-3 h-3" />
                    {language === 'he' ? 'אושר ע״י מנהל' : language === 'ar' ? 'تمت الموافقة من المشرف' : 'Admin Approved'}
                  </Badge>
                }
                {suggestion.status === 'rejected' && suggestion.rejectedByAdmin && suggestion.updated_date &&
                  <span className="text-xs text-slate-500">
                    {language === 'he' ? 'נדחתה ב-' : language === 'ar' ? 'تم الرفض في' : 'Rejected on'} {new Date(suggestion.updated_date).toLocaleString(language === 'he' ? 'he-IL' : language === 'ar' ? 'ar-SA' : 'en-US', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                }
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 md:space-y-6 p-3 md:p-6 overflow-x-hidden">

            {suggestion.type === 'delete_section'
              ? <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-red-700">{language === 'he' ? 'סעיף שמוצע למחיקה' : language === 'ar' ? 'القسم المقترح حذفه' : 'Section to be deleted'}</h3>
                    
                    <Button variant="outline" size="sm" onClick={() => { navigate(`${createPageUrl("DocumentView")}?id=${suggestion.documentId}#suggestion-${suggestionId}`); setTimeout(() => { window.document?.getElementById(`suggestion-${suggestionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 300); }} className="h-7 px-2 text-xs">
                      <FileText className={`w-3 h-3 ${isRTL ? 'ml-1.5' : 'mr-1.5'}`} />{isRTL ? 'חזרה למסמך' : 'Back to Document'}
                    </Button>
                  </div>
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="prose prose-sm max-w-none text-slate-700 line-through opacity-60" dangerouslySetInnerHTML={{ __html: suggestion.originalContent }} />
                  </div>
                </div>
              : (suggestion.type === 'edit_section' || (suggestion.type === 'edit_suggestion' && suggestion.originalContent))
              ? <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700">{t('proposedChanges')}</h3>
                    <Button variant="outline" size="sm" onClick={() => { navigate(`${createPageUrl("DocumentView")}?id=${suggestion.documentId}#section-${suggestion.sectionId}`); setTimeout(() => { window.document?.getElementById(`section-${suggestion.sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 300); }} className="h-7 px-2 text-xs">
                      <FileText className={`w-3 h-3 ${isRTL ? 'ml-1.5' : 'mr-1.5'}`} />{isRTL ? 'חזרה למסמך' : 'Back to Document'}
                    </Button>
                  </div>
                  <div className="relative">
                    {isAutoAccepting && <div className="absolute inset-0 bg-white/50 rounded-lg flex flex-col items-center justify-center z-10 gap-3"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /><p className="text-sm font-medium text-slate-700">{isRTL ? 'מעבד הצעה...' : 'Processing suggestion...'}</p></div>}
                    <SectionDiff originalContent={suggestion.originalContent} newContent={suggestion.newContent} suggestion={suggestion} documentId={suggestion.documentId} sectionId={suggestion.sectionId} section={section} />
                  </div>
                  {(suggestion.explanation || (user && user.id === suggestion.created_by_id)) && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-slate-700">{t('explanation')}</h3>
                        {user && user.id === suggestion.created_by_id && !isEditingExplanation &&
                          <Button variant="ghost" size="sm" onClick={() => { setEditedExplanation(suggestion.explanation || ""); setIsEditingExplanation(true); }} className="h-7 px-2">
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        }
                      </div>
                      {isEditingExplanation
                        ? <div className="space-y-2">
                            <Textarea value={editedExplanation} onChange={(e) => setEditedExplanation(e.target.value)} placeholder={t('explainChange')} rows={3} dir={isRTL ? 'rtl' : 'ltr'} />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => updateExplanationMutation.mutate(editedExplanation)} disabled={updateExplanationMutation.isPending}>
                                <Save className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />{t('saveChanges')}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setIsEditingExplanation(false)}>
                                <X className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />{t('cancel')}
                              </Button>
                            </div>
                          </div>
                        : suggestion.explanation && typeof suggestion.explanation === 'string'
                        ? <TranslatableContent content={suggestion.explanation} entity={suggestion} entityType="Suggestion" fieldName="explanation" onUpdate={(updated) => queryClient.setQueryData(['suggestion', suggestionId], updated)} className="text-slate-600" />
                        : <p className="text-slate-400 text-sm italic">{t('noDescription')}</p>
                      }
                    </div>
                  )}
                </div>
              : suggestion.type === 'new_section'
              ? <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700">{t('proposedContent')}</h3>
                    <Button variant="outline" size="sm" onClick={() => { navigate(`${createPageUrl("DocumentView")}?id=${suggestion.documentId}#suggestion-${suggestionId}`); setTimeout(() => { window.document?.getElementById(`suggestion-${suggestionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 300); }} className="h-7 px-2 text-xs">
                      <FileText className={`w-3 h-3 ${isRTL ? 'ml-1.5' : 'mr-1.5'}`} />{isRTL ? 'חזרה למסמך' : 'Back to Document'}
                    </Button>
                  </div>
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <TranslatableContent content={suggestion.newContent} entity={suggestion} entityType="Suggestion" onUpdate={(updated) => queryClient.setQueryData(['suggestion', suggestionId], updated)} className="prose prose-sm max-w-none" renderContent={(content) => <DocumentTextContent content={content} />} />
                  </div>
                  {(suggestion.explanation || (user && user.id === suggestion.created_by_id)) && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-slate-700">{t('explanation')}</h3>
                        {user && user.id === suggestion.created_by_id && !isEditingExplanation &&
                          <Button variant="ghost" size="sm" onClick={() => { setEditedExplanation(suggestion.explanation || ""); setIsEditingExplanation(true); }} className="h-7 px-2">
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        }
                      </div>
                      {isEditingExplanation
                        ? <div className="space-y-2">
                            <Textarea value={editedExplanation} onChange={(e) => setEditedExplanation(e.target.value)} placeholder={t('explainChange')} rows={3} dir={isRTL ? 'rtl' : 'ltr'} />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => updateExplanationMutation.mutate(editedExplanation)} disabled={updateExplanationMutation.isPending}>
                                <Save className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />{t('saveChanges')}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setIsEditingExplanation(false)}>
                                <X className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />{t('cancel')}
                              </Button>
                            </div>
                          </div>
                        : suggestion.explanation && typeof suggestion.explanation === 'string'
                        ? <TranslatableContent content={suggestion.explanation} entity={suggestion} entityType="Suggestion" fieldName="explanation" onUpdate={(updated) => queryClient.setQueryData(['suggestion', suggestionId], updated)} className="text-slate-600" />
                        : <p className="text-slate-400 text-sm italic">{t('noDescription')}</p>
                      }
                    </div>
                  )}
                </div>
              : null
            }

            {suggestion.type === 'new_section' && suggestion.status === 'pending' &&
              <div className="pt-4">
                <Button variant="outline" onClick={() => setShowEditSuggestionModal(true)} className="w-full">
                  <Edit2 className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {language === 'he' ? 'הצעת עריכה להצעה זו' : language === 'ar' ? 'اقترح تعديلاً على هذا الاقتراح' : 'Suggest an Edit to this Suggestion'}
                </Button>
              </div>
            }

            {document?.votingButtonsEnabled &&
              <div className="pt-4 border-t space-y-4">

                {/* For closed suggestions: show VotingProgressSection in read-only mode */}
                {suggestion.status !== 'pending'
                  ? <VotingProgressSection
                      suggestion={suggestion}
                      document={document}
                      userVote={userVote}
                      voteMutation={voteMutation}
                      isRTL={isRTL}
                      readOnly={true}
                      acceptedDate={suggestion.status === 'accepted' ? suggestion.updated_date : undefined}
                      rejectedDate={suggestion.status === 'rejected' ? suggestion.updated_date : undefined}
                    />
                  : <>
                      {/* For pending suggestions: use VotingProgressSection (same as sidebar/document) */}
                      <VotingProgressSection
                        suggestion={suggestion}
                        document={document}
                        userVote={userVote}
                        voteMutation={{ mutate: (vote) => { if (!user) { base44.auth.redirectToLogin(window.location.href); return; } voteMutation.mutate(vote); }, isPending: voteMutation.isPending || rateLimitRetryAfter !== null }}
                        isRTL={isRTL}
                        readOnly={false}
                      />
                      {rateLimitRetryAfter &&
                        <div className="flex items-center justify-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                          <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                          <p className="text-xs font-medium text-amber-800">
                            {language === 'he' ? `אנא המתן ${rateLimitRetryAfter} שניות` : language === 'ar' ? `يرجى الانتظار ${rateLimitRetryAfter} ثانية` : `Please wait ${rateLimitRetryAfter} seconds`}
                          </p>
                        </div>
                      }
                    </>
                }

                {isAdmin && suggestion.status === 'pending' &&
                   <div className="flex gap-2 pt-3 border-t">
                     <Button onClick={() => updateStatusMutation.mutate('accepted')} disabled={updateStatusMutation.isPending} className="flex-1 bg-green-600 hover:bg-green-700">
                       {updateStatusMutation.isPending ? <Loader2 className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'} animate-spin`} /> : <CheckCircle className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />}
                       {t('acceptSuggestion')}
                     </Button>
                     <Button onClick={() => updateStatusMutation.mutate('rejected')} disabled={updateStatusMutation.isPending} variant="destructive" className="flex-1">
                       {updateStatusMutation.isPending ? <Loader2 className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'} animate-spin`} /> : <XCircle className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />}
                       {t('rejectSuggestion')}
                     </Button>
                   </div>
                 }

                {isAdmin && suggestion.status === 'rejected' &&
                   <div className="pt-3 border-t">
                     <Button onClick={() => updateStatusMutation.mutate('pending')} disabled={updateStatusMutation.isPending} className="w-full bg-blue-600 hover:bg-blue-700">
                       {updateStatusMutation.isPending ? <Loader2 className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'} animate-spin`} /> : <Clock className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />}
                       {language === 'he' ? 'החזר להצבעה' : language === 'ar' ? 'إعادة التصويت' : 'Restore to Voting'}
                     </Button>
                   </div>
                 }
              </div>
            }
          </CardContent>
        </Card>

        {suggestionChain && suggestionChain.length > 1 &&
          <Card className="bg-white border-slate-200 w-full overflow-hidden">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-base md:text-lg">{isRTL ? 'היסטוריית עריכה של ההצעה' : 'Suggestion Edit History'}</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 flex justify-between items-center">
              <Button
                variant="outline"
                onClick={() => {
                  const prev = suggestionChain[currentSuggestionIndexInChain - 1];
                  if (prev) navigate(`${createPageUrl(PAGE_NAMES.SUGGESTION_DETAIL)}?id=${prev.id}`);
                }}
                disabled={currentSuggestionIndexInChain <= 0}
              >
                <ChevronLeft className="w-4 h-4" />{isRTL ? 'גרסה קודמת' : 'Previous Version'}
              </Button>
              <span className="text-sm text-slate-600">{isRTL ? 'גרסה' : 'Version'} {currentSuggestionIndexInChain + 1} / {suggestionChain.length}</span>
              <Button
                variant="outline"
                onClick={() => {
                  const next = suggestionChain[currentSuggestionIndexInChain + 1];
                  if (next) navigate(`${createPageUrl(PAGE_NAMES.SUGGESTION_DETAIL)}?id=${next.id}`);
                }}
                disabled={currentSuggestionIndexInChain >= suggestionChain.length - 1}
              >
                {isRTL ? 'גרסה הבאה' : 'Next Version'}<ChevronRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        }

        <Card className="bg-white border-slate-200 w-full overflow-hidden">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-base md:text-lg">{t('commentsOnSuggestion')} ({totalCommentsCount})</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 overflow-x-hidden">
            <CommentsSection entityType="suggestion" entityId={suggestionId} user={user} scrollToCommentId={commentId} />
          </CardContent>
        </Card>
      </div>

      {showEditSectionModal && section &&
        <CreateSuggestionModal document={document} topics={topics} sections={sections} editingSection={{ id: section.id, topicId: section.topicId }} user={user} onClose={() => setShowEditSectionModal(false)} isAdmin={isAdmin} onSuggestionCreated={(newSuggestionId) => { setShowEditSectionModal(false); navigate(`${createPageUrl(PAGE_NAMES.SUGGESTION_DETAIL)}?id=${newSuggestionId}`); }} />
      }
      {showEditSuggestionModal &&
        <CreateSuggestionModal document={document} topics={topics} sections={sections} editingSuggestion={suggestion} user={user} onClose={() => setShowEditSuggestionModal(false)} isAdmin={isAdmin} onSuggestionCreated={(newSuggestionId) => { setShowEditSuggestionModal(false); navigate(`${createPageUrl(PAGE_NAMES.SUGGESTION_DETAIL)}?id=${newSuggestionId}`); }} />
      }
    </div>
  );
}