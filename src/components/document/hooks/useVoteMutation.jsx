import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ensureUserPublicProfile } from "@/components/ensureUserPublicProfile";
import { toast } from "sonner";
import React from "react";

/**
 * OPTIMIZED: Custom hook for voting on suggestions
 * Now uses backend function to reduce API calls from 45+ to 1-2
 */
export function useVoteMutation(document, user, suggestions, setAutoAcceptingIds, hasCheckedRef) {
  const queryClient = useQueryClient();
  const votingInProgressRef = React.useRef(new Set());
  
  const voteMutation = useMutation({
    mutationFn: async ({ suggestionId, vote, currentVote }) => {
      if (!user) throw new Error("יש להתחבר כדי להצביע");

      // Prevent concurrent votes on same suggestion
      if (votingInProgressRef.current.has(suggestionId)) {
        console.log('[VOTE] Already voting on this suggestion, ignoring');
        throw new Error("ההצבעה בתהליך, אנא המתן");
      }
      
      votingInProgressRef.current.add(suggestionId);

      try {
        // Single backend call handles everything
        const response = await base44.functions.invoke('voteOnSuggestion', {
          suggestionId,
          vote
        });

        if (!response.data.success) {
          throw new Error(response.data.error || 'שגיאה בהצבעה');
        }

        const { newProVotes, newConVotes, accepted, voteAction } = response.data;
        
        console.log('[VOTE] Backend response:', { newProVotes, newConVotes, accepted, voteAction });

        // Mark as auto-accepting if accepted
        if (accepted) {
          setAutoAcceptingIds(prev => ({ ...prev, [suggestionId]: true }));
          
          // Clear after invalidation
          setTimeout(() => {
            setAutoAcceptingIds(prev => {
              const next = { ...prev };
              delete next[suggestionId];
              return next;
            });
          }, 2000);
        }

        // Ensure public profile exists for new voters
        if (voteAction === 'created') {
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
      console.error('[VOTE ERROR]', err);
      
      // Rollback optimistic updates
      if (context?.previousSuggestions) {
        queryClient.setQueryData(['suggestions', document?.id], context.previousSuggestions);
      }
      if (context?.previousVotes) {
        queryClient.setQueryData(['userVotes', document?.id, user?.id], context.previousVotes);
      }
      
      // Handle rate limit errors with countdown
      if (err.response?.status === 429 || err.message?.includes('המתן') || err.message?.toLowerCase().includes('wait')) {
        const remainingSeconds = err.response?.data?.remainingSeconds || 30;
        toast.error(`נא להמתין ${remainingSeconds} שניות לפני הצבעה נוספת`, { duration: remainingSeconds * 1000 });
      } else {
        const errorMessage = err.response?.data?.error || err.message || 'שגיאה בהצבעה, נסה שוב';
        toast.error(errorMessage);
      }
    },
    onSuccess: (data, variables) => {
      console.log('[VOTE SUCCESS]', { suggestionId: variables.suggestionId, accepted: data?.accepted });
      
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
        
        // Invalidate all related data when suggestion is accepted
        Promise.all([
          queryClient.invalidateQueries({ queryKey: ['sections', document?.id] }),
          queryClient.invalidateQueries({ queryKey: ['document', document?.id] }),
          queryClient.invalidateQueries({ queryKey: ['topics', document?.id] }),
          queryClient.invalidateQueries({ queryKey: ['documentMetadata', document?.id] }),
          queryClient.invalidateQueries({ queryKey: ['currentUser'] })
        ]).catch(err => console.error('[VOTE] Error invalidating queries:', err));
      }
      
      // Ensure fresh data after vote
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['userVotes', document?.id, user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['suggestions', document?.id] })
      ]).catch(err => console.error('[VOTE] Error invalidating queries:', err));
    },
  });

  return voteMutation;
}