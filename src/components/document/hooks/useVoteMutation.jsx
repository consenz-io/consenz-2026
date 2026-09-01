import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ensureUserPublicProfile } from "@/components/ensureUserPublicProfile";
import { toast } from "sonner";
import React from "react";

/**
 * Custom hook for voting on suggestions.
 * All acceptance logic is handled exclusively by the backend (voteOnSuggestion → processAcceptance).
 * Frontend only handles optimistic updates and UI feedback.
 */
export function useVoteMutation(document, user, suggestions, hasCheckedRef, onNotMember) {
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

        // Ensure public profile exists for new voters
        if (voteAction === 'created') {
          ensureUserPublicProfile(user).catch(() => {});
        }

        // ── Fallback: if vote reached threshold but acceptance didn't process ──
        // The deployed processAcceptance may be stale (read-after-write lock bug).
        // processAcceptanceV4 is the current function: it deploys correctly, handles
        // stuck locks + service-role UUID ObjectId filtering, and supports the
        // edit_suggestion-on-new_section flow (creates a section + converts the parent
        // and siblings to edit_section). Call it as a fallback when delta >= threshold
        // but accepted is false.
        const delta = (newProVotes || 0) - (newConVotes || 0);
        const threshold = Math.max(2, document?.threshold || 2);
        if (!accepted && delta >= threshold) {
          console.log('[VOTE] Threshold reached but not accepted, calling processAcceptanceV4 fallback...');
          try {
            const fallbackRes = await base44.functions.invoke('processAcceptanceV4', {
              suggestionId,
              documentId: document?.id,
              voterId: user.id,
              wasNewVote: voteAction === 'created',
              forceReleaseLock: true
            });
            const fallbackData = fallbackRes?.data || fallbackRes;
            console.log('[VOTE] processAcceptanceV4 fallback response:', fallbackData);
            if (fallbackData?.accepted || fallbackData?.message === 'Already processed') {
              return { accepted: true, newProVotes, newConVotes, voteAction };
            }
          } catch (fallbackErr) {
            console.error('[VOTE] processAcceptanceV4 fallback error:', fallbackErr);
          }
        }
      
        return { accepted, newProVotes, newConVotes, voteAction };
      } catch (err) {
        throw err;
      } finally {
        votingInProgressRef.current.delete(suggestionId);
      }
    },
    onMutate: async ({ suggestionId, vote, currentVote }) => {
      // Cancel in-flight queries to prevent race conditions
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['suggestions', document?.id] }),
        queryClient.cancelQueries({ queryKey: ['userVotes', document?.id, user?.id] }),
        queryClient.cancelQueries({ queryKey: ['documentAggregatedData', document?.id] })
      ]);
      
      const previousSuggestions = queryClient.getQueryData(['suggestions', document?.id]);
      const previousVotes = queryClient.getQueryData(['userVotes', document?.id, user?.id]);
      const previousAggregated = queryClient.getQueryData(['documentAggregatedData', document?.id]);
      
      // Read from live cache (not stale closure) to get accurate current vote counts
      const liveSuggestions = previousSuggestions || [];
      const suggestion = liveSuggestions.find(s => s.id === suggestionId);
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

      // Also optimistically update the aggregated cache — this is what actually
      // drives the button color (getUserVote reads from aggregatedData.votes) and
      // the displayed suggestion counts. Without this the dark green/red highlight
      // only appeared after the server round-trip, causing the felt delay.
      queryClient.setQueryData(['documentAggregatedData', document?.id], (old) => {
        if (!old) return old;
        const votes = Array.isArray(old.votes) ? old.votes : [];
        // Remove this user's existing vote on this suggestion, then re-add if needed
        const otherVotes = votes.filter(v => !(v.suggestionId === suggestionId && v.userId === user.id));
        let nextVotes;
        if (currentVote && currentVote.vote === vote) {
          // Toggling off — no vote row remains
          nextVotes = otherVotes;
        } else {
          nextVotes = [...otherVotes, { id: 'temp-' + Date.now() + '-' + suggestionId, suggestionId, userId: user.id, vote }];
        }
        return { ...old, votes: nextVotes };
      });
      
      return { previousSuggestions, previousVotes, previousAggregated };
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
      if (context?.previousAggregated) {
        queryClient.setQueryData(['documentAggregatedData', document?.id], context.previousAggregated);
      }
      
      // Handle "not a group member" error - show join dialog instead of toast
      const errorMessage = err.response?.data?.error || err.message || '';
      const isNotMember = errorMessage.includes('אינך חבר') || errorMessage.includes('not a member') || errorMessage.toLowerCase().includes('group member');
      if (isNotMember && onNotMember) {
        onNotMember();
        return;
      }

      // Always invalidate to get fresh server data after any error
      queryClient.invalidateQueries({ queryKey: ['suggestions', document?.id] });
      queryClient.invalidateQueries({ queryKey: ['userVotes', document?.id, user?.id] });

      // Handle rate limit errors
      const isRateLimit = err.response?.status === 429
        || err.status === 429
        || err.message?.toLowerCase().includes('rate limit')
        || err.message?.toLowerCase().includes('too many')
        || err.message?.includes('המתן')
        || errorMessage?.includes('המתן')
        || errorMessage?.toLowerCase().includes('rate limit');
      if (isRateLimit) {
        toast.error('ההצבעה לא נקלטה. נסו שוב בעוד כמה שניות', { duration: 8000 });
      } else {
        toast.error(errorMessage || 'שגיאה בהצבעה, נסה שוב');
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

        // ── H4: reconcile the aggregated cache with server truth ──────────────
        // onMutate optimistically wrote counts + a temp vote row into
        // documentAggregatedData (the cache that drives button colors + displayed
        // counts). Rewrite it here from the AUTHORITATIVE server response so the UI
        // can never diverge from the backend: use the server's verified counts, and
        // set the user's vote row based on the actual voteAction the server performed
        // (created/changed keep a row of `variables.vote`; canceled removes it).
        queryClient.setQueryData(['documentAggregatedData', document?.id], (old) => {
          if (!old) return old;
          const suggestions = Array.isArray(old.suggestions)
            ? old.suggestions.map(s => s.id === variables.suggestionId
                ? { ...s, proVotes: data.newProVotes, conVotes: data.newConVotes, status: data.accepted ? 'accepted' : s.status }
                : s)
            : old.suggestions;
          const votes = Array.isArray(old.votes) ? old.votes : [];
          const otherVotes = votes.filter(v => !(v.suggestionId === variables.suggestionId && v.userId === user?.id));
          const nextVotes = data.voteAction === 'canceled'
            ? otherVotes
            : [...otherVotes, { id: 'server-' + variables.suggestionId + '-' + user?.id, suggestionId: variables.suggestionId, userId: user?.id, vote: variables.vote }];
          return { ...old, suggestions, votes: nextVotes };
        });
      }

      if (data?.accepted === true) {
        toast.success('🎉 ההצעה התקבלה והמסמך עודכן!', { duration: 5000 });
        // Acceptance mutates section content, thresholds and multiple suggestion
        // statuses server-side — beyond what we can safely patch locally. Invalidate
        // the aggregated cache so the next read pulls the full reconciled state.
        queryClient.invalidateQueries({ queryKey: ['documentAggregatedData', document?.id] });
      }
      
      // Emit event for layout to update unvoted count (optimistic decrement)
      window.dispatchEvent(new CustomEvent('consenz:vote-cast'));
      // Emit event for tutorial completion detection
      window.dispatchEvent(new CustomEvent('proposal:voted'));
      
      // Real-time subscriptions (in DocumentView) will handle all further updates
      // (section content, suggestion status, document threshold) once processAcceptance completes.
    },
  });

  return voteMutation;
}