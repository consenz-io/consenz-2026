import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Converts the server's { docId: count } maps into Maps of numbers.
const toNumberMap = (obj) =>
  new Map(Object.entries(obj ?? {}).map(([key, value]) => [key, Number(value) || 0]));

export function useMyDocumentsData() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // One request. The server collects the suggestions, votes, sections and
  // comments behind these numbers — none of those records reach the browser.
  const { data, isLoading } = useQuery({
    queryKey: ['myDocumentsData', user?.id],
    queryFn: () => base44.functions.invoke('getMyDocumentsData', {}).then(res => res.data),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  });

  const myDocuments = useMemo(() => data?.documents ?? [], [data]);
  const myVotesCountByDoc = useMemo(() => toNumberMap(data?.myVotes), [data]);
  const mySuggestionsCountByDoc = useMemo(() => toNumberMap(data?.mySuggestions), [data]);
  const contributorsByDoc = useMemo(() => toNumberMap(data?.contributors), [data]);
  const unvotedByDoc = useMemo(() => toNumberMap(data?.unvoted), [data]);

  const getUnvotedCount = useCallback((docId) => unvotedByDoc.get(docId) ?? 0, [unvotedByDoc]);

  return {
    user,
    myDocuments,
    mySuggestionsCountByDoc,
    myVotesCountByDoc,
    contributorsByDoc,
    getUnvotedCount,
    isLoading,
  };
}