import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";

const LANGUAGE_PROMPTS = { en: "English", he: "Hebrew", ar: "Arabic" };

export function useHomeData() {
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Display data — needed directly by UI components (not just for stats)
  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => base44.entities.Group.list('-created_date', 20),
    staleTime: 5 * 60 * 1000,
  });

  const { data: groupMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ['groupMembers'],
    queryFn: () => base44.entities.GroupMember.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['publicDocuments'],
    queryFn: () => base44.entities.Document.list('-created_date', 200),
    staleTime: 5 * 60 * 1000,
  });

  const { data: publicProfiles = [], isLoading: publicProfilesLoading } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    staleTime: 5 * 60 * 1000,
  });

  // ── Aggregate stats from backend (replaces 6 queries fetching up to 12,000 records) ──
  const { data: homeStats, isLoading: statsLoading } = useQuery({
    queryKey: ['homeStats'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getHomeStats', {});
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const displayedUsers = useMemo(() => homeStats?.displayedUsers || [], [homeStats]);
  const totalUniqueContributors = homeStats?.totalUniqueContributors || 1;
  const contributorsList = homeStats?.contributorsList || [];
  const averageConsensus = homeStats?.averageConsensus || 0;
  const groupParticipantCounts = homeStats?.groupParticipantCounts || {};
  const documentContributorCounts = homeStats?.documentContributorCounts || {};

  // ── Mutation: translate document title ────────────────────────────────────
  const translateDocumentMutation = useMutation({
    mutationFn: async (doc) => {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Translate the following text to ${LANGUAGE_PROMPTS[language]}. Return ONLY the translated text:\n${doc.title}`,
        add_context_from_internet: false,
      });
      const translatedTitle = (typeof result === 'string' ? result : result.content || result).trim();
      const newTranslations = { ...(doc.translations || {}), [language]: { title: translatedTitle } };
      await base44.entities.Document.update(doc.id, { translations: newTranslations });
      return { docId: doc.id, translations: newTranslations };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['publicDocuments'], (old) =>
        old?.map(d => d.id === data.docId ? { ...d, translations: data.translations } : d)
      );
    },
  });

  return {
    user, groups, groupsLoading, groupMembers, membersLoading, documents,
    displayedUsers, publicProfilesLoading,
    totalUniqueContributors, contributorsList,
    averageConsensus, groupParticipantCounts, documentContributorCounts,
    translateDocumentMutation,
    statsLoading,
  };
}