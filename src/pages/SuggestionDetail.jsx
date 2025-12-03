import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ArrowLeft, ArrowRight, ThumbsUp, ThumbsDown, MessageSquare, Clock, 
  CheckCircle, XCircle, AlertCircle, Loader2, Trash2, ChevronLeft, ChevronRight 
} from "lucide-react";
import VotesNeededCounter from "../components/document/VotesNeededCounter";
import { Skeleton } from "@/components/ui/skeleton";
import CommentsSection from "../components/document/CommentsSection";
import SectionDiff from "../components/document/SectionDiff";
import TranslatableContent from "../components/document/TranslatableContent";
import { checkSuggestionConsensus, autoAcceptSuggestion } from "../components/document/suggestionAutoAccept";
import { useLanguage } from "@/components/LanguageContext";
import { notifyVoteOnSuggestion, notifySuggestionStatusChange } from "../components/notifications/createNotification";
import PageHeader from "../components/PageHeader";

export default function SuggestionDetail() {
  const { t, isRTL } = useLanguage();
  const [searchParams] = useSearchParams();
  const suggestionId = searchParams.get('id');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newArgument, setNewArgument] = useState({ type: null, content: "" });
  const [error, setError] = useState(null);

  // Polling interval for live sync (10 seconds for better responsiveness)
  const SYNC_INTERVAL = 10000;

  const { data: suggestion, isLoading: suggestionLoading } = useQuery({
    queryKey: ['suggestion', suggestionId],
    queryFn: () => base44.entities.Suggestion.filter({ id: suggestionId }).then(s => s[0]),
    enabled: !!suggestionId,
    refetchInterval: SYNC_INTERVAL,
    refetchIntervalInBackground: false,
  });

  const { data: allDocumentSuggestions } = useQuery({
    queryKey: ['allDocumentSuggestions', suggestion?.documentId],
    queryFn: () => base44.entities.Suggestion.filter({ documentId: suggestion.documentId }),
    enabled: !!suggestion?.documentId,
    initialData: [],
    refetchInterval: SYNC_INTERVAL,
    refetchIntervalInBackground: false,
  });

  const { data: document } = useQuery({
    queryKey: ['document', suggestion?.documentId],
    queryFn: () => base44.entities.Document.filter({ id: suggestion.documentId }).then(d => d[0]),
    enabled: !!suggestion?.documentId,
    refetchInterval: SYNC_INTERVAL,
    refetchIntervalInBackground: false,
  });

  const { data: section } = useQuery({
    queryKey: ['section', suggestion?.sectionId],
    queryFn: () => base44.entities.Section.filter({ id: suggestion.sectionId }).then(s => s[0]),
    enabled: !!suggestion?.sectionId,
    refetchInterval: SYNC_INTERVAL,
    refetchIntervalInBackground: false,
  });

  const { data: topic } = useQuery({
    queryKey: ['topic', suggestion?.topicId],
    queryFn: () => base44.entities.Topic.filter({ id: suggestion.topicId }).then(t => t[0]),
    enabled: !!suggestion?.topicId,
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
      const votes = await base44.entities.Vote.filter({ 
        suggestionId, 
        userId: user.id 
      });
      return votes.length > 0 ? votes[0] : null;
    },
    enabled: !!suggestionId && !!user?.id,
    refetchInterval: SYNC_INTERVAL,
    refetchIntervalInBackground: false,
  });

  const { data: args, isLoading: argsLoading } = useQuery({
    queryKey: ['arguments', suggestionId],
    queryFn: () => base44.entities.Argument.filter({ suggestionId }, '-created_date'),
    initialData: [],
    enabled: !!suggestionId,
  });

  const { data: comments } = useQuery({
    queryKey: ['comments', suggestionId],
    queryFn: () => base44.entities.Comment.filter({ 
      rootEntityType: 'suggestion',
      rootEntityId: suggestionId 
    }, '-created_date'),
    initialData: [],
    enabled: !!suggestionId,
  });

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

  const getUserName = (email) => {
    const user = users.find(u => u.email === email);
    return user?.full_name || email;
  };

  // פונקציית עזר לטיפול בנקודות ברקע
  const handlePointsInBackground = async (action, vote, currentUserVote) => {
    if (!document?.gamificationEnabled) return;
    
    try {
      let pointsChange = 0;
      let description = '';
      
      if (action === 'cancel' && vote === 'pro') {
        pointsChange = -10;
        description = `ביטול הצבעה בעד על ההצעה: ${suggestion.title}`;
      } else if (action === 'change') {
        if (currentUserVote?.vote === 'con' && vote === 'pro') {
          pointsChange = 10;
          description = `קיבל הצבעה בעד על ההצעה: ${suggestion.title}`;
        } else if (currentUserVote?.vote === 'pro' && vote === 'con') {
          pointsChange = -10;
          description = `הצבעה השתנתה מבעד לנגד על ההצעה: ${suggestion.title}`;
        }
      } else if (action === 'new' && vote === 'pro') {
        pointsChange = 10;
        description = `קיבל הצבעה בעד על ההצעה: ${suggestion.title}`;
      }
      
      if (pointsChange !== 0) {
        const suggestionCreatorList = await base44.entities.User.filter({ email: suggestion.created_by });
        if (suggestionCreatorList.length > 0) {
          const suggestionCreator = suggestionCreatorList[0];
          const newPoints = Math.max(0, (suggestionCreator.points || 1000) + pointsChange);
          await base44.entities.User.update(suggestionCreator.id, { points: newPoints });
          await base44.entities.PointsTransaction.create({
            userId: suggestionCreator.id,
            amount: pointsChange,
            action: pointsChange > 0 ? 'vote_received' : 'vote_canceled',
            description,
            relatedEntityId: suggestion.id,
            relatedEntityType: 'suggestion'
          });
        }
      }
    } catch (err) {
      console.error('[POINTS] Error handling points:', err);
    }
  };

  const voteMutation = useMutation({
    mutationFn: async (vote) => {
      if (!user) throw new Error(t('mustBeLoggedInToVote'));

      let newProVotes = suggestion.proVotes || 0;
      let newConVotes = suggestion.conVotes || 0;
      let pointsAction = null;
      
      if (userVote) {
        if (userVote.vote === vote) {
          // ביטול הצבעה
          await base44.entities.Vote.delete(userVote.id);
          if (vote === 'pro') newProVotes = Math.max(0, newProVotes - 1);
          else newConVotes = Math.max(0, newConVotes - 1);
          pointsAction = 'cancel';
        } else {
          // שינוי כיוון הצבעה
          await base44.entities.Vote.update(userVote.id, { vote });
          if (vote === 'pro') {
            newProVotes += 1;
            newConVotes = Math.max(0, newConVotes - 1);
          } else {
            newConVotes += 1;
            newProVotes = Math.max(0, newProVotes - 1);
          }
          pointsAction = 'change';
        }
      } else {
        // הצבעה חדשה
        await base44.entities.Vote.create({
          suggestionId,
          userId: user.id,
          vote
        });
        if (vote === 'pro') newProVotes += 1;
        else newConVotes += 1;
        pointsAction = 'new';
      }
      
      // עדכון ההצעה
      const updatedSuggestion = await base44.entities.Suggestion.update(suggestionId, {
        proVotes: newProVotes,
        conVotes: newConVotes
      });
      
      // טיפול בנקודות ברקע - לא חוסם
      handlePointsInBackground(pointsAction, vote, userVote);
      
      // התראות ועדכון תורמים ברקע
      notifyVoteOnSuggestion({ suggestion, voterEmail: user.email }).catch(() => {});
      import('../components/document/calculateContributors').then(({ calculateDocumentContributors }) => {
        calculateDocumentContributors(suggestion.documentId).then(count => {
          base44.entities.Document.update(suggestion.documentId, { totalUsersInteracted: count });
        });
      }).catch(() => {});

      // בדיקת קונסנזוס
      const { shouldAccept } = await checkSuggestionConsensus(updatedSuggestion, document);
      
      if (shouldAccept && suggestion.status === 'pending') {
        const accepted = await autoAcceptSuggestion(updatedSuggestion, user.id, document);
        
        if (accepted) {
          if (!userVote && vote === 'pro' && document?.gamificationEnabled) {
            base44.auth.updateMe({ points: (user.points || 1000) + 50 }).catch(() => {});
            base44.entities.PointsTransaction.create({
              userId: user.id,
              amount: 50,
              action: 'vote_influenced_acceptance',
              description: `ההצבעה שלך השפיעה על קבלת ההצעה: ${suggestion.title}`,
              relatedEntityId: suggestion.id,
              relatedEntityType: 'suggestion'
            }).catch(() => {});
          }
          return { accepted: true };
        }
      }
      
      return { accepted: false };
    },
    // Optimistic update - only for vote counts, NOT for status
    onMutate: async (vote) => {
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
    },
    onError: (err, variables, context) => {
      if (context?.previousSuggestion) {
        queryClient.setQueryData(['suggestion', suggestionId], context.previousSuggestion);
      }
      if (context?.previousVote !== undefined) {
        queryClient.setQueryData(['userVote', suggestionId, user?.id], context.previousVote);
      }
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    },
    onSuccess: (data) => {
      if (data?.accepted) {
        queryClient.invalidateQueries({ queryKey: ['sections', document?.id] });
        queryClient.invalidateQueries({ queryKey: ['suggestions', document?.id] });
        queryClient.invalidateQueries({ queryKey: ['suggestion', suggestionId] });
        queryClient.invalidateQueries({ queryKey: ['allVersions'] });
        queryClient.invalidateQueries({ queryKey: ['document', document?.id] });
      }
      queryClient.invalidateQueries({ queryKey: ['userVote', suggestionId, user?.id] });
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

  const updateStatusMutation = useMutation({
    mutationFn: async (status) => {
      if (!isAdmin) throw new Error(t('adminAccessRequired'));
      
      if (status === 'accepted' && suggestion.type === 'edit_section' && section) {
        // Get existing versions to calculate next version number
        const versions = await base44.entities.DocumentVersion.filter({ sectionId: section.id });
        const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version)) + 1 : 1;
        
        // Save version with OLD content before updating
        await base44.entities.DocumentVersion.create({
          documentId: suggestion.documentId,
          sectionId: section.id,
          content: section.content,
          changeDescription: `לפני: ${suggestion.title}`,
          version: nextVersion,
          changeType: 'suggestion_accepted',
          suggestionId: suggestion.id
        });
        
        // Update section with new content
        await base44.entities.Section.update(section.id, {
          content: suggestion.newContent,
          lastEditedBy: user.id
        });
        
        // Save version with NEW content after updating
        await base44.entities.DocumentVersion.create({
          documentId: suggestion.documentId,
          sectionId: section.id,
          content: suggestion.newContent,
          changeDescription: suggestion.title,
          version: nextVersion + 1,
          changeType: 'suggestion_accepted',
          suggestionId: suggestion.id
        });
      } else if (status === 'accepted' && suggestion.type === 'new_section') {
        const sections = await base44.entities.Section.filter({ 
          documentId: suggestion.documentId,
          topicId: suggestion.topicId 
        }, 'order');
        
        let newOrder;
        if (suggestion.insertPosition !== undefined && suggestion.insertPosition !== null) {
          // Insert at specific position - update orders of sections after this position
          const sectionsToUpdate = sections.filter(s => s.order >= suggestion.insertPosition);
          for (const section of sectionsToUpdate) {
            await base44.entities.Section.update(section.id, { order: section.order + 1 });
          }
          newOrder = suggestion.insertPosition;
        } else {
          // Insert at end
          const maxOrder = sections.length > 0 ? Math.max(...sections.map(s => s.order)) : -1;
          newOrder = maxOrder + 1;
        }
        
        const newSection = await base44.entities.Section.create({
          documentId: suggestion.documentId,
          topicId: suggestion.topicId,
          content: suggestion.newContent,
          order: newOrder,
          lastEditedBy: user.id
        });
        
        // Create initial version for new section
        await base44.entities.DocumentVersion.create({
          documentId: suggestion.documentId,
          sectionId: newSection.id,
          content: suggestion.newContent,
          changeDescription: suggestion.title,
          version: 1,
          changeType: 'section_created',
          suggestionId: suggestion.id
        });
      }

      await base44.entities.Suggestion.update(suggestionId, { status });
      
      // שליחת התראה על שינוי סטטוס
      try {
        await notifySuggestionStatusChange({ suggestion, newStatus: status });
      } catch (notifError) {
        console.error('[STATUS NOTIFICATION ERROR]', notifError);
      }
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
      navigate(`${createPageUrl("DocumentView")}?id=${suggestion.documentId}`);
    },
    onError: (err) => {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  });

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

  if (!suggestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-5xl mx-auto text-center py-20">
          <h1 className="text-2xl font-bold text-slate-900">{t('suggestionNotFound')}</h1>
          <Button className="mt-4" onClick={() => navigate(createPageUrl("Home"))}>
            {t('goHome')}
          </Button>
        </div>
      </div>
    );
  }

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

  const proArgs = args.filter(a => a.type === 'pro');
  const conArgs = args.filter(a => a.type === 'con');
  const consensusScore = suggestion.proVotes + suggestion.conVotes > 0 
    ? (suggestion.proVotes / (suggestion.proVotes + suggestion.conVotes) * 100).toFixed(0)
    : 50;

  // סינון רק גרסאות עם suggestionId
  const suggestionVersions = sectionVersions.filter(v => v.suggestionId);

  const handleNavigateToVersion = (direction) => {
    console.log('[DEBUG] Navigate version:', direction);
    console.log('[DEBUG] suggestionVersions:', suggestionVersions);
    console.log('[DEBUG] current suggestionId:', suggestionId);
    
    const currentIndex = suggestionVersions.findIndex(v => v.suggestionId === suggestionId);
    console.log('[DEBUG] currentIndex:', currentIndex);
    
    let targetIndex;
    
    if (direction === 'newer') {
      targetIndex = currentIndex - 1;
    } else {
      targetIndex = currentIndex + 1;
    }
    
    console.log('[DEBUG] targetIndex:', targetIndex);
    
    if (targetIndex >= 0 && targetIndex < suggestionVersions.length) {
      const targetVersion = suggestionVersions[targetIndex];
      console.log('[DEBUG] targetVersion:', targetVersion);
      console.log('[DEBUG] Navigating to:', targetVersion.suggestionId);
      navigate(`${createPageUrl("SuggestionDetail")}?id=${targetVersion.suggestionId}`);
    } else {
      console.log('[DEBUG] targetIndex out of bounds');
    }
  };

  const currentVersionIndex = suggestionVersions.findIndex(v => v.suggestionId === suggestionId);
  const isNewestVersion = currentVersionIndex === 0;
  const isOldestVersion = currentVersionIndex === suggestionVersions.length - 1 || currentVersionIndex === -1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6 overflow-x-hidden">
      <div className="max-w-5xl mx-auto space-y-4 md:space-y-6 w-full overflow-x-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex-1 min-w-0 w-full">
            <PageHeader 
              title={suggestion.title}
              backUrl={`${createPageUrl("DocumentView")}?id=${suggestion.documentId}`}
            />
          </div>
          {user && user.email === suggestion.created_by && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm(t('confirmDeleteSuggestion'))) {
                  deleteSuggestionMutation.mutate();
                }
              }}
              disabled={deleteSuggestionMutation.isPending}
              className="w-full md:w-auto shrink-0"
            >
              <Trash2 className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('deleteSuggestion')}
            </Button>
          )}
        </div>
        
        {document && (
          <p className={`text-slate-600 ${isRTL ? 'text-right' : ''}`}>
            <Link to={`${createPageUrl("DocumentView")}?id=${document.id}`} className="hover:underline">
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
                <Badge variant="outline" className="text-xs">
                  {suggestion.type === 'new_section' ? t('newSection') : t('suggestionToEditSection')}
                </Badge>

                <span className="text-xs text-slate-500">
                  {t('by')} <Link to={`${createPageUrl("Profile")}?userId=${users.find(u => u.email === suggestion.created_by)?.id}`} className="hover:underline text-blue-600">{getUserName(suggestion.created_by)}</Link>
                </span>
              </div>
              {suggestion.status === 'pending' && suggestion.timerEndsAt && (
                <Badge variant="outline" className="flex items-center gap-1 text-xs shrink-0">
                  <Clock className="w-3 h-3" />
                  {getTimeRemaining(suggestion.timerEndsAt)}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 md:space-y-6 p-3 md:p-6 overflow-x-hidden">
            {suggestion.explanation && typeof suggestion.explanation === 'string' && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">{t('explanation')}</h3>
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
                </div>
              )}



            {suggestion.type === 'edit_section' && suggestion.originalContent ? (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">{t('proposedChanges')}</h3>
                <Link 
                  to={`${createPageUrl("DocumentCleanView")}?id=${suggestion.documentId}&scrollToSuggestion=${suggestionId}`}
                  className="block"
                >
                  <div className="hover:shadow-md transition-all cursor-pointer rounded-lg">
                    <SectionDiff
                      originalContent={suggestion.originalContent}
                      newContent={suggestion.newContent}
                      suggestion={suggestion}
                      documentId={suggestion.documentId}
                      sectionId={suggestion.sectionId}
                    />
                  </div>
                </Link>
              </div>
            ) : suggestion.type === 'new_section' ? (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">{t('proposedContent')}</h3>
                <Link 
                  to={`${createPageUrl("DocumentCleanView")}?id=${suggestion.documentId}&scrollToSuggestion=${suggestionId}`}
                  className="block"
                >
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg hover:border-green-400 hover:shadow-md transition-all cursor-pointer">
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
                </Link>
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">{t('proposedContent')}</h3>
                <Link 
                  to={`${createPageUrl("DocumentCleanView")}?id=${suggestion.documentId}&scrollToSuggestion=${suggestionId}`}
                  className="block"
                >
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all cursor-pointer">
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
                </Link>
              </div>
            )}

            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pt-4 border-t">
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

              {user && suggestion.status === 'pending' && document?.votingButtonsEnabled && (
                <div className="flex gap-2 w-full md:w-auto">
                  <Button
                    variant={userVote?.vote === 'pro' ? 'default' : 'outline'}
                    onClick={() => voteMutation.mutate('pro')}
                    disabled={voteMutation.isPending}
                    className={`flex-1 md:flex-initial text-xs md:text-sm ${userVote?.vote === 'pro' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                  >
                    <ThumbsUp className={`w-3 h-3 md:w-4 md:h-4 ${isRTL ? 'ml-1 md:ml-2' : 'mr-1 md:mr-2'}`} />
                    {t('votePro')}
                  </Button>
                  <Button
                    variant={userVote?.vote === 'con' ? 'default' : 'outline'}
                    onClick={() => voteMutation.mutate('con')}
                    disabled={voteMutation.isPending}
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
                  <CheckCircle className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {t('acceptSuggestion')}
                </Button>
                <Button
                  onClick={() => updateStatusMutation.mutate('rejected')}
                  disabled={updateStatusMutation.isPending}
                  variant="destructive"
                  className="w-full md:w-auto text-xs md:text-sm"
                >
                  <XCircle className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {t('rejectSuggestion')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

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
              {user && newArgument.type !== 'pro' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewArgument({ type: 'pro', content: "" })}
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
              {user && newArgument.type !== 'con' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewArgument({ type: 'con', content: "" })}
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
            <CardTitle className="text-base md:text-lg">{t('commentsOnSuggestion')}</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 overflow-x-hidden">
            <CommentsSection
              entityType="suggestion"
              entityId={suggestionId}
              user={user}
              sectionId={suggestion?.sectionId}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}