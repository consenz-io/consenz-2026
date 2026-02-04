import { useState, useRef, useCallback, useEffect } from 'react';

export function useVoteQueue(voteMutation) {
  const [voteQueue, setVoteQueue] = useState({});
  const [optimisticVotes, setOptimisticVotes] = useState({});
  const processingRef = useRef(false);
  const VOTE_DELAY = 300; // ms between votes to avoid rate limiting

  const addToQueue = useCallback((suggestionId, vote) => {
    // עדכון מיידי בUI - optimistic update
    setOptimisticVotes(prev => ({
      ...prev,
      [suggestionId]: { vote, status: 'queued' }
    }));

    // הוסף או עדכן בתור
    setVoteQueue(prev => ({
      ...prev,
      [suggestionId]: vote
    }));
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    
    const entries = Object.entries(voteQueue);
    if (entries.length === 0) return;

    processingRef.current = true;
    const [suggestionId, vote] = entries[0];

    try {
      // סמן כ-processing
      setOptimisticVotes(prev => ({
        ...prev,
        [suggestionId]: { vote, status: 'processing' }
      }));

      // שדרוג בשרת
      await voteMutation.mutateAsync({
        suggestionId,
        vote,
        currentVote: null // כאן צריך להעביר הצבעה קודמת אם קיימת
      });

      // הסר מהתור
      setVoteQueue(prev => {
        const next = { ...prev };
        delete next[suggestionId];
        return next;
      });

      // סמן כ-done
      setOptimisticVotes(prev => ({
        ...prev,
        [suggestionId]: { vote, status: 'done' }
      }));

      // הסר אחרי 500ms
      setTimeout(() => {
        setOptimisticVotes(prev => {
          const next = { ...prev };
          delete next[suggestionId];
          return next;
        });
      }, 500);
    } catch (err) {
      console.error('[VOTE QUEUE] Error:', err);
      // אם קרתה שגיאה, החזר לתור עם סטטוס error
      setOptimisticVotes(prev => ({
        ...prev,
        [suggestionId]: { vote, status: 'error', error: err.message }
      }));
    } finally {
      processingRef.current = false;
    }
  }, [voteQueue, voteMutation]);

  // עבוד תור עם delay
  useEffect(() => {
    if (Object.keys(voteQueue).length === 0) return;

    const timer = setTimeout(processQueue, VOTE_DELAY);
    return () => clearTimeout(timer);
  }, [voteQueue, processQueue]);

  return {
    addToQueue,
    optimisticVotes,
    queueLength: Object.keys(voteQueue).length,
    isProcessing: processingRef.current
  };
}