import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { PAGE_NAMES } from "@/components/pageNames";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ArrowLeft, ArrowRight, ThumbsUp, ThumbsDown, MessageSquare, Clock, 
  CheckCircle, XCircle, AlertCircle, Loader2, Trash2, ChevronLeft, ChevronRight, Edit2, X, Save, FileText, ShieldCheck
} from "lucide-react";
import VotesNeededCounter from "../components/document/VotesNeededCounter";
import { Skeleton } from "@/components/ui/skeleton";
import CommentsSection from "../components/document/CommentsSection";
import SectionDiff from "../components/document/SectionDiff";
import TranslatableContent from "../components/document/TranslatableContent";
import { checkSuggestionConsensus, autoAcceptSuggestion } from "../components/document/suggestionAutoAccept";
import { votingQueue } from "../components/document/VotingQueue";
import { useLanguage } from "@/components/LanguageContext";
import { notifyVoteOnSuggestion, notifySuggestionStatusChange } from "../components/notifications/createNotification";
import PageHeader from "../components/PageHeader";
import CreateSuggestionModal from "../components/document/CreateSuggestionModal";
import { useMemo } from "react";
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

  const { data: suggestion, isLoading: suggestionLoading, error: suggestionError } = useQuery({
    queryKey: ['suggestion', suggestionId],
    queryFn: async () => {
      if (!suggestionId) return null;
      const results = await base44.entities.Suggestion.filter({ id: suggestionId });
      if (!results || results.length === 0) {
        throw new Error('Suggestion not found');
      }
      return results[0];
    },
    enabled: !!suggestionId,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
    throwOnError: false,
    staleTime: Infinity, // Real-time via subscription
  });

  // Real-time subscription for suggestion updates
  React.useEffect(() => {
    if (!suggestionId) return;
    
    console.log('[REALTIME] Setting up Suggestion subscription for:', suggestionId);
    
    const unsubscribe = base44.entities.Suggestion.subscribe((event) => {
      console.log('[REALTIME] Suggestion event:', event.type, event.id);
      if (event.id === suggestionId || event.data?.id === suggestionId) {
        queryClient.invalidateQueries({ queryKey: ['suggestion', suggestionId] });
        queryClient.invalidateQueries({ queryKey: ['allDocumentSuggestions', suggestion?.documentId] });
      }
    });
    
    return () => {
      console.log('[REALTIME] Cleaning up Suggestion subscription');
      unsubscribe();
    };
  }, [suggestionId, queryClient, suggestion?.documentId]);

  const { data: allDocumentSuggestions } = useQuery({
    queryKey: ['allDocumentSuggestions', suggestion?.documentId],
    queryFn: () => base44.entities.Suggestion.filter({ documentId: suggestion.documentId }),
    enabled: !!suggestion?.documentId,
    initialData: [],
    staleTime: Infinity, // Real-time via subscription
  });

  const { data: document } = useQuery({
    queryKey: ['document', suggestion?.documentId],
    queryFn: async () => {
      const docs = await base44.entities.Document.filter({ id: suggestion.documentId });
      return docs && docs.length > 0 ? docs[0] : null;
    },
    enabled: !!suggestion?.documentId,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
    staleTime: Infinity, // Real-time via subscription
  });

  const { data: section } = useQuery({
    queryKey: ['section', suggestion?.sectionId],
    queryFn: async () => {
      const sections = await base44.entities.Section.filter({ id: suggestion.sectionId });
      return sections && sections.length > 0 ? sections[0] : null;
    },
    enabled: !!suggestion?.sectionId,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
    staleTime: Infinity, // Real-time via subscription
  });

  const { data: topic } = useQuery({
    queryKey: ['topic', suggestion?.topicId],
    queryFn: async () => {
      const topics = await base44.entities.Topic.filter({ id: suggestion.topicId });
      return topics && topics.length > 0 ? topics[0] : null;
    },
    enabled: !!suggestion?.topicId,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
    staleTime: 5000,
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: isAdmin } = useQuery({
    queryKey: ['isAdmin', document?.id, user?.id],
    queryFn: async () => {
      if (!user?.id || !document?.id) return false;
      const admins = await base44.entities.DocumentAdmin.filter({ 
        documentId: document.id, 
        userId: user.id 
      });
      return admins.length > 0;
    },
    enabled: !!user?.id && !!document?.id,
  });

  const { data: userVote } = useQuery({
    queryKey: ['userVote', suggestionId, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      // Fetch all votes for this suggestion and filter client-side
      const allVotes = await base44.entities.Vote.filter({ suggestionId });
      const userVotes = allVotes.filter(v => v.userId === user.id);
      return userVotes.length > 0 ? userVotes[0] : null;
    },
    enabled: !!suggestionId && !!user?.id,
    staleTime: Infinity, // Real-time via subscription
  });

  // Real-time subscription for votes
  React.useEffect(() => {
    if (!suggestionId || !user?.id) return;
    
    console.log('[REALTIME] Setting up Vote subscription for:', suggestionId);
    
    // Debounced to prevent rate limits
    let voteTimer;
    const unsubscribe = base44.entities.Vote.subscribe((event) => {
      console.log('[REALTIME] Vote event:', event.type);
      clearTimeout(voteTimer);
      voteTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['userVote', suggestionId, user.id] });
        queryClient.invalidateQueries({ queryKey: ['suggestion', suggestionId] });
      }, 500);
    });
    
    return () => {
      console.log('[REALTIME] Cleaning up Vote subscription');
      unsubscribe();
    };
  }, [suggestionId, user?.id, queryClient]);

  const { data: args, isLoading: argsLoading } = useQuery({
    queryKey: ['arguments', suggestionId],
    queryFn: () => base44.entities.Argument.filter({ suggestionId }, '-created_date'),
    initialData: [],
    enabled: !!suggestionId,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', 'suggestion', suggestionId],
    queryFn: () => base44.entities.Comment.filter({ 
      rootEntityType: 'suggestion',
      rootEntityId: suggestionId 
    }),
    initialData: [],
    enabled: !!suggestionId,
  });

  const totalCommentsCount = React.useMemo(() => {
    return comments.length;
  }, [comments]);

  const { data: sectionVersions } = useQuery({
    queryKey: ['sectionVersions', suggestion?.sectionId],
    queryFn: () => base44.entities.DocumentVersion.filter({ 
      sectionId: suggestion.sectionId 
    }, '-version'),
    initialData: [],
    enabled: !!suggestion?.sectionId && suggestion?.type === 'edit_section',
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const { data: publicProfiles } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    initialData: [],
  });

  const { data: topics } = useQuery({
    queryKey: ['topics', suggestion?.documentId],
    queryFn: () => base44.entities.Topic.filter({ documentId: suggestion.documentId }, 'order'),
    enabled: !!suggestion?.documentId,
    initialData: [],
  });

  const { data: sections } = useQuery({
    queryKey: ['sections', suggestion?.documentId],
    queryFn: () => base44.entities.Section.filter({ documentId: suggestion.documentId }),
    enabled: !!suggestion?.documentId,
    initialData: [],
  });

  // פונקציית עזר לטיפול בנקודות ברקע - fire-and-forget
  // הוסרה - הפונקציה הזו השתמשה ב-asServiceRole שלא זמין בקליינט

  const [rateLimitRetryAfter, setRateLimitRetryAfter] = useState(null);

  const voteMutation = useMutation({
    mutationFn: async (vote) => {
      if (!user) throw new Error(t('mustBeLoggedInToVote'));
      if (!suggestion) throw new Error('Suggestion not found');

      // Use optimized backend function
      const response = await base44.functions.invoke('voteOnSuggestion', {
        suggestionId,
        vote
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'שגיאה בהצבעה');
      }

      return {
        accepted: response.data.accepted,
        newProVotes: response.data.newProVotes,
        newConVotes: response.data.newConVotes
      };
    },
    // Optimistic update - only for vote counts, NOT for status
    onMutate: async (vote) => {
      return await votingQueue.add(async () => {
        await queryClient.cancelQueries({ queryKey: ['suggestion', suggestionId] });
        await queryClient.cancelQueries({ queryKey: ['userVote', suggestionId, user?.id] });
        
        const previousSuggestion = queryClient.getQueryData(['suggestion', suggestionId]);
        const previousVote = queryClient.getQueryData(['userVote', suggestionId, user?.id]);
      
      // עדכון אופטימיסטי של ההצעה - רק ספירת הצבעות, לא סטטוס!
      queryClient.setQueryData(['suggestion', suggestionId], (old) => {
        if (!old) return old;
        
        let newProVotes = old.proVotes || 0;
        let newConVotes = old.conVotes || 0;
        
        if (userVote) {
          if (userVote.vote === vote) {
            // ביטול
            if (vote === 'pro') newProVotes = Math.max(0, newProVotes - 1);
            else newConVotes = Math.max(0, newConVotes - 1);
          } else {
            // שינוי
            if (vote === 'pro') {
              newProVotes += 1;
              newConVotes = Math.max(0, newConVotes - 1);
            } else {
              newConVotes += 1;
              newProVotes = Math.max(0, newProVotes - 1);
            }
          }
        } else {
          // חדש
          if (vote === 'pro') newProVotes += 1;
          else newConVotes += 1;
        }
        
        // לא משנים סטטוס באופטימיסטי - רק השרת יקבע אם ההצעה התקבלה
        return { 
          ...old, 
          proVotes: newProVotes, 
          conVotes: newConVotes
        };
      });
      
      // עדכון אופטימיסטי של ההצבעה
      queryClient.setQueryData(['userVote', suggestionId, user?.id], (old) => {
        if (userVote) {
          if (userVote.vote === vote) {
            // ביטול
            return null;
          } else {
            // שינוי
            return { ...old, vote };
          }
        } else {
          // הצבעה חדשה
          return { id: 'temp-' + Date.now(), suggestionId, userId: user.id, vote };
        }
      });
      
        return { previousSuggestion, previousVote };
      });
    },
    onError: (err, variables, context) => {
      if (context?.previousSuggestion) {
        queryClient.setQueryData(['suggestion', suggestionId], context.previousSuggestion);
      }
      if (context?.previousVote !== undefined) {
        queryClient.setQueryData(['userVote', suggestionId, user?.id], context.previousVote);
      }
      
      // Handle rate limit with countdown from server response
      if (err.response?.status === 429 || err.response?.data?.remainingSeconds) {
        const retrySeconds = err.response.data.remainingSeconds || 30;
        
        setRateLimitRetryAfter(retrySeconds);
        
        // Countdown timer
        const interval = setInterval(() => {
          setRateLimitRetryAfter(prev => {
            if (prev <= 1) {
              clearInterval(interval);
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      } else if (err.message?.includes('המתן') || err.message?.toLowerCase().includes('wait')) {
        const match = err.message.match(/(\d+)\s*(?:שניות|seconds)/);
        const retrySeconds = match ? parseInt(match[1]) : 30;
        setRateLimitRetryAfter(retrySeconds);
        
        const interval = setInterval(() => {
          setRateLimitRetryAfter(prev => {
            if (prev <= 1) {
              clearInterval(interval);
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        const errorMsg = err.response?.data?.error || err.message;
        setError(errorMsg);
        setTimeout(() => setError(null), 5000);
      }
    },
    onSuccess: (data) => {
      console.log('[VOTE SUCCESS]', { accepted: data?.accepted });
      
      // Real-time subscriptions will handle data refresh
      // Only show toast and minimal invalidations
      if (data?.accepted === true) {
        toast.success(isRTL ? 'ההצעה התקבלה! ✓' : 'Suggestion accepted! ✓', {
          duration: 4000,
        });
        // Delay invalidations to prevent rate limits - subscriptions will update most data
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['sections', document?.id] });
          queryClient.invalidateQueries({ queryKey: ['document', document?.id] });
        }, 2000);
      }
    },
  });

  const addArgumentMutation = useMutation({
    mutationFn: async ({ type, content }) => {
      if (!user) throw new Error(t('mustBeLoggedIn'));
      if (!content.trim()) throw new Error(t('argumentContentRequired'));

      await base44.entities.Argument.create({
        suggestionId,
        type,
        content: content.trim(),
        convincedCount: 0
      });
      
      // עדכון מספר התורמים למסמך
      if (suggestion?.documentId) {
        try {
          const { calculateDocumentContributors } = await import('../components/document/calculateContributors');
          const contributorsCount = await calculateDocumentContributors(suggestion.documentId);
          await base44.entities.Document.update(suggestion.documentId, {
            totalUsersInteracted: contributorsCount,
          });
        } catch (err) {
          console.error('[UPDATE CONTRIBUTORS ERROR]', err);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['arguments', suggestionId] });
      setNewArgument({ type: null, content: "" });
    },
    onError: (err) => {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  });

  // Retry helper with exponential backoff
  const retryWithBackoff = async (fn, maxAttempts = 3, initialDelayMs = 500) => {
    let lastError;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts - 1) {
          // Rate limit exceeded? Add backoff
          const delayMs = initialDelayMs * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    throw lastError;
  };

  const updateStatusMutation = useMutation({
    mutationFn: async (status) => {
      if (!isAdmin) throw new Error(t('adminAccessRequired'));
      
      if (status === 'accepted' && suggestion.type === 'edit_section' && section) {
        // Get existing versions to calculate next version number
        const versions = await retryWithBackoff(() => 
          base44.entities.DocumentVersion.filter({ sectionId: section.id })
        );
        const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version)) + 1 : 1;
        
        // Save version with OLD content before updating
        await retryWithBackoff(() =>
          base44.entities.DocumentVersion.create({
            documentId: suggestion.documentId,
            sectionId: section.id,
            content: section.content,
            changeDescription: `לפני: ${suggestion.title}`,
            version: nextVersion,
            changeType: 'suggestion_accepted',
            suggestionId: suggestion.id
          })
        );
        
        // Small delay between operations to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Update section with new content
        await retryWithBackoff(() =>
          base44.entities.Section.update(section.id, {
            content: suggestion.newContent,
            lastEditedBy: user.id
          })
        );
        
        // Small delay between operations
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Save version with NEW content after updating
        await retryWithBackoff(() =>
          base44.entities.DocumentVersion.create({
            documentId: suggestion.documentId,
            sectionId: section.id,
            content: suggestion.newContent,
            changeDescription: suggestion.title,
            version: nextVersion + 1,
            changeType: 'suggestion_accepted',
            suggestionId: suggestion.id
          })
        );
      } else if (status === 'accepted' && suggestion.type === 'new_section') {
        const sections = await retryWithBackoff(() =>
          base44.entities.Section.filter({ 
            documentId: suggestion.documentId,
            topicId: suggestion.topicId 
          }, 'order')
        );
        
        let newOrder;
        if (suggestion.insertPosition !== undefined && suggestion.insertPosition !== null) {
          // Insert at specific position - update orders of sections after this position
          const sectionsToUpdate = sections.filter(s => s.order >= suggestion.insertPosition);
          for (const section of sectionsToUpdate) {
            await retryWithBackoff(() =>
              base44.entities.Section.update(section.id, { order: section.order + 1 })
            );
            // Small delay between sequential updates
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          newOrder = suggestion.insertPosition;
        } else {
          // Insert at end
          const maxOrder = sections.length > 0 ? Math.max(...sections.map(s => s.order)) : -1;
          newOrder = maxOrder + 1;
        }
        
        const newSection = await retryWithBackoff(() =>
          base44.entities.Section.create({
            documentId: suggestion.documentId,
            topicId: suggestion.topicId,
            content: suggestion.newContent,
            order: newOrder,
            lastEditedBy: user.id
          })
        );
        
        // Small delay before creating version
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Create initial version for new section
        await retryWithBackoff(() =>
          base44.entities.DocumentVersion.create({
            documentId: suggestion.documentId,
            sectionId: newSection.id,
            content: suggestion.newContent,
            changeDescription: suggestion.title,
            version: 1,
            changeType: 'section_created',
            suggestionId: suggestion.id
          })
        );
      }

      // Small delay before updating suggestion status
      await new Promise(resolve => setTimeout(resolve, 300));

      await retryWithBackoff(() =>
        base44.entities.Suggestion.update(suggestionId, { 
          status,
          ...(status === 'accepted' ? { approvedByAdmin: true } : {})
        })
      );
      
      // קבלת ההצעה המעודכנת מהשרת
      const updatedSuggestions = await retryWithBackoff(() =>
        base44.entities.Suggestion.filter({ id: suggestionId })
      );
      const updatedSuggestion = updatedSuggestions[0] || { ...suggestion, status };
      
      // Small delay before sending notifications
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // שליחת התראה על שינוי סטטוס - חובה לחכות שתסתיים
      console.log('[UPDATE STATUS] Sending status change notifications...');
      console.log('[UPDATE STATUS] Updated suggestion:', updatedSuggestion);
      await notifySuggestionStatusChange({ suggestion: updatedSuggestion, newStatus: status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestion', suggestionId] });
      queryClient.invalidateQueries({ queryKey: ['sections', document?.id] });
      queryClient.invalidateQueries({ queryKey: ['versions'] });
    },
    onError: (err) => {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  });

  const deleteSuggestionMutation = useMutation({
    mutationFn: async () => {
      if (!user || user.email !== suggestion.created_by) {
        throw new Error(t('onlyCreatorCanDelete'));
      }
      await base44.entities.Suggestion.delete(suggestionId);
    },
    onSuccess: () => {
      navigate(`${createPageUrl(PAGE_NAMES.DOCUMENT_VIEW)}?id=${suggestion.documentId}`);
    },
    onError: (err) => {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  });

  const updateExplanationMutation = useMutation({
    mutationFn: async (newExplanation) => {
      await base44.entities.Suggestion.update(suggestionId, { explanation: newExplanation });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestion', suggestionId] });
      setIsEditingExplanation(false);
    },
    onError: (err) => {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  });

  // useEffect to scroll to comment from notification
  React.useEffect(() => {
    if (!commentId || !comments || comments.length === 0 || typeof window === 'undefined') return;

    // Try multiple times with increasing delays to handle async rendering
    let scrollTimer;
    let highlightTimer;
    let attempts = 0;
    const maxAttempts = 5;

    const attemptScroll = () => {
      const commentElement = window.document.getElementById(`comment-${commentId}`);
      
      if (commentElement) {
        // Found the element - scroll and highlight
        commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        commentElement.style.transition = 'background-color 0.3s ease';
        commentElement.style.backgroundColor = '#dbeafe';
        
        // Remove highlight after 3 seconds
        highlightTimer = setTimeout(() => {
          commentElement.style.backgroundColor = '';
        }, 3000);
      } else if (attempts < maxAttempts) {
        // Element not found yet - try again with exponential backoff
        attempts++;
        scrollTimer = setTimeout(attemptScroll, 300 * attempts);
      }
    };

    // Start attempting to scroll
    scrollTimer = setTimeout(attemptScroll, 500);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(highlightTimer);
    };
  }, [commentId, comments]);

  // useMemo ALWAYS runs - before any conditional returns
  const isContentStillCurrent = React.useMemo(() => {
    if (suggestion?.type !== 'edit_section' || !suggestion?.originalContent || !section?.content) {
      return false;
    }
    return suggestion.originalContent.trim() === section.content.trim();
  }, [suggestion, section]);

  // Helper functions
  const getUserName = (email) => {
    // First try public profile (accessible to all)
    const profile = publicProfiles.find(p => p.email === email);
    if (profile?.fullName) return profile.fullName;
    
    // Fallback to User entity (requires permissions)
    const user = users.find(u => u.email === email);
    if (user?.full_name) return user.full_name;
    
    return 'User';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'accepted': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getTimeRemaining = (timerEndsAt) => {
    if (!timerEndsAt) return null;
    const now = new Date();
    const end = new Date(timerEndsAt);
    const diff = end - now;
    
    if (diff <= 0) return t('votingEnded');
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h ${t('remaining')}`;
    return `${hours}h ${t('remaining')}`;
  };

  const handleNavigateToVersion = (direction) => {
    const currentIndex = suggestionVersions.findIndex(v => v.suggestionId === suggestionId);
    let targetIndex;
    
    if (direction === 'newer') {
      targetIndex = currentIndex - 1;
    } else {
      targetIndex = currentIndex + 1;
    }
    
    if (targetIndex >= 0 && targetIndex < suggestionVersions.length) {
      const targetVersion = suggestionVersions[targetIndex];
      navigate(`${createPageUrl(PAGE_NAMES.SUGGESTION_DETAIL)}?id=${targetVersion.suggestionId}`);
    }
  };

  const proArgs = args.filter(a => a.type === 'pro');
  const conArgs = args.filter(a => a.type === 'con');
  const consensusScore = suggestion && suggestion.proVotes + suggestion.conVotes > 0 
    ? (suggestion.proVotes / (suggestion.proVotes + suggestion.conVotes) * 100).toFixed(0)
    : 50;

  const suggestionVersions = sectionVersions.filter(v => v.suggestionId);
  const currentVersionIndex = suggestionVersions.findIndex(v => v.suggestionId === suggestionId);
  const isNewestVersion = currentVersionIndex === 0;
  const isOldestVersion = currentVersionIndex === suggestionVersions.length - 1 || currentVersionIndex === -1;

  const suggestionChain = useMemo(() => {
      if (!suggestion || !allDocumentSuggestions || allDocumentSuggestions.length === 0) return [];

      let chain = [];
      let current = allDocumentSuggestions.find(s => s.id === suggestion.id);

      // Go up to find the root
      while (current && current.parentSuggestionId) {
          const parent = allDocumentSuggestions.find(s => s.id === current.parentSuggestionId);
          if (!parent || chain.some(item => item.id === parent.id)) { // Prevent infinite loops
              break;
          }
          chain.unshift(parent);
          current = parent;
      }
       if (current && !chain.some(item => item.id === current.id)) {
          chain.unshift(current);
      }

      const root = chain[0];
      if (!root) {
           // This suggestion might be a root itself
          if (suggestion.type === 'new_section' || suggestion.type === 'edit_suggestion'){
              return [suggestion];
          }
          return [];
      }

      // Go down to find all descendants in a linear path
      let fullChain = [...chain];
      let head = chain[chain.length - 1];

      let visitedIds = new Set(fullChain.map(s => s.id));

      while (head) {
          // Find the next suggestion in the chain (assuming one edit at a time)
          const nextInChain = allDocumentSuggestions
              .filter(s => s.parentSuggestionId === head.id)
              .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0];

          if (nextInChain && !visitedIds.has(nextInChain.id)) {
              fullChain.push(nextInChain);
              visitedIds.add(nextInChain.id);
              head = nextInChain;
          } else {
              head = null;
          }
      }

      // Ensure the current suggestion is in the chain if it was missed
      if (!visitedIds.has(suggestion.id)) {
          // This case can happen if there are branches, for now, we just add it.
          // A more robust solution might be needed for branching histories.
      }

      return fullChain.filter(s => s.type === 'new_section' || s.type === 'edit_suggestion');
  }, [suggestion, allDocumentSuggestions]);

  const currentSuggestionIndexInChain = useMemo(() => {
      return suggestionChain.findIndex(s => s.id === suggestionId);
  }, [suggestionChain, suggestionId]);

  // NOW check for loading/error states - AFTER all hooks
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
            {isRTL ? 'ההצעה אולי נמחקה או שאין לך הרשאה לצפות בה' : 'The suggestion may have been deleted or you don\'t have permission to view it'}
          </p>
          <Button className="mt-4" onClick={() => navigate(createPageUrl("Home"))}>
            {t('goHome')}
          </Button>
        </div>
      </div>
    );
  }

  // Continue with JSX rendering

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6 overflow-x-hidden">
      <div className="max-w-5xl mx-auto space-y-4 md:space-y-6 w-full overflow-x-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex-1 min-w-0 w-full">
            <PageHeader 
              title={suggestion.title}
              backUrl={`${createPageUrl(PAGE_NAMES.DOCUMENT_VIEW)}?id=${suggestion.documentId}`}
            />
          </div>
          {user && user.email === suggestion.created_by && suggestion.status !== 'accepted' && (
            <button
              onClick={() => {
                if (confirm(t('confirmDeleteSuggestion'))) {
                  deleteSuggestionMutation.mutate();
                }
              }}
              disabled={deleteSuggestionMutation.isPending}
              className="shrink-0 p-1 text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
              title={t('deleteSuggestion')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {document && (
          <p className={`text-slate-600 ${isRTL ? 'text-right' : ''}`}>
            <Link to={`${createPageUrl(PAGE_NAMES.DOCUMENT_VIEW)}?id=${document.id}`} className="hover:underline">
              {document.title}
            </Link>
          </p>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="bg-white border-slate-200 w-full overflow-hidden">
          <CardHeader className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row items-start md:justify-between gap-3">
              <div className="flex flex-wrap gap-2 items-center">
                <Badge variant="outline" className={`${getStatusColor(suggestion.status)} text-xs`}>
                  {t(suggestion.status)}
                </Badge>
                <Badge variant="outline" className={`text-xs ${
                  suggestion.type === 'delete_section' ? 'bg-red-100 text-red-800 border-red-200' : ''
                }`}>
                  {suggestion.type === 'new_section' 
                    ? t('newSection') 
                    : suggestion.type === 'delete_section'
                    ? (language === 'he' ? 'מחיקת סעיף' : language === 'ar' ? 'حذف قسم' : 'Delete Section')
                    : suggestion.type === 'edit_suggestion'
                    ? (isRTL ? 'הצעה לעריכת הצעה' : 'Edit Suggestion')
                    : t('suggestionToEditSection')}
                </Badge>

                <span className="text-xs text-slate-500">
                  {t('by')} <Link to={`${createPageUrl("Profile")}?userId=${users.find(u => u.email === suggestion.created_by)?.id}`} className="hover:underline text-blue-600">{getUserName(suggestion.created_by)}</Link>
                </span>
                {suggestion.created_date && (
                  <span className="text-xs text-slate-400">
                    • {new Date(suggestion.created_date).toLocaleDateString(language === 'he' ? 'he-IL' : language === 'ar' ? 'ar-SA' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {suggestion.status === 'pending' && suggestion.timerEndsAt && (
                  <Badge variant="outline" className="flex items-center gap-1 text-xs">
                    <Clock className="w-3 h-3" />
                    {getTimeRemaining(suggestion.timerEndsAt)}
                  </Badge>
                )}
                {suggestion.status === 'accepted' && suggestion.updated_date && (
                  <span className="text-xs text-slate-500">
                    {t('acceptedOn')} {new Date(suggestion.updated_date).toLocaleDateString(language === 'he' ? 'he-IL' : language === 'ar' ? 'ar-SA' : 'en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                )}
                {suggestion.approvedByAdmin && suggestion.status === 'accepted' && (
                  <Badge variant="outline" className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                    <ShieldCheck className="w-3 h-3" />
                    {language === 'he' ? 'אושר ע״י מנהל' : language === 'ar' ? 'تمت الموافقة من المشرف' : 'Admin Approved'}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 md:space-y-6 p-3 md:p-6 overflow-x-hidden">
            {(suggestion.explanation || (user && user.email === suggestion.created_by)) && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700">{t('explanation')}</h3>
                    {user && user.email === suggestion.created_by && !isEditingExplanation && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditedExplanation(suggestion.explanation || "");
                          setIsEditingExplanation(true);
                        }}
                        className="h-7 px-2"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  {isEditingExplanation ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editedExplanation}
                        onChange={(e) => setEditedExplanation(e.target.value)}
                        placeholder={t('explainChange')}
                        rows={3}
                        dir={isRTL ? 'rtl' : 'ltr'}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => updateExplanationMutation.mutate(editedExplanation)}
                          disabled={updateExplanationMutation.isPending}
                        >
                          <Save className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                          {t('saveChanges')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setIsEditingExplanation(false)}
                        >
                          <X className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                          {t('cancel')}
                        </Button>
                      </div>
                    </div>
                  ) : suggestion.explanation && typeof suggestion.explanation === 'string' ? (
                    <TranslatableContent
                      content={suggestion.explanation}
                      entity={suggestion}
                      entityType="Suggestion"
                      fieldName="explanation"
                      onUpdate={(updated) => {
                        queryClient.setQueryData(['suggestion', suggestionId], updated);
                      }}
                      className="text-slate-600"
                    />
                  ) : (
                    <p className="text-slate-400 text-sm italic">{t('noDescription')}</p>
                  )}
                </div>
              )}



            {suggestion.type === 'delete_section' ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-red-700">
                    {language === 'he' ? 'סעיף שמוצע למחיקה' : language === 'ar' ? 'القسم المقترح حذفه' : 'Section to be deleted'}
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigate(`${createPageUrl("DocumentView")}?id=${suggestion.documentId}#suggestion-${suggestionId}`);
                      setTimeout(() => {
                        if (typeof window !== 'undefined' && window.document?.getElementById) {
                          const element = window.document.getElementById(`suggestion-${suggestionId}`);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }
                      }, 300);
                    }}
                    className="h-7 px-2 text-xs"
                  >
                    <FileText className={`w-3 h-3 ${isRTL ? 'ml-1.5' : 'mr-1.5'}`} />
                    {isRTL ? 'חזרה למסמך' : 'Back to Document'}
                  </Button>
                </div>
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div 
                    className="prose prose-sm max-w-none text-slate-700 line-through opacity-60"
                    dangerouslySetInnerHTML={{ __html: suggestion.originalContent }}
                  />
                </div>
              </div>
            ) : (suggestion.type === 'edit_section' || (suggestion.type === 'edit_suggestion' && suggestion.originalContent)) ? (
              <div>
               <div className="flex items-center justify-between mb-2">
                 <h3 className="text-sm font-semibold text-slate-700">{t('proposedChanges')}</h3>
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={() => {
                     navigate(`${createPageUrl("DocumentView")}?id=${suggestion.documentId}#section-${suggestion.sectionId}`);
                     setTimeout(() => {
                       if (typeof window !== 'undefined') {
                         const element = window.document.getElementById(`section-${suggestion.sectionId}`);
                         if (element) {
                           element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                         }
                       }
                     }, 300);
                   }}
                   className="h-7 px-2 text-xs"
                 >
                   <FileText className={`w-3 h-3 ${isRTL ? 'ml-1.5' : 'mr-1.5'}`} />
                   {isRTL ? 'חזרה למסמך' : 'Back to Document'}
                 </Button>
               </div>
               <div className="relative">
                 {isAutoAccepting && (
                   <div className="absolute inset-0 bg-white/50 rounded-lg flex flex-col items-center justify-center z-10 gap-3">
                     <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                     <p className="text-sm font-medium text-slate-700">{isRTL ? 'מעבד הצעה...' : 'Processing suggestion...'}</p>
                   </div>
                 )}
                 <SectionDiff
                   originalContent={suggestion.originalContent}
                   newContent={suggestion.newContent}
                   suggestion={suggestion}
                   documentId={suggestion.documentId}
                   sectionId={suggestion.sectionId}
                   section={section}
                 />
               </div>
              </div>
            ) : suggestion.type === 'new_section' ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-700">{t('proposedContent')}</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigate(`${createPageUrl("DocumentView")}?id=${suggestion.documentId}#suggestion-${suggestionId}`);
                      setTimeout(() => {
                        if (typeof window !== 'undefined') {
                          const element = window.document.getElementById(`suggestion-${suggestionId}`);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }
                      }, 300);
                    }}
                    className="h-7 px-2 text-xs"
                  >
                    <FileText className={`w-3 h-3 ${isRTL ? 'ml-1.5' : 'mr-1.5'}`} />
                    {isRTL ? 'חזרה למסמך' : 'Back to Document'}
                  </Button>
                </div>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <TranslatableContent
                    content={suggestion.newContent}
                    entity={suggestion}
                    entityType="Suggestion"
                    onUpdate={(updated) => {
                      queryClient.setQueryData(['suggestion', suggestionId], updated);
                    }}
                    className="prose prose-sm max-w-none"
                  />
                </div>
              </div>
            ) : null}

            {(suggestion.type === 'new_section' && suggestion.status === 'pending') && (
              <div className="pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowEditSuggestionModal(true)}
                  className="w-full"
                >
                  <Edit2 className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {isRTL ? 'הצע עריכה להצעה זו' : 'Suggest an Edit to this Suggestion'}
                </Button>
              </div>
            )}

            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pt-4 border-t">
              {document?.votingButtonsEnabled && (
              <div className="flex gap-3 md:gap-6 flex-wrap items-center">
                <div className="text-center">
                  <div className="text-xl md:text-2xl font-bold text-green-600">{suggestion.proVotes || 0}</div>
                  <div className="text-[10px] md:text-xs text-slate-500">{t('proVotes')}</div>
                </div>
                <div className="text-center">
                  <div className="text-xl md:text-2xl font-bold text-red-600">{suggestion.conVotes || 0}</div>
                  <div className="text-[10px] md:text-xs text-slate-500">{t('conVotes')}</div>
                </div>
                <div className="text-center">
                  <div className="text-xl md:text-2xl font-bold text-blue-600">{consensusScore}%</div>
                  <div className="text-[10px] md:text-xs text-slate-500">{t('consensus')}</div>
                </div>
                <div className="flex-1">
                  <VotesNeededCounter 
                    suggestion={suggestion} 
                    document={document}
                    acceptedSuggestions={allDocumentSuggestions.filter(s => s.status === 'accepted')}
                  />
                </div>
              </div>
              )}

              {suggestion.status === 'pending' && document?.votingButtonsEnabled && (
                <div className="flex gap-2 w-full md:w-auto relative">
                  {voteMutation.isPending && !rateLimitRetryAfter && (
                    <div className="absolute inset-0 bg-white/50 rounded-lg flex items-center justify-center z-10">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    </div>
                  )}
                  {rateLimitRetryAfter && (
                    <div className="absolute inset-0 bg-amber-50/95 rounded-lg flex flex-col items-center justify-center z-10 gap-2 p-2">
                      <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
                      <p className="text-xs font-medium text-amber-800 text-center">
                        {language === 'he' ? `אנא המתן ${rateLimitRetryAfter} שניות` : 
                         language === 'ar' ? `يرجى الانتظار ${rateLimitRetryAfter} ثانية` :
                         `Please wait ${rateLimitRetryAfter} seconds`}
                      </p>
                    </div>
                  )}
                  <Button
                    variant={userVote?.vote === 'pro' ? 'default' : 'outline'}
                    onClick={() => {
                      if (!user) {
                        base44.auth.redirectToLogin(window.location.href);
                        return;
                      }
                      voteMutation.mutate('pro');
                    }}
                    disabled={voteMutation.isPending || rateLimitRetryAfter !== null}
                    className={`flex-1 md:flex-initial text-xs md:text-sm ${userVote?.vote === 'pro' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                  >
                    <ThumbsUp className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-1 md:ml-2' : 'mr-1 md:mr-2'}`} />
                    {t('votePro')}
                  </Button>
                  <Button
                    variant={userVote?.vote === 'con' ? 'default' : 'outline'}
                    onClick={() => {
                      if (!user) {
                        base44.auth.redirectToLogin(window.location.href);
                        return;
                      }
                      voteMutation.mutate('con');
                    }}
                    disabled={voteMutation.isPending || rateLimitRetryAfter !== null}
                    className={`flex-1 md:flex-initial text-xs md:text-sm ${userVote?.vote === 'con' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                  >
                    <ThumbsDown className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-1 md:ml-2' : 'mr-1 md:mr-2'}`} />
                    {t('voteCon')}
                  </Button>
                </div>
              )}
            </div>

            {isAdmin && suggestion.status === 'pending' && (
              <div className="flex flex-col md:flex-row gap-2 pt-4 border-t">
                <Button
                  onClick={() => updateStatusMutation.mutate('accepted')}
                  disabled={updateStatusMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 w-full md:w-auto text-xs md:text-sm"
                >
                  {updateStatusMutation.isPending ? (
                    <Loader2 className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'} animate-spin`} />
                  ) : (
                    <CheckCircle className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  )}
                  {t('acceptSuggestion')}
                </Button>
                <Button
                  onClick={() => updateStatusMutation.mutate('rejected')}
                  disabled={updateStatusMutation.isPending}
                  variant="destructive"
                  className="w-full md:w-auto text-xs md:text-sm"
                >
                  {updateStatusMutation.isPending ? (
                    <Loader2 className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'} animate-spin`} />
                  ) : (
                    <XCircle className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  )}
                  {t('rejectSuggestion')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {suggestionChain && suggestionChain.length > 1 && (
            <Card className="bg-white border-slate-200 w-full overflow-hidden">
                <CardHeader className="p-4 md:p-6">
                    <CardTitle className="text-base md:text-lg">{isRTL ? 'היסטוריית עריכה של ההצעה' : 'Suggestion Edit History'}</CardTitle>
                </CardHeader>
                <CardContent className="p-3 md:p-6 flex justify-between items-center">
                    <Button 
                        variant="outline"
                        onClick={() => navigate(`${createPageUrl(PAGE_NAMES.SUGGESTION_DETAIL)}?id=${suggestionChain[currentSuggestionIndexInChain - 1].id}`)}
                        disabled={currentSuggestionIndexInChain <= 0}
                    >
                        <ChevronLeft className="w-4 h-4" />
                        {isRTL ? 'גרסה קודמת' : 'Previous Version'}
                    </Button>
                    <span className="text-sm text-slate-600">
                        {isRTL ? 'גרסה' : 'Version'} {currentSuggestionIndexInChain + 1} / {suggestionChain.length}
                    </span>
                    <Button 
                        variant="outline"
                        onClick={() => navigate(`${createPageUrl(PAGE_NAMES.SUGGESTION_DETAIL)}?id=${suggestionChain[currentSuggestionIndexInChain + 1].id}`)}
                        disabled={currentSuggestionIndexInChain >= suggestionChain.length - 1}
                    >
                        {isRTL ? 'גרסה הבאה' : 'Next Version'}
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </CardContent>
            </Card>
        )}

        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          <Card className="bg-white border-slate-200 w-full overflow-hidden">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-green-700 text-base md:text-lg">
                <ThumbsUp className="w-4 h-4 md:w-5 md:h-5" />
                {t('proArguments')} ({proArgs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-3 md:p-6 overflow-x-hidden">
              {proArgs.length === 0 ? (
                <p className="text-sm text-slate-500">{t('noProArgumentsYet')}</p>
              ) : (
                proArgs.map(arg => (
                  <div key={arg.id} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-slate-700">{arg.content}</p>
                    <div className="text-xs text-slate-500 mt-2">
                      {t('by')} {getUserName(arg.created_by)} • {new Date(arg.created_date).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
              {newArgument.type !== 'pro' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!user) {
                      base44.auth.redirectToLogin(window.location.href);
                      return;
                    }
                    setNewArgument({ type: 'pro', content: "" });
                  }}
                  className="w-full"
                >
                  {t('addProArgument')}
                </Button>
              )}
              {newArgument.type === 'pro' && (
                <div className="space-y-2">
                  <Textarea
                    value={newArgument.content}
                    onChange={(e) => setNewArgument({ ...newArgument, content: e.target.value })}
                    placeholder={t('writeProArgument')}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => addArgumentMutation.mutate(newArgument)}
                      disabled={addArgumentMutation.isPending || !newArgument.content.trim()}
                    >
                      {t('submit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setNewArgument({ type: null, content: "" })}
                    >
                      {t('cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 w-full overflow-hidden">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-red-700 text-base md:text-lg">
                <ThumbsDown className="w-4 h-4 md:w-5 md:h-5" />
                {t('conArguments')} ({conArgs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-3 md:p-6 overflow-x-hidden">
              {conArgs.length === 0 ? (
                <p className="text-sm text-slate-500">{t('noConArgumentsYet')}</p>
              ) : (
                conArgs.map(arg => (
                  <div key={arg.id} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-slate-700">{arg.content}</p>
                    <div className="text-xs text-slate-500 mt-2">
                      {t('by')} {getUserName(arg.created_by)} • {new Date(arg.created_date).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
              {newArgument.type !== 'con' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!user) {
                      base44.auth.redirectToLogin(window.location.href);
                      return;
                    }
                    setNewArgument({ type: 'con', content: "" });
                  }}
                  className="w-full"
                >
                  {t('addConArgument')}
                </Button>
              )}
              {newArgument.type === 'con' && (
                <div className="space-y-2">
                  <Textarea
                    value={newArgument.content}
                    onChange={(e) => setNewArgument({ ...newArgument, content: e.target.value })}
                    placeholder={t('writeConArgument')}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => addArgumentMutation.mutate(newArgument)}
                      disabled={addArgumentMutation.isPending || !newArgument.content.trim()}
                    >
                      {t('submit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setNewArgument({ type: null, content: "" })}
                    >
                      {t('cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white border-slate-200 w-full overflow-hidden">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-base md:text-lg">{t('commentsOnSuggestion')} ({totalCommentsCount})</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 overflow-x-hidden">
            <CommentsSection
              entityType="suggestion"
              entityId={suggestionId}
              user={user}
            />
          </CardContent>
        </Card>
      </div>

      {showEditSectionModal && section && (
        <CreateSuggestionModal
          document={document}
          topics={topics}
          sections={sections}
          editingSection={{ id: section.id, topicId: section.topicId }}
          user={user}
          onClose={() => setShowEditSectionModal(false)}
          isAdmin={isAdmin}
          onSuggestionCreated={(newSuggestionId) => {
            setShowEditSectionModal(false);
            navigate(`${createPageUrl(PAGE_NAMES.SUGGESTION_DETAIL)}?id=${newSuggestionId}`);
          }}
          />
          )}
          {showEditSuggestionModal && (
          <CreateSuggestionModal
          document={document}
          topics={topics}
          sections={sections}
          editingSuggestion={suggestion}
          user={user}
          onClose={() => setShowEditSuggestionModal(false)}
          isAdmin={isAdmin}
          onSuggestionCreated={(newSuggestionId) => {
            setShowEditSuggestionModal(false);
            navigate(`${createPageUrl(PAGE_NAMES.SUGGESTION_DETAIL)}?id=${newSuggestionId}`);
          }}
          />
          )}
          </div>
  );
}