import React, { useState, useEffect, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ensureUserPublicProfile } from "@/components/ensureUserPublicProfile";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  X, ThumbsUp, ThumbsDown, MessageSquare, Clock, 
  CheckCircle, XCircle, AlertCircle, Trash2, ExternalLink, Edit2, Save, Loader2, ShieldCheck
} from "lucide-react";
import VotesNeededCounter from "./VotesNeededCounter";
import VotingProgressSection from "./VotingProgressSection";
import CommentsSection from "./CommentsSection";
import SuggestionCountdown from "./SuggestionCountdown";
import SectionDiff from "./SectionDiff";
import TranslatableContent from "./TranslatableContent";
import DocumentTextContent from "./DocumentTextContent";
import { useLanguage } from "@/components/LanguageContext";
import { notifySuggestionStatusChange } from "../notifications/createNotification";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { PAGE_NAMES } from "@/components/pageNames";
// v2

export default function SuggestionSidebar({ 
  suggestionId, 
  onClose, 
  document: parentDocument,
  user,
  isAdmin: parentIsAdmin
}) {
  const { t, isRTL, language } = useLanguage();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const [isEditingExplanation, setIsEditingExplanation] = useState(false);
  const [explanationText, setExplanationText] = useState("");
  const [showAcceptedAnimation, setShowAcceptedAnimation] = useState(false);
  const prevStatusRef = React.useRef(null);

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

  const { data: suggestionComments = [] } = useQuery({
    queryKey: ['comments', 'suggestion', suggestionId],
    queryFn: () => base44.entities.Comment.filter({ 
      rootEntityType: 'suggestion',
      rootEntityId: suggestionId 
    }),
    initialData: [],
    enabled: !!suggestionId,
  });

  const totalCommentsCount = React.useMemo(() => {
    return suggestionComments.length;
  }, [suggestionComments]);

  const getUserName = (email) => {
    // Try public profile first (accessible to everyone)
    const profile = publicProfiles?.find(p => p.email === email);
    if (profile?.fullName) return profile.fullName;
    
    // Fallback to User entity (admins only)
    const u = users?.find(usr => usr.email === email);
    if (u?.full_name) return u.full_name;
    
    // User hasn't completed profile yet
    return 'User';
  };

  // מעקב אחרי שינוי סטטוס להצגת אנימציה
  React.useEffect(() => {
    if (!suggestion) return;
    
    if (prevStatusRef.current === 'pending' && suggestion.status === 'accepted') {
      setShowAcceptedAnimation(true);
      const timer = setTimeout(() => {
        setShowAcceptedAnimation(false);
        onClose(); // סגור את הסיידבר אחרי האנימציה
      }, 3000);
      
      return () => clearTimeout(timer);
    }
    
    prevStatusRef.current = suggestion.status;
  }, [suggestion?.status, onClose, suggestion]);

  const voteMutation = useMutation({
    mutationFn: async (vote) => {
      if (!user || !user.id) throw new Error(t('mustBeLoggedInToVote'));
      if (!suggestion || !suggestion.id) throw new Error('Suggestion not found');

      // Call backend function - handles race conditions by re-counting from DB
      const response = await base44.functions.invoke('voteOnSuggestion', { suggestionId, vote });
      const result = response.data;

      if (!result.success) {
        throw new Error(result.error || 'שגיאה בעיבוד ההצבעה');
      }

      // Background: update contributor count if new vote
      if (result.voteAction === 'created') {
        ensureUserPublicProfile(user).catch(() => {});
        import('./calculateContributors').then(({ calculateDocumentContributors }) =>
          calculateDocumentContributors(suggestion.documentId).then(count =>
            base44.entities.Document.update(suggestion.documentId, { totalUsersInteracted: count })
          )
        ).catch(() => {});
      }

      return { accepted: result.accepted, newProVotes: result.newProVotes, newConVotes: result.newConVotes };
    },
    // Optimistic update - only for vote counts, NOT for status
    onMutate: async (vote) => {
      await queryClient.cancelQueries({ queryKey: ['suggestion', suggestionId] });
      await queryClient.cancelQueries({ queryKey: ['userVote', suggestionId, user?.id] });
      
      const previousSuggestion = queryClient.getQueryData(['suggestion', suggestionId]);
      const previousVote = queryClient.getQueryData(['userVote', suggestionId, user?.id]);
      
      // Optimistic update - vote counts only, status stays unchanged
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestion', suggestionId] });
      queryClient.invalidateQueries({ queryKey: ['userVote', suggestionId, user?.id] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status) => {
      if (!isAdmin) throw new Error(t('adminAccessRequired'));
      
      if (status === 'accepted') {
        // Delegate to processAcceptance backend which handles all types correctly,
        // creates version records, updates sections, and awards points/notifications.
        const response = await base44.functions.invoke('processAcceptance', {
          suggestionId: suggestion.id,
          documentId: suggestion.documentId,
          voterId: user.id,
          wasNewVote: false,
          forceAccept: true
        });
        if (!response?.data?.success) {
          throw new Error(response?.data?.error || 'שגיאה בעיבוד ההצעה');
        }
        // Mark as approved by admin (processAcceptance already sets status=accepted)
        await base44.entities.Suggestion.update(suggestionId, { approvedByAdmin: true });
      } else {
        await base44.entities.Suggestion.update(suggestionId, { 
          status,
          ...(status === 'rejected' ? { rejectedByAdmin: true } : {})
        });
      }

      // אם גיימיפיקציה מופעלת ואדמין דחה — החזר נקודות ליוצר
      let refundAmount = 0;
      if (status === 'rejected' && document?.gamificationEnabled) {
        try {
          const transactions = await base44.entities.PointsTransaction.filter({
            relatedEntityId: suggestionId,
            action: 'suggestion_created'
          });
          const originalTransaction = transactions[0];
          refundAmount = originalTransaction ? Math.abs(originalTransaction.amount) : 0;

          if (refundAmount > 0) {
            const creatorUsers = await base44.entities.User.filter({ email: suggestion.created_by });
            const creator = creatorUsers[0];
            if (creator) {
              const newPoints = (creator.points || 1000) + refundAmount;
              await Promise.all([
                base44.entities.User.update(creator.id, { points: newPoints }),
                base44.entities.PointsTransaction.create({
                  userId: creator.id,
                  amount: refundAmount,
                  action: 'vote_canceled',
                  description: `החזר נקודות על הצעה שנדחתה ע"י מנהל: ${suggestion.title || ''}`,
                  relatedEntityId: suggestionId,
                  relatedEntityType: 'suggestion'
                })
              ]);
            }
          }
        } catch (pointsErr) {
          console.error('[UPDATE STATUS] Failed to refund points:', pointsErr);
        }
      }
      
      // שליחת התראה רק על דחייה — קבלה כבר מטופלת ע"י processAcceptance
      if (status === 'rejected' && suggestion.status === 'pending') {
        console.log('[UPDATE STATUS] Sending rejection notifications...');
        await notifySuggestionStatusChange({ 
          suggestion, 
          newStatus: status,
          rejectedByAdmin: true,
          refundAmount
        });
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

  const updateExplanationMutation = useMutation({
    mutationFn: async (newExplanation) => {
      await base44.entities.Suggestion.update(suggestionId, { 
        explanation: newExplanation.trim() || null 
      });
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

  if (suggestionLoading || !suggestion) {
    return (
      <>
        <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
        <div className={`fixed inset-y-0 ${isRTL ? 'right-0' : 'left-0'} w-full md:w-[500px] bg-white shadow-2xl z-50 flex flex-col`}>
          <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
            <span className="text-sm text-slate-500">{language === 'he' ? 'טוען הצעה...' : 'Loading...'}</span>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </>
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

  return (
    <>
      {/* Overlay */}
      <motion.div 
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />
      
      {/* Sidebar */}
      <motion.div 
        className={`fixed inset-y-0 ${isRTL ? 'right-0' : 'left-0'} w-full md:w-[500px] shadow-2xl z-50 flex flex-col overflow-hidden`}
        initial={{ x: isRTL ? '100%' : '-100%' }}
        animate={{ 
          x: 0,
          backgroundColor: showAcceptedAnimation 
            ? 'rgb(240 253 244)' 
            : 'rgb(255 255 255)'
        }}
        exit={{ x: isRTL ? '100%' : '-100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <AnimatePresence>
          {showAcceptedAnimation && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-emerald-400/20 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2 }}
            />
          )}
        </AnimatePresence>
        
        {/* Header */}
        <motion.div 
          className="flex items-center justify-between p-4 border-b border-slate-200 relative z-10"
          animate={{
            backgroundColor: showAcceptedAnimation ? 'rgb(220 252 231)' : 'rgb(248 250 252)'
          }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <AnimatePresence mode="wait">
              {showAcceptedAnimation ? (
                <motion.div
                  key="accepted"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0 }}
                  transition={{ type: "spring", duration: 0.5 }}
                >
                  <Badge className="bg-green-100 text-green-800 border-green-300 text-xs shrink-0 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    {t('accepted')}
                  </Badge>
                </motion.div>
              ) : (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Badge variant="outline" className={`${getStatusColor(suggestion.status)} text-xs shrink-0 cursor-default`}>
                          {t(suggestion.status)}
                        </Badge>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {suggestion.status === 'pending'
                        ? (language === 'he' ? 'ממתינה להצבעה' : language === 'ar' ? 'في انتظار التصويت' : 'Awaiting votes')
                        : suggestion.status === 'accepted'
                        ? (language === 'he' ? 'ההצעה התקבלה ויושמה במסמך' : language === 'ar' ? 'تمت الموافقة على الاقتراح' : 'Proposal accepted and applied')
                        : suggestion.status === 'rejected'
                        ? (language === 'he' ? 'ההצעה נדחתה' : language === 'ar' ? 'تم رفض الاقتراح' : 'Proposal rejected')
                        : suggestion.status === 'discussion'
                        ? (language === 'he' ? 'בדיון פתוח' : language === 'ar' ? 'قيد النقاش' : 'Open for discussion')
                        : suggestion.status}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </AnimatePresence>
            <h2 className="font-semibold text-slate-900 truncate">{suggestion.title}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link to={`${createPageUrl(PAGE_NAMES.SUGGESTION_DETAIL)}?id=${suggestionId}`}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <ExternalLink className="w-4 h-4" />
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </motion.div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {suggestion.status === 'pending' && suggestion.timerEndsAt && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
              <SuggestionCountdown timerEndsAt={suggestion.timerEndsAt} size="sm" />
            </div>
          )}

          <div className="text-xs text-slate-500 flex flex-wrap gap-x-2 gap-y-0.5">
            <span>
              {t('by')} {(() => {
                const profile = publicProfiles?.find(p => p.email === suggestion.created_by);
                const userObj = users?.find(u => u.email === suggestion.created_by);
                const userId = profile?.userId || userObj?.id;
                const userName = getUserName(suggestion.created_by);
                return userId ? (
                  <Link to={`${createPageUrl("Profile")}?userId=${userId}`} className="hover:underline text-blue-600">{userName}</Link>
                ) : (
                  <span className="text-slate-600">{userName}</span>
                );
              })()}
            </span>
            {suggestion.created_date && (
              <span>• {new Date(suggestion.created_date).toLocaleDateString(language === 'he' ? 'he-IL' : language === 'ar' ? 'ar-SA' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            )}
            {suggestion.status === 'accepted' && suggestion.updated_date && (
              <span className="text-green-600">• ✓ {t('acceptedOn')} {new Date(suggestion.updated_date).toLocaleDateString(language === 'he' ? 'he-IL' : language === 'ar' ? 'ar-SA' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            )}
            {suggestion.approvedByAdmin && suggestion.status === 'accepted' && (
              <span className="inline-flex items-center gap-1 text-indigo-700 font-medium">
                • <ShieldCheck className="w-3 h-3" /> {language === 'he' ? 'אושר ע״י מנהל' : language === 'ar' ? 'تمت الموافقة من المشرف' : 'Admin Approved'}
              </span>
            )}
          </div>

          {/* Content diff or proposed content */}
          {suggestion.type === 'delete_section' ? (
            <div>
              <div className="p-3 md:p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-sm font-bold text-red-700 mb-2">
                  {language === 'he' ? 'סעיף שמוצע למחיקה:' : language === 'ar' ? 'القسم المقترح حذفه:' : 'Section to be deleted:'}
                </div>
                <div 
                  className="prose prose-sm max-w-none text-slate-700 line-through opacity-60"
                  dangerouslySetInnerHTML={{ __html: suggestion.originalContent }}
                />
              </div>
              {suggestion.explanation && (
                <div className="mt-3 bg-slate-50 rounded-lg p-3">
                  <h3 className="text-xs font-semibold text-slate-700 mb-1">{t('explanation')}</h3>
                  <TranslatableContent content={suggestion.explanation} entity={suggestion} entityType="Suggestion" fieldName="explanation" className="text-sm text-slate-600" />
                </div>
              )}
            </div>
          ) : suggestion.type === 'edit_section' && suggestion.originalContent ? (
            <div>
              <SectionDiff
                originalContent={suggestion.originalContent}
                newContent={suggestion.newContent}
                suggestion={suggestion}
                documentId={suggestion.documentId}
                sectionId={suggestion.sectionId}
                section={section}
              />
              {(suggestion.explanation || user?.email === suggestion.created_by) && (
                <div className="mt-3 bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-semibold text-slate-700">{t('explanation')}</h3>
                    {user?.email === suggestion.created_by && !isEditingExplanation && (
                      <Button variant="ghost" size="sm" onClick={() => { setExplanationText(suggestion.explanation || ""); setIsEditingExplanation(true); }} className="h-6 w-6 p-0">
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  {isEditingExplanation ? (
                    <div className="space-y-2">
                      <Textarea value={explanationText} onChange={(e) => setExplanationText(e.target.value)} placeholder={t('explainChange')} rows={3} className="text-sm" />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateExplanationMutation.mutate(explanationText)} disabled={updateExplanationMutation.isPending} className="h-7 text-xs">
                          <Save className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />{t('saveChanges')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setIsEditingExplanation(false)} className="h-7 text-xs">{t('cancel')}</Button>
                      </div>
                    </div>
                  ) : suggestion.explanation ? (
                    <TranslatableContent content={suggestion.explanation} entity={suggestion} entityType="Suggestion" fieldName="explanation" className="text-sm text-slate-600" />
                  ) : (
                    <p className="text-sm text-slate-400 italic">{t('noDescription')}</p>
                  )}
                </div>
              )}
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
                  renderContent={(content) => (
                    <DocumentTextContent content={content} />
                  )}
                />
              </div>
              {(suggestion.explanation || user?.email === suggestion.created_by) && (
                <div className="mt-3 bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-semibold text-slate-700">{t('explanation')}</h3>
                    {user?.email === suggestion.created_by && !isEditingExplanation && (
                      <Button variant="ghost" size="sm" onClick={() => { setExplanationText(suggestion.explanation || ""); setIsEditingExplanation(true); }} className="h-6 w-6 p-0">
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  {isEditingExplanation ? (
                    <div className="space-y-2">
                      <Textarea value={explanationText} onChange={(e) => setExplanationText(e.target.value)} placeholder={t('explainChange')} rows={3} className="text-sm" />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateExplanationMutation.mutate(explanationText)} disabled={updateExplanationMutation.isPending} className="h-7 text-xs">
                          <Save className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />{t('saveChanges')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setIsEditingExplanation(false)} className="h-7 text-xs">{t('cancel')}</Button>
                      </div>
                    </div>
                  ) : suggestion.explanation ? (
                    <TranslatableContent content={suggestion.explanation} entity={suggestion} entityType="Suggestion" fieldName="explanation" className="text-sm text-slate-600" />
                  ) : (
                    <p className="text-sm text-slate-400 italic">{t('noDescription')}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Voting progress + buttons */}
          {(document || parentDocument)?.votingButtonsEnabled && suggestion.status === 'pending' && (
            <div className="py-1">
              {user ? (
                <VotingProgressSection
                  suggestion={suggestion}
                  document={document || parentDocument}
                  userVote={userVote}
                  voteMutation={voteMutation}
                  isRTL={isRTL}
                />
              ) : (
                // Not logged in: show read-only progress bar only
                <VotingProgressSection
                  suggestion={suggestion}
                  document={document || parentDocument}
                  userVote={null}
                  voteMutation={{ isPending: false, mutate: () => {} }}
                  isRTL={isRTL}
                  readOnly
                />
              )}
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
                className="flex-1"
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

          {/* Comments */}
          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              {t('commentsOnSuggestion')} ({totalCommentsCount})
            </h4>
            <CommentsSection
              entityType="suggestion"
              entityId={suggestionId}
              user={user}
            />
          </div>
        </div>
      </motion.div>
    </>
  );
}