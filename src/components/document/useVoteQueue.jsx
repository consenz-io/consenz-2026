import { useState, useRef, useCallback, useEffect } from 'react';

export function useVoteQueue(voteMutation) {
  const [voteQueue, setVoteQueue] = useState({});
  const processingRef = useRef(false);
  const VOTE_DELAY = 300;

  const addToQueue = useCallback((suggestionId, vote) => {
    setVoteQueue(prev => ({ ...prev, [suggestionId]: vote }));
  }, []);

  useEffect(() => {
    if (processingRef.current || Object.keys(voteQueue).length === 0) return;

    const timer = setTimeout(() => {
      processingRef.current = true;
      const entries = Object.entries(voteQueue);
      const [suggestionId, vote] = entries[0];

      voteMutation.mutate(
        { suggestionId, vote, currentVote: null },
        {
          onSuccess: () => {
            setVoteQueue(prev => {
              const next = { ...prev };
              delete next[suggestionId];
              return next;
            });
            processingRef.current = false;
          },
          onError: () => {
            processingRef.current = false;
          }
        }
      );
    }, VOTE_DELAY);

    return () => clearTimeout(timer);
  }, [voteQueue, voteMutation]);

  return { addToQueue, queueLength: Object.keys(voteQueue).length };
}