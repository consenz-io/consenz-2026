import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ensureUserPublicProfile } from "@/components/ensureUserPublicProfile";
import { toast } from "sonner";

/**
 * Handles voting on topic title edit suggestions, including:
 * - Race-condition prevention via in-progress ref
 * - DB-authoritative vote counting
 * - Auto-accept when threshold is reached
 * - DocumentVersion record creation
 * - Gamification points
 *
 * Extracted from DocumentContent to keep that component focused on UI only.
 */
export function useTopicVoteMutation({ document, user, topicEditSuggestions, queryClient: _qc }) {
  const queryClient = _qc || useQueryClient();
  const topicVotingInProgressRef = { current: new Set() };

  const mutation = useMutation({
    mutationFn: async ({ suggestionId, vote }) => {
      if (!user) throw new Error("יש להתחבר כדי להצביע");

      if (topicVotingInProgressRef.current.has(suggestionId)) {
        throw new Error("ההצבעה בתהליך, אנא המתן");
      }
      topicVotingInProgressRef.current.add(suggestionId);

      try {
        const topicSuggestion = topicEditSuggestions.find(s => s.id === suggestionId);

        const [existingVotes, freshSuggestions] = await Promise.all([
          base44.entities.TopicEditVote.filter({ suggestionId, userId: user.id }),
          base44.entities.TopicEditSuggestion.filter({ id: suggestionId }),
        ]);

        const serverVote = existingVotes[0];
        const freshSuggestion = freshSuggestions[0];

        if (!freshSuggestion || freshSuggestion.status !== 'pending') {
          throw new Error("ההצעה לא נמצאה או כבר טופלה");
        }

        if (serverVote) {
          if (serverVote.vote === vote) {
            await base44.entities.TopicEditVote.delete(serverVote.id);
          } else {
            await base44.entities.TopicEditVote.update(serverVote.id, { vote });
          }
        } else {
          await base44.entities.TopicEditVote.create({ suggestionId, userId: user.id, vote });
          ensureUserPublicProfile(user).catch(() => {});

          if (vote === 'pro' && document.gamificationEnabled && topicSuggestion) {
            base44.entities.User.filter({ email: topicSuggestion.created_by }).then(list => {
              const creator = list[0];
              if (!creator) return;
              return Promise.all([
                base44.entities.User.update(creator.id, { points: (creator.points || 1000) + 10 }),
                base44.entities.PointsTransaction.create({
                  userId: creator.id, amount: 10, action: 'vote_received',
                  description: 'קיבל הצבעה בעד על הצעת עריכת כותרת', relatedEntityType: 'topic',
                }),
              ]);
            }).catch(() => {});
          }
        }

        // Re-count from DB — source of truth
        const allFreshVotes = await base44.entities.TopicEditVote.filter({ suggestionId });
        const newProVotes = allFreshVotes.filter(v => v.vote === 'pro').length;
        const newConVotes = allFreshVotes.filter(v => v.vote === 'con').length;

        const updatedSuggestion = await base44.entities.TopicEditSuggestion.update(suggestionId, {
          proVotes: newProVotes,
          conVotes: newConVotes,
        });

        const delta = updatedSuggestion.proVotes - updatedSuggestion.conVotes;
        const thresholdForAcceptance = Math.max(2, document.threshold || 2);

        if (delta >= thresholdForAcceptance && topicSuggestion) {
          // Optimistic cache update
          queryClient.setQueryData(['topics', document.id], (old) =>
            old?.map(t => t.id === topicSuggestion.topicId ? { ...t, title: topicSuggestion.newTitle } : t)
          );
          queryClient.setQueryData(['topicEditSuggestions', document.id], (old) =>
            old?.map(s => s.id === suggestionId ? { ...s, status: 'accepted' } : s)
          );

          await Promise.all([
            base44.entities.Topic.update(topicSuggestion.topicId, { title: topicSuggestion.newTitle }),
            base44.entities.TopicEditSuggestion.update(suggestionId, { status: 'accepted' }),
          ]);

          // Create version record
          try {
            const allVersions = await base44.entities.DocumentVersion.filter({ documentId: document.id });
            const nextVersion = allVersions.length > 0 ? Math.max(...allVersions.map(v => v.version || 0)) + 1 : 1;
            const topicSections = await base44.entities.Section.filter({ topicId: topicSuggestion.topicId });
            const firstSectionId = topicSections[0]?.id;
            if (firstSectionId) {
              await base44.entities.DocumentVersion.create({
                documentId: document.id,
                sectionId: firstSectionId,
                content: `topic_title_change:${topicSuggestion.topicId}:${topicSuggestion.originalTitle}:${topicSuggestion.newTitle}`,
                changeDescription: `כותרת נושא עודכנה: ${topicSuggestion.originalTitle} → ${topicSuggestion.newTitle}`,
                version: nextVersion,
                changeType: 'suggestion_accepted',
                suggestionId: topicSuggestion.id,
                originalLanguage: 'he',
                translations: {},
              });
            }
          } catch (versionErr) {
            console.error('[TOPIC VOTE] Error creating version record:', versionErr);
          }

          if (document.gamificationEnabled) {
            base44.entities.User.filter({ email: topicSuggestion.created_by }).then(list => {
              const creator = list[0];
              if (!creator) return;
              return Promise.all([
                base44.entities.User.update(creator.id, { points: (creator.points || 1000) + 100 }),
                base44.entities.PointsTransaction.create({
                  userId: creator.id, amount: 100, action: 'suggestion_accepted',
                  description: 'ההצעה שלך לעריכת כותרת נושא התקבלה', relatedEntityType: 'topic',
                }),
              ]);
            }).catch(() => {});
          }

          toast.success('🎉 ההצעה לעריכת כותרת התקבלה!', { description: 'הכותרת עודכנה במסמך', duration: 4000 });

          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['topics', document.id] }),
            queryClient.invalidateQueries({ queryKey: ['topicEditSuggestions', document.id] }),
            queryClient.invalidateQueries({ queryKey: ['topicEditSuggestions'] }),
            queryClient.invalidateQueries({ queryKey: ['document', document.id] }),
            queryClient.invalidateQueries({ queryKey: ['allVersions', document.id] }),
          ]);
        }
      } finally {
        topicVotingInProgressRef.current.delete(suggestionId);
      }
    },
    onSuccess: () => {
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['topicEditSuggestions'] }),
        queryClient.invalidateQueries({ queryKey: ['topicEditVotes'] }),
      ]);
    },
  });

  return mutation;
}