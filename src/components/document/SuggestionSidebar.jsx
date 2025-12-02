import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  X, ThumbsUp, ThumbsDown, MessageSquare, Clock, 
  CheckCircle, XCircle, AlertCircle, Trash2, ExternalLink
} from "lucide-react";
import VotesNeededCounter from "./VotesNeededCounter";
import CommentsSection from "./CommentsSection";
import SectionDiff from "./SectionDiff";
import TranslatableContent from "./TranslatableContent";
import { checkSuggestionConsensus, autoAcceptSuggestion } from "./suggestionAutoAccept";
import { useLanguage } from "@/components/LanguageContext";
import { notifyVoteOnSuggestion, notifySuggestionStatusChange } from "../notifications/createNotification";
import { detectLanguage } from "@/components/utils/translationUtils";

export default function SuggestionSidebar({ 
  suggestionId, 
  onClose, 
  document: parentDocument,
  user,
  isAdmin: parentIsAdmin
}) {
  const { t, isRTL } = useLanguage();
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
    enabled: !!suggestion?.documentId && !parentDocument,
    initialData: parentDocument,
  });

  const { data: section } = useQuery({
    queryKey: ['section', suggestion?.sectionId],
    queryFn: () => base44.entities.Section.filter({ id: suggestion.sectionId }).then(s => s[0]),
    enabled: !!suggestion?.sectionId,
  });

  const { data: topic } = useQuery({
    queryKey: ['topic', suggestion?.topicId],
    queryFn: () => base44.entities.Topic.filter({ id: suggestion.topicId }).then(t => t[0]),
    enabled: !!suggestion?.topicId,
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
    enabled: !!user?.id && !!document?.id && parentIsAdmin === undefined,
    initialData: parentIsAdmin,
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

  const { data: args } = useQuery({
    queryKey: ['arguments', suggestionId],
    queryFn: () => base44.entities.Argument.filter({ suggestionId }, '-created_date'),
    initialData: [],
    enabled: !!suggestionId,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const getUserName = (email) => {
    const u = users.find(usr => usr.email === email);
    return u?.full_name || email;
  };

  const voteMutation = useMutation({
    mutationFn: async (vote) => {
      if (!user) throw new Error(t('mustBeLoggedInToVote'));

      const doc = document || parentDocument;
      let newProVotes = suggestion.proVotes || 0;
      let newConVotes = suggestion.conVotes || 0;
      
      if (userVote) {
        if (userVote.vote === vote) {
          // ביטול הצבעה
          await base44.entities.Vote.delete(userVote.id);
          if (vote === 'pro') newProVotes = Math.max(0, newProVotes - 1);
          else newConVotes = Math.max(0, newConVotes - 1);
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
      }

      const updatedSuggestion = await base44.entities.Suggestion.update(suggestionId, {
        proVotes: newProVotes,
        conVotes: newConVotes
      });

      // פעולות ברקע - לא חוסמות
      notifyVoteOnSuggestion({ suggestion, voterEmail: user.email }).catch(() => {});
      import('./calculateContributors').then(({ calculateDocumentContributors }) => {
        calculateDocumentContributors(suggestion.documentId).then(count => {
          base44.entities.Document.update(suggestion.documentId, { totalUsersInteracted: count });
        });
      }).catch(() => {});

      const { shouldAccept } = await checkSuggestionConsensus(updatedSuggestion, doc);
      if (shouldAccept && suggestion.status === 'pending') {
        const accepted = await autoAcceptSuggestion(updatedSuggestion, user.id, doc);
        if (accepted) {
          return { accepted: true };
        }
      }
      return { accepted: false };
    },
    // Optimistic update
    onMutate: async (vote) => {
      await queryClient.cancelQueries({ queryKey: ['suggestion', suggestionId] });
      await queryClient.cancelQueries({ queryKey: ['userVote', suggestionId, user?.id] });
      
      const previousSuggestion = queryClient.getQueryData(['suggestion', suggestionId]);
      const previousVote = queryClient.getQueryData(['userVote', suggestionId, user?.id]);
      const doc = document || parentDocument;
      
      // עדכון אופטימיסטי של ההצעה
      queryClient.setQueryData(['suggestion', suggestionId], (old) => {
        if (!old) return old;
        
        let newProVotes = old.proVotes || 0;
        let newConVotes = old.conVotes || 0;
        
        if (userVote) {
          if (userVote.vote === vote) {
            if (vote === 'pro') newProVotes = Math.max(0, newProVotes - 1);
            else newConVotes = Math.max(0, newConVotes - 1);
          } else {
            if (vote === 'pro') {
              newProVotes += 1;
              newConVotes = Math.max(0, newConVotes - 1);
            } else {
              newConVotes += 1;
              newProVotes = Math.max(0, newProVotes - 1);
            }
          }
        } else {
          if (vote === 'pro') newProVotes += 1;
          else newConVotes += 1;
        }
        
        // בדיקה אופטימיסטית אם ההצעה תתקבל
        const threshold = doc?.threshold || 2;
        const delta = newProVotes - newConVotes;
        const willBeAccepted = delta >= threshold && old.status === 'pending';
        
        return { 
          ...old, 
          proVotes: newProVotes, 
          conVotes: newConVotes,
          status: willBeAccepted ? 'accepted' : old.status
        };
      });
      
      // עדכון אופטימיסטי של ההצבעה
      queryClient.setQueryData(['userVote', suggestionId, user?.id], (old) => {
        if (userVote) {
          if (userVote.vote === vote) return null;
          else return { ...old, vote };
        } else {
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
      const doc = document || parentDocument;
      if (data?.accepted) {
        // רענון כל הנתונים הרלוונטיים
        queryClient.invalidateQueries({ queryKey: ['sections', doc?.id] });
        queryClient.invalidateQueries({ queryKey: ['suggestions', doc?.id] });
        queryClient.invalidateQueries({ queryKey: ['suggestion', suggestionId] });
        queryClient.invalidateQueries({ queryKey: ['allDocumentSuggestions', doc?.id] });
        queryClient.invalidateQueries({ queryKey: ['allVersions'] });
        queryClient.invalidateQueries({ queryKey: ['document', doc?.id] });
        queryClient.invalidateQueries({ queryKey: ['publicDocuments'] });
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
        const versions = await base44.entities.DocumentVersion.filter({ sectionId: section.id });
        const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version)) + 1 : 1;
        
        const oldContentLang = detectLanguage(section.content || '');
        const newContentLang = detectLanguage(suggestion.newContent || '');
        
        await base44.entities.DocumentVersion.create({
          documentId: suggestion.documentId,
          sectionId: section.id,
          content: section.content,
          changeDescription: `לפני: ${suggestion.title}`,
          version: nextVersion,
          changeType: 'suggestion_accepted',
          suggestionId: suggestion.id,
          originalLanguage: oldContentLang
        });
        
        await base44.entities.Section.update(section.id, {
          content: suggestion.newContent,
          lastEditedBy: user.id,
          originalLanguage: newContentLang
        });
        
        await base44.entities.DocumentVersion.create({
          documentId: suggestion.documentId,
          sectionId: section.id,
          content: suggestion.newContent,
          changeDescription: suggestion.title,
          version: nextVersion + 1,
          changeType: 'suggestion_accepted',
          suggestionId: suggestion.id,
          originalLanguage: newContentLang
        });
      } else if (status === 'accepted' && suggestion.type === 'new_section') {
        const sections = await base44.entities.Section.filter({ 
          documentId: suggestion.documentId,
          topicId: suggestion.topicId 
        }, 'order');
        
        let newOrder;
        if (suggestion.insertPosition !== undefined && suggestion.insertPosition !== null) {
          const sectionsToUpdate = sections.filter(s => s.order >= suggestion.insertPosition);
          for (const sec of sectionsToUpdate) {
            await base44.entities.Section.update(sec.id, { order: sec.order + 1 });
          }
          newOrder = suggestion.insertPosition;
        } else {
          const maxOrder = sections.length > 0 ? Math.max(...sections.map(s => s.order)) : -1;
          newOrder = maxOrder + 1;
        }
        
        const newContentLang = detectLanguage(suggestion.newContent || '');
        
        const newSection = await base44.entities.Section.create({
          documentId: suggestion.documentId,
          topicId: suggestion.topicId,
          content: suggestion.newContent,
          order: newOrder,
          lastEditedBy: user.id,
          originalLanguage: newContentLang
        });
        
        await base44.entities.DocumentVersion.create({
          documentId: suggestion.documentId,
          sectionId: newSection.id,
          content: suggestion.newContent,
          changeDescription: suggestion.title,
          version: 1,
          changeType: 'section_created',
          suggestionId: suggestion.id,
          originalLanguage: newContentLang
        });
      }

      await base44.entities.Suggestion.update(suggestionId, { status });
      
      try {
        await notifySuggestionStatusChange({ suggestion, newStatus: status });
      } catch (notifError) {
        console.error('[STATUS NOTIFICATION ERROR]', notifError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestion', suggestionId] });
      queryClient.invalidateQueries({ queryKey: ['sections', document?.id] });
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      onClose();
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
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      onClose();
    },
    onError: (err) => {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  });

  if (suggestionLoading || !suggestion) {
    return (
      <div className={`fixed inset-y-0 ${isRTL ? 'right-0' : 'left-0'} w-full md:w-[500px] bg-white shadow-2xl z-50 flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className={`fixed inset-y-0 ${isRTL ? 'right-0' : 'left-0'} w-full md:w-[500px] bg-white shadow-2xl z-50 flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Badge variant="outline" className={`${getStatusColor(suggestion.status)} text-xs shrink-0`}>
              {suggestion.status}
            </Badge>
            <h2 className="font-semibold text-slate-900 truncate">{suggestion.title}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link to={`${createPageUrl("SuggestionDetail")}?id=${suggestionId}`}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <ExternalLink className="w-4 h-4" />
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Meta info */}
          <div className="flex flex-wrap gap-2 items-center text-sm">
            <Badge variant="outline" className="text-xs">
              {suggestion.type === 'new_section' ? t('newSection') : t('suggestionToEditSection')}
            </Badge>
            {topic && <Badge variant="outline" className="text-xs truncate max-w-[150px]">{topic.title}</Badge>}
            {suggestion.status === 'pending' && suggestion.timerEndsAt && (
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                <Clock className="w-3 h-3" />
                {getTimeRemaining(suggestion.timerEndsAt)}
              </Badge>
            )}
          </div>

          <div className="text-xs text-slate-500">
            {t('by')} <Link to={`${createPageUrl("Profile")}?userId=${users.find(u => u.email === suggestion.created_by)?.id}`} className="hover:underline text-blue-600">{getUserName(suggestion.created_by)}</Link>
          </div>

          {/* Explanation */}
          {suggestion.explanation && typeof suggestion.explanation === 'string' && (
            <div className="bg-slate-50 rounded-lg p-3">
              <h3 className="text-xs font-semibold text-slate-700 mb-1">{t('explanation')}</h3>
              <TranslatableContent
                content={suggestion.explanation}
                entity={suggestion}
                entityType="Suggestion"
                fieldName="explanation"
                className="text-sm text-slate-600"
              />
            </div>
          )}

          {/* Content diff or proposed content */}
          {suggestion.type === 'edit_section' && suggestion.originalContent ? (
            <div>
              <h3 className="text-xs font-semibold text-slate-700 mb-2">{t('proposedChanges')}</h3>
              <SectionDiff
                originalContent={suggestion.originalContent}
                newContent={suggestion.newContent}
                suggestion={suggestion}
                originalEntity={section}
                originalEntityType="Section"
              />
            </div>
          ) : (
            <div>
              <h3 className="text-xs font-semibold text-slate-700 mb-2">{t('proposedContent')}</h3>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <TranslatableContent
                  content={suggestion.newContent}
                  entity={suggestion}
                  entityType="Suggestion"
                  className="prose prose-sm max-w-none"
                />
              </div>
            </div>
          )}

          {/* Voting stats */}
          <div className="flex items-center gap-4 py-3 border-y border-slate-200">
            <div className="text-center">
              <div className="text-xl font-bold text-green-600">{suggestion.proVotes || 0}</div>
              <div className="text-[10px] text-slate-500">{t('proVotes')}</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-red-600">{suggestion.conVotes || 0}</div>
              <div className="text-[10px] text-slate-500">{t('conVotes')}</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-blue-600">{consensusScore}%</div>
              <div className="text-[10px] text-slate-500">{t('consensus')}</div>
            </div>
            <div className="flex-1">
              <VotesNeededCounter 
                suggestion={suggestion} 
                document={document || parentDocument}
                acceptedSuggestions={allDocumentSuggestions.filter(s => s.status === 'accepted')}
              />
            </div>
          </div>

          {/* Vote buttons */}
          {user && suggestion.status === 'pending' && (document || parentDocument)?.votingButtonsEnabled && (
            <div className="flex gap-2">
              <Button
                variant={userVote?.vote === 'pro' ? 'default' : 'outline'}
                onClick={() => voteMutation.mutate('pro')}
                disabled={voteMutation.isPending}
                className={`flex-1 ${userVote?.vote === 'pro' ? 'bg-green-600 hover:bg-green-700' : ''}`}
              >
                <ThumbsUp className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t('votePro')}
              </Button>
              <Button
                variant={userVote?.vote === 'con' ? 'default' : 'outline'}
                onClick={() => voteMutation.mutate('con')}
                disabled={voteMutation.isPending}
                className={`flex-1 ${userVote?.vote === 'con' ? 'bg-red-600 hover:bg-red-700' : ''}`}
              >
                <ThumbsDown className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t('voteCon')}
              </Button>
            </div>
          )}

          {/* Admin actions */}
          {isAdmin && suggestion.status === 'pending' && (
            <div className="flex gap-2">
              <Button
                onClick={() => updateStatusMutation.mutate('accepted')}
                disabled={updateStatusMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t('acceptSuggestion')}
              </Button>
              <Button
                onClick={() => updateStatusMutation.mutate('rejected')}
                disabled={updateStatusMutation.isPending}
                variant="destructive"
                className="flex-1"
              >
                <XCircle className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t('rejectSuggestion')}
              </Button>
            </div>
          )}

          {/* Delete button for creator */}
          {user && user.email === suggestion.created_by && suggestion.status === 'pending' && (
            <Button
              variant="outline"
              onClick={() => {
                if (confirm(t('confirmDeleteSuggestion'))) {
                  deleteSuggestionMutation.mutate();
                }
              }}
              disabled={deleteSuggestionMutation.isPending}
              className="w-full text-red-600 border-red-200 hover:bg-red-50"
            >
              <Trash2 className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('deleteSuggestion')}
            </Button>
          )}

          {/* Arguments */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
                <ThumbsUp className="w-3 h-3" />
                {t('proArguments')} ({proArgs.length})
              </h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {proArgs.length === 0 ? (
                  <p className="text-[10px] text-slate-500">{t('noProArgumentsYet')}</p>
                ) : (
                  proArgs.map(arg => (
                    <div key={arg.id} className="text-xs text-slate-700 bg-white p-2 rounded">
                      {arg.content}
                    </div>
                  ))
                )}
              </div>
              {user && newArgument.type !== 'pro' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setNewArgument({ type: 'pro', content: "" })}
                  className="w-full mt-2 text-xs h-7"
                >
                  {t('addProArgument')}
                </Button>
              )}
              {newArgument.type === 'pro' && (
                <div className="mt-2 space-y-2">
                  <Textarea
                    value={newArgument.content}
                    onChange={(e) => setNewArgument({ ...newArgument, content: e.target.value })}
                    placeholder={t('writeProArgument')}
                    rows={2}
                    className="text-xs"
                  />
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => addArgumentMutation.mutate(newArgument)} className="flex-1 h-7 text-xs">
                      {t('submit')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setNewArgument({ type: null, content: "" })} className="h-7 text-xs">
                      {t('cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-red-50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
                <ThumbsDown className="w-3 h-3" />
                {t('conArguments')} ({conArgs.length})
              </h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {conArgs.length === 0 ? (
                  <p className="text-[10px] text-slate-500">{t('noConArgumentsYet')}</p>
                ) : (
                  conArgs.map(arg => (
                    <div key={arg.id} className="text-xs text-slate-700 bg-white p-2 rounded">
                      {arg.content}
                    </div>
                  ))
                )}
              </div>
              {user && newArgument.type !== 'con' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setNewArgument({ type: 'con', content: "" })}
                  className="w-full mt-2 text-xs h-7"
                >
                  {t('addConArgument')}
                </Button>
              )}
              {newArgument.type === 'con' && (
                <div className="mt-2 space-y-2">
                  <Textarea
                    value={newArgument.content}
                    onChange={(e) => setNewArgument({ ...newArgument, content: e.target.value })}
                    placeholder={t('writeConArgument')}
                    rows={2}
                    className="text-xs"
                  />
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => addArgumentMutation.mutate(newArgument)} className="flex-1 h-7 text-xs">
                      {t('submit')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setNewArgument({ type: null, content: "" })} className="h-7 text-xs">
                      {t('cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Comments */}
          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              {t('commentsOnSuggestion')}
            </h4>
            <CommentsSection
              entityType="suggestion"
              entityId={suggestionId}
              user={user}
            />
          </div>
        </div>
      </div>
    </>
  );
}