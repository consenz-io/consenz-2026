import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";
import { calcAllGroupParticipants } from "@/lib/groupParticipants";

const LANGUAGE_PROMPTS = { en: "English", he: "Hebrew", ar: "Arabic" };

export function useHomeData() {
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

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

  const { data: acceptedSuggestions = [] } = useQuery({
    queryKey: ['acceptedSuggestions'],
    queryFn: () => base44.entities.Suggestion.filter({ status: 'accepted' }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allSuggestions = [] } = useQuery({
    queryKey: ['allSuggestions_home'],
    queryFn: () => base44.entities.Suggestion.list('-created_date', 2000),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allVotes = [] } = useQuery({
    queryKey: ['allVotes_home'],
    queryFn: () => base44.entities.Vote.list('-created_date', 2000),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list('-created_date'),
    initialData: [],
    retry: false,
    throwOnError: false,
    staleTime: 5 * 60 * 1000,
    enabled: !!user && user?.role === 'admin',
  });

  const { data: publicProfiles = [], isLoading: publicProfilesLoading } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allComments = [] } = useQuery({
    queryKey: ['allComments_home'],
    queryFn: () => base44.entities.Comment.list('-created_date', 2000),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allSections = [] } = useQuery({
    queryKey: ['allSections_home'],
    queryFn: () => base44.entities.Section.list(null, 2000),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allAgreements = [] } = useQuery({
    queryKey: ['allAgreements'],
    queryFn: () => base44.entities.DocumentAgreement.list(),
    staleTime: 5 * 60 * 1000,
  });

  // ── Derived: displayed users list ──────────────────────────────────────────
  const displayedUsers = useMemo(() => {
    if (user?.role === 'admin' && allUsers.length > 0) return allUsers;
    const seen = new Set();
    return publicProfiles.filter(p => {
      if (!p?.userId || seen.has(p.userId)) return false;
      seen.add(p.userId);
      return true;
    });
  }, [user, allUsers, publicProfiles]);

  // ── Derived: contributors list for modal ───────────────────────────────────
  const { totalUniqueContributors, contributorsList } = useMemo(() => {
    const uniqueEmails = new Set();
    const userIdToEmail = {};
    publicProfiles.forEach(p => { userIdToEmail[p.userId] = p.email; });
    allUsers.forEach(u => { userIdToEmail[u.id] = u.email; });

    allVotes.forEach(v => {
      if (userIdToEmail[v.userId]) uniqueEmails.add(userIdToEmail[v.userId]);
      if (v.created_by) uniqueEmails.add(v.created_by);
    });
    allComments.forEach(c => { if (c.created_by) uniqueEmails.add(c.created_by); });
    allAgreements.forEach(a => { if (a.userEmail) uniqueEmails.add(a.userEmail); });

    const emailToProfile = {};
    publicProfiles.forEach(p => { emailToProfile[p.email] = p; });
    const emailToUser = {};
    allUsers.forEach(u => { emailToUser[u.email] = u; });

    const list = Array.from(uniqueEmails)
      .map(email => {
        const profile = emailToProfile[email];
        const u = emailToUser[email];
        return {
          email,
          name: profile?.fullName || u?.full_name || email.split('@')[0] || 'User',
          id: profile?.userId || u?.id
        };
      })
      .filter(c => c.name && c.name !== 'User')
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return { totalUniqueContributors: Math.max(1, uniqueEmails.size), contributorsList: list };
  }, [allVotes, allUsers, publicProfiles, allComments, allAgreements]);

  // ── Derived: average consensus ─────────────────────────────────────────────
  const averageConsensus = useMemo(() => {
    if (!acceptedSuggestions.length) return 0;
    const scores = acceptedSuggestions
      .filter(s => typeof s.proVotes === 'number' && typeof s.conVotes === 'number')
      .map(s => { const t = s.proVotes + s.conVotes; return t > 0 ? s.proVotes / t : 0; });
    if (!scores.length) return 0;
    return (scores.reduce((a, s) => a + s, 0) / scores.length * 100).toFixed(0);
  }, [acceptedSuggestions]);

  // ── Derived: per-group participant counts (single pass over all arrays) ────
  const groupParticipantCounts = useMemo(() => {
    const countsMap = calcAllGroupParticipants(
      groups, groupMembers, documents, allSuggestions, allVotes, allComments, publicProfiles, allAgreements, allSections
    );
    const counts = {};
    countsMap.forEach((count, gid) => { counts[gid] = count; });
    return counts;
  }, [groups, groupMembers, documents, allSuggestions, allVotes, allComments, publicProfiles, allAgreements, allSections]);

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
    averageConsensus, groupParticipantCounts,
    translateDocumentMutation,
  };
}