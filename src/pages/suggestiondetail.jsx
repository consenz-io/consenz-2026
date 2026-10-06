import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { parseUserDate } from "@/components/utils/dateFormatter";
import { PAGE_NAMES } from "@/components/pageNames";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ThumbsUp, ThumbsDown, Clock,
  CheckCircle, XCircle, AlertCircle, Loader2, Trash2, Edit2, ShieldCheck } from
"lucide-react";
import SuggestionCountdown from "@/components/document/SuggestionCountdown";
import VotingProgressSection from "../components/document/VotingProgressSection";
import { Skeleton } from "@/components/ui/skeleton";
import CommentsSection from "../components/document/CommentsSection";
import SectionDiff from "../components/document/SectionDiff";
import TranslatableContent from "../components/document/TranslatableContent";
import TranslateAllButton from "../components/document/TranslateAllButton";
import { TranslationProvider } from "../components/document/TranslationContext";
import DocumentTextContent from "../components/document/DocumentTextContent";
import { votingQueue } from "../components/document/VotingQueue";

import { useLanguage } from "@/components/LanguageContext";
import { notifySuggestionStatusChange } from "../components/notifications/createNotification";
import BackToDocumentButton from "@/components/suggestion/BackToDocumentButton";
import SuggestionExplanationBlock from "@/components/suggestion/SuggestionExplanationBlock";
import SuggestionChainNavigation from "@/components/suggestion/SuggestionChainNavigation";
import CreateSuggestionModal from "../components/document/CreateSuggestionModal";
import { toast } from "sonner";
import { castVote } from "@/components/document/utils/castVote";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

function SuggestionDetail() {
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
  const [isAccepting, setIsAccepting] = useState(false);

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
    staleTime: 30 * 1000 // 30s — allows real-time updates to show after invalidation
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
    staleTime: 5 * 60 * 1000
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
    staleTime: 5 * 60 * 1000
  });

  const { data: section } = useQuery({
    queryKey: ['section', suggestion?.sectionId],
    queryFn: async () => {
      const sections = await base44.entities.Section.filter({ id: suggestion.sectionId });
      return sections?.[0] ?? null;
    },
    enabled: !!suggestion?.sectionId,
    staleTime: 5 * 60 * 1000
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
    staleTime: 30 * 1000
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
    return () => {unsubscribe();clearTimeout(voteTimer);};
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

  // Fetch the author's profile specifically in case it falls outside the bulk list
  const { data: authorProfile } = useQuery({
    queryKey: ['authorProfile', suggestion?.created_by_id],
    queryFn: async () => {
      if (!suggestion?.created_by_id) return null;
      const profiles = await base44.entities.UserPublicProfile.filter({ userId: suggestion.created_by_id });
      return profiles?.[0] ?? null;
    },
    enabled: !!suggestion?.created_by_id,
    staleTime: 5 * 60 * 1000
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
      return await castVote({ suggestionId, vote, document, user });
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
              if (vote === 'pro') newProVotes = Math.max(0, newProVotes - 1);else
              newConVotes = Math.max(0, newConVotes - 1);
            } else {
              if (vote === 'pro') {newProVotes += 1;newConVotes = Math.max(0, newConVotes - 1);} else
              {newConVotes += 1;newProVotes = Math.max(0, newProVotes - 1);}
            }
          } else {
            if (vote === 'pro') newProVotes += 1;else
            newConVotes += 1;
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
            if (prev === null || prev <= 1) {clearInterval(interval);return null;}
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
        toast.success(t('suggestionAcceptedToast'), { duration: 4000 });
        setIsAccepting(true);
        Promise.all([
          queryClient.refetchQueries({ queryKey: ['suggestion', suggestionId] }),
          queryClient.refetchQueries({ queryKey: ['sections', document?.id] }),
          queryClient.refetchQueries({ queryKey: ['document', document?.id] }),
        ]).finally(() => setIsAccepting(false));
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
    onError: (err) => {setError(err.message);setTimeout(() => setError(null), 5000);}
  });

  // Retry helper with exponential backoff
  const retryWithBackoff = async (fn, maxAttempts = 3, initialDelayMs = 500) => {
    let lastError;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {return await fn();} catch (error) {
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
        const timerEndsAt = document?.defaultSuggestionLifetimeHours === null ?
        null :
        new Date(Date.now() + (document?.defaultSuggestionLifetimeHours || 72) * 60 * 60 * 1000).toISOString();
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
        await retryWithBackoff(() => base44.entities.Section.update(section.id, { content: suggestion.newContent, lastEditedBy: user.id, originalLanguage: suggestion.originalLanguage || 'he' }));
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
          originalLanguage: suggestion.originalLanguage || 'he'
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
    onError: (err) => {setError(err.message);setTimeout(() => setError(null), 5000);}
  });

  const deleteSuggestionMutation = useMutation({
    mutationFn: async () => {
      if (!user || user.id !== suggestion.created_by_id) throw new Error(t('onlyCreatorCanDelete'));
      await base44.entities.Suggestion.delete(suggestionId);
    },
    onSuccess: () => navigate(`${createPageUrl(PAGE_NAMES.DOCUMENT_VIEW)}?id=${suggestion.documentId}`),
    onError: (err) => {setError(err.message);setTimeout(() => setError(null), 5000);}
  });

  const updateExplanationMutation = useMutation({
    mutationFn: async (newExplanation) => base44.entities.Suggestion.update(suggestionId, { explanation: newExplanation }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestion', suggestionId] });
      setIsEditingExplanation(false);
    },
    onError: (err) => {setError(err.message);setTimeout(() => setError(null), 5000);}
  });

  // ── Side Effects ───────────────────────────────────────────────────────────

  // Scroll to comment from notification link
  React.useEffect(() => {
    if (!commentId || !comments || comments.length === 0 || typeof window === 'undefined') return;
    let scrollTimer,highlightTimer,attempts = 0;
    const attemptScroll = () => {
      const el = window.document.getElementById(`comment-${commentId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'background-color 0.3s ease';
        el.style.backgroundColor = '#dbeafe';
        highlightTimer = setTimeout(() => {el.style.backgroundColor = '';}, 3000);
      } else if (attempts < 5) {
        attempts++;
        scrollTimer = setTimeout(attemptScroll, 300 * attempts);
      }
    };
    scrollTimer = setTimeout(attemptScroll, 500);
    return () => {clearTimeout(scrollTimer);clearTimeout(highlightTimer);};
  }, [commentId, comments]);

  // ── Derived values (hooks must run before early returns) ──────────────────

  const isContentStillCurrent = React.useMemo(() => {
    if (suggestion?.type !== 'edit_section' || !suggestion?.originalContent || !section?.content) return false;
    return suggestion.originalContent.trim() === section.content.trim();
  }, [suggestion, section]);

  const proArgs = args.filter((a) => a.type === 'pro');
  const conArgs = args.filter((a) => a.type === 'con');
  const consensusScore = suggestion && suggestion.proVotes + suggestion.conVotes > 0 ?
  (suggestion.proVotes / (suggestion.proVotes + suggestion.conVotes) * 100).toFixed(0) :
  50;

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
      return suggestion.type === 'new_section' || suggestion.type === 'edit_suggestion' ? [suggestion] : [];
    }
    let fullChain = [...chain];
    let head = chain[chain.length - 1];
    let visitedIds = new Set(fullChain.map((s) => s.id));
    while (head) {
      const next = allDocumentSuggestions.
      filter((s) => s.parentSuggestionId === head.id).
      sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0];
      if (next && !visitedIds.has(next.id)) {fullChain.push(next);visitedIds.add(next.id);head = next;} else
      head = null;
    }
    return fullChain.filter((s) => s.type === 'new_section' || s.type === 'edit_suggestion');
  }, [suggestion, allDocumentSuggestions]);

  const currentSuggestionIndexInChain = useMemo(() => suggestionChain.findIndex((s) => s.id === suggestionId), [suggestionChain, suggestionId]);

  // Targeted profiles for this suggestion's chain authors — avoids the global
  // 1000-profile fetch. Collects only the user IDs that appear in the chain
  // (typically 1-5) and fetches just those. Merges into the shared ['publicProfiles']
  // cache so other cache-only readers (CommentsSection, etc.) benefit.
  const chainUserIds = useMemo(() => {
    const ids = new Set();
    if (suggestion?.created_by_id) ids.add(suggestion.created_by_id);
    if (suggestionChain) {
      for (const s of suggestionChain) {
        if (s.created_by_id) ids.add(s.created_by_id);
      }
    }
    return Array.from(ids);
  }, [suggestion?.created_by_id, suggestionChain]);

  const chainUserIdsKey = chainUserIds.sort().join(',');
  const { data: suggestionProfiles = [] } = useQuery({
    queryKey: ['suggestionProfiles', chainUserIdsKey],
    queryFn: async () => {
      if (chainUserIds.length === 0) return [];
      return await base44.entities.UserPublicProfile.filter({ userId: { $in: chainUserIds } });
    },
    enabled: chainUserIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  React.useEffect(() => {
    if (!suggestionProfiles || suggestionProfiles.length === 0) return;
    queryClient.setQueryData(['publicProfiles'], (old) => {
      if (!old || old.length === 0) return suggestionProfiles;
      const map = new Map(old.map(p => [p.id, p]));
      suggestionProfiles.forEach(p => map.set(p.id, p));
      return Array.from(map.values());
    });
  }, [suggestionProfiles, queryClient]);

  // ── Helper fns ─────────────────────────────────────────────────────────────

  const getUserName = (userId) => {
    if (!userId) return '';
    const profile = (suggestionProfiles || []).find((p) => p.userId === userId) || (
    authorProfile?.userId === userId ? authorProfile : null);
    return profile?.fullName || '';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'accepted':return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':return 'bg-red-100 text-red-800 border-red-200';
      default:return 'bg-slate-100 text-slate-800 border-slate-200';
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
      </div>);

  }

  if (suggestionError || !suggestion && !suggestionLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-5xl mx-auto text-center py-20">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-slate-400" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{t('suggestionNotFound')}</h1>
          <p className="text-slate-600 mb-6">
            {t('suggestionDeletedOrNoPermission')}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button variant="outline" onClick={() => navigate(createPageUrl("MyDocuments"))}>
              {t('myDocuments')}
            </Button>
            <Button onClick={() => navigate(createPageUrl("Home"))}>{t('goHome')}</Button>
          </div>
        </div>
      </div>);

  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <TranslationProvider>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6 overflow-x-hidden">
  ...
    </div>
    </TranslationProvider>);

  }

export default SuggestionDetail;