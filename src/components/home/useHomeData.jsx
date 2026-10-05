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
    queryFn: () => base44.entities.GroupMember.list('-created_date', 500),
    staleTime: 5 * 60 * 1000,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['publicDocuments'],
    queryFn: () => base44.entities.Document.list('-created_date', 50),
    staleTime: 5 * 60 * 1000,
  });

  // ── Aggregate stats from backend (replaces 6 queries fetching up to 12,000 records) ──
  // NOTE: The old ['publicProfiles'] query (UserPublicProfile.list() — up to 1000 records)
  // was removed because its data was never consumed; only the loading flag was used.
  // Contributor data now comes exclusively from homeStats (computed server-side).
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
      const result = await base44.functions.invoke('translateVersion', {
        documentId: doc.id,
        sourceEntityType: 'document',
        sourceEntityId: doc.id,
        sourceField: 'title',
        targetLanguage: language,
        content: doc.title,
        isHtml: false,
      });
      return { docId: doc.id, translatedTitle: (result.data?.translatedContent || doc.title).trim() };
    },
  });

  return {
    user, groups, groupsLoading, groupMembers, membersLoading, documents,
    displayedUsers, publicProfilesLoading: statsLoading,
    totalUniqueContributors, contributorsList,
    averageConsensus, groupParticipantCounts, documentContributorCounts,
    translateDocumentMutation,
    statsLoading,
  };
}