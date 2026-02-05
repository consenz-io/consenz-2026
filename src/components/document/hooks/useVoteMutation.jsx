import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ensureUserPublicProfile } from "@/components/ensureUserPublicProfile";
import { toast } from "sonner";
import { autoAcceptSuggestion } from "../suggestionAutoAccept";
import React from "react";
import { rateLimitedAction, RATE_LIMITS } from "@/components/utils/rateLimiter";

/**
 * Custom hook for voting on suggestions
 * Handles optimistic updates, auto-acceptance, and race condition prevention
 */
export function useVoteMutation(document, user, suggestions, setAutoAcceptingIds, hasCheckedRef) {
  const queryClient = useQueryClient();
  const votingInProgressRef = React.useRef(new Set());
  
  const voteMutation = useMutation({
    mutationFn: async ({ suggestionId, vote, currentVote }) => {
      if (!user) throw new Error("יש להתחבר כדי להצביע");

      // Rate limiting check
      const rateLimitedVote = rateLimitedAction(
        async () => {
          if (votingInProgressRef.current.has(suggestionId)) {
            console.log('[VOTE] Already voting, ignoring');
            throw new Error("ההצבעה בתהליך, אנא המתן");
          }
          votingInProgressRef.current.add(suggestionId);
          return true;
        },
        `vote_${user.id}`,
        RATE_LIMITS.VOTE
      );

      await rateLimitedVote();

      try {
        const [freshVotes, freshSuggestions] = await Promise.all([
          base44.entities.Vote.filter({ suggestionId, userId: user.id }),
          base44.entities.Suggestion.filter({ id: suggestionId })
        ]);
        
        const serverVote = freshVotes[0];
        const freshSuggestion = freshSuggestions[0];
        
        if (!freshSuggestion) throw new Error("ההצעה לא נמצאה");
        if (freshSuggestion.status !== 'pending') {
          throw new Error("לא ניתן להצביע על הצעה שכבר טופלה");
        }
        
        let newProVotes = freshSuggestion.proVotes || 0;
        let newConVotes = freshSuggestion.conVotes || 0;
        let pointsAction = null;
        
        if (serverVote) {
          if (serverVote.vote === vote) {
            await base44.entities.Vote.delete(serverVote.id);
            if (vote === 'pro') newProVotes = Math.max(0, newProVotes - 1);
            else newConVotes = Math.max(0, newConVotes - 1);
            pointsAction = 'cancel';
          } else {
            await base44.entities.Vote.update(serverVote.id, { vote });
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
          const doubleCheck = await base44.entities.Vote.filter({ suggestionId, userId: user.id });
          if (doubleCheck.length > 0) {
            const existingVote = doubleCheck[0];
            if (existingVote.vote !== vote) {
              await base44.entities.Vote.update(existingVote.id, { vote });
              if (vote === 'pro') {
                newProVotes += 1;
                newConVotes = Math.max(0, newConVotes - 1);
              } else {
                newConVotes += 1;
                newProVotes = Math.max(0, newProVotes - 1);
              }
            } else {
              await base44.entities.Vote.delete(existingVote.id);
              if (vote === 'pro') newProVotes = Math.max(0, newProVotes - 1);
              else newConVotes = Math.max(0, newConVotes - 1);
            }
            pointsAction = 'cancel';
          } else {
            await base44.entities.Vote.create({
              suggestionId,
              userId: user.id,
              vote
            });
            
            if (vote === 'pro') newProVotes += 1;
            else newConVotes += 1;
            pointsAction = 'new';
          }
        }
        
        await base44.entities.Suggestion.update(suggestionId, {
          proVotes: newProVotes,
          conVotes: newConVotes
        });
        
        const updatedSuggestion = { ...freshSuggestion, proVotes: newProVotes, conVotes: newConVotes };

        // Check consensus
        let accepted = false;
        if (freshSuggestion.status === 'pending') {
          const consensuses = document.consensuses || [];
          let threshold;
          if (consensuses.length > 0) {
            const consensusMeterAverage = consensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / consensuses.length;
            threshold = Math.max(2, Math.round(consensusMeterAverage * (document.totalUsersInteracted || 1)));
          } else {
            threshold = Math.max(2, document.threshold || 2);
          }
          const shouldAccept = (newProVotes - newConVotes) >= threshold;
          
          if (shouldAccept) {
            hasCheckedRef.current.add(`${suggestionId}-accepted`);
            setAutoAcceptingIds(prev => ({ ...prev, [suggestionId]: true }));
            
            try {
              accepted = await autoAcceptSuggestion(updatedSuggestion, user.id, document);
            
              if (accepted) {
                queryClient.setQueryData(['suggestions', document?.id], (old) => {
                  if (!old) return old;
                  return old.map(s => 
                    s.id === updatedSuggestion.id 
                      ? { ...s, status: 'accepted', suggestionConsensus: updatedSuggestion.suggestionConsensus, participantsAtAcceptance: updatedSuggestion.participantsAtAcceptance }
                      : s
                  );
                });
                
                Promise.all([
                  queryClient.invalidateQueries({ queryKey: ['sections', document?.id] }),
                  queryClient.invalidateQueries({ queryKey: ['suggestions', document?.id] }),
                  queryClient.invalidateQueries({ queryKey: ['document', document?.id] }),
                  queryClient.invalidateQueries({ queryKey: ['topics', document?.id] }),
                  queryClient.invalidateQueries({ queryKey: ['allVersions'] }),
                  queryClient.invalidateQueries({ queryKey: ['versions', document?.id] })
                ]);
                
                if (!currentVote && vote === 'pro' && document.gamificationEnabled) {
                  base44.auth.updateMe({ points: (user.points || 1000) + 50 }).catch(() => {});
                  base44.entities.PointsTransaction.create({
                    userId: user.id,
                    amount: 50,
                    action: 'vote_influenced_acceptance',
                    description: `ההצבעה שלך השפיעה על קבלת ההצעה`,
                    relatedEntityId: suggestionId,
                    relatedEntityType: 'suggestion'
                  }).catch(() => {});
                }
              }
            } finally {
              setAutoAcceptingIds(prev => {
                const next = { ...prev };
                delete next[suggestionId];
                return next;
              });
            }
          }
        }
        
        if (!accepted && pointsAction === 'new') {
          ensureUserPublicProfile(user).catch(() => {});
        }
      
        return { accepted, newProVotes, newConVotes };
      } catch (err) {
        throw err;
      } finally {
        votingInProgressRef.current.delete(suggestionId);
      }
    },
    onMutate: async ({ suggestionId, vote, currentVote }) => {
      await queryClient.cancelQueries({ queryKey: ['suggestions', document?.id] });
      await queryClient.cancelQueries({ queryKey: ['userVotes', document?.id, user?.id] });
      
      const previousSuggestions = queryClient.getQueryData(['suggestions', document?.id]);
      const previousVotes = queryClient.getQueryData(['userVotes', document?.id, user?.id]);
      
      const suggestion = suggestions?.find(s => s.id === suggestionId);
      let newProVotes = suggestion?.proVotes || 0;
      let newConVotes = suggestion?.conVotes || 0;
      
      if (currentVote) {
        if (currentVote.vote === vote) {
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
      
      queryClient.setQueryData(['suggestions', document?.id], (old) => {
        if (!old) return old;
        return old.map(s => {
          if (s.id !== suggestionId) return s;
          return { ...s, proVotes: newProVotes, conVotes: newConVotes };
        });
      });
      
      queryClient.setQueryData(['userVotes', document?.id, user?.id], (old) => {
        if (!old) old = [];
        const otherVotes = old.filter(v => v.suggestionId !== suggestionId);
        
        if (currentVote) {
          if (currentVote.vote === vote) {
            return otherVotes;
          } else {
            return [...otherVotes, { ...currentVote, vote }];
          }
        } else {
          return [...otherVotes, { id: 'temp-' + Date.now() + '-' + suggestionId, suggestionId, userId: user.id, vote }];
        }
      });
      
      return { previousSuggestions, previousVotes };
    },
    onError: (err, variables, context) => {
      if (context?.previousSuggestions) {
        queryClient.setQueryData(['suggestions', document?.id], context.previousSuggestions);
      }
      if (context?.previousVotes) {
        queryClient.setQueryData(['userVotes', document?.id, user?.id], context.previousVotes);
      }
      toast.error('שגיאה בהצבעה, נסה שוב');
    },
    onSuccess: (data, variables) => {
      if (data?.newProVotes !== undefined) {
        queryClient.setQueryData(['suggestions', document?.id], (old) => {
          if (!old) return old;
          return old.map(s => {
            if (s.id !== variables.suggestionId) return s;
            return { 
              ...s, 
              proVotes: data.newProVotes, 
              conVotes: data.newConVotes,
              status: data.accepted ? 'accepted' : s.status
            };
          });
        });
      }
      
      if (data?.accepted) {
        toast.success('🎉 ההצעה התקבלה והמסמך עודכן!', { duration: 4000 });
      }
      
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['userVotes', document?.id, user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['suggestions', document?.id] })
      ]);
    },
  });

  return voteMutation;
}