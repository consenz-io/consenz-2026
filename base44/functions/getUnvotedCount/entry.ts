import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ count: 0 });
  }

  // Use asServiceRole to avoid per-user rate limits on heavy queries
  const serviceBase44 = base44.asServiceRole;

  // Fetch only the data we need, filtered server-side
  const [userVotes, userCreatedSuggestions, pendingSuggestions, allInteractions] = await Promise.all([
    // Fetch votes by userId — correct server-side filter, no limit issue
    serviceBase44.entities.Vote.filter({ userId: user.id }, null, 1000),
    serviceBase44.entities.Suggestion.filter({ created_by: user.email }, null, 200),
    serviceBase44.entities.Suggestion.filter({ status: 'pending' }, null, 500),
    serviceBase44.entities.UserInteraction.filter({ userId: user.id }, null, 100),
  ]);

  // Votes by current user
  const votedSuggestionIds = new Set(userVotes.map(v => v.suggestionId));

  // Filter out expired suggestions (timerEndsAt in the past)
  const now = new Date();
  const activePendingSuggestions = pendingSuggestions.filter(s =>
    !s.timerEndsAt || new Date(s.timerEndsAt) > now
  );

  // Build set of document IDs the user participated in
  const participatedDocIds = new Set();
  
  // Docs where user created suggestions
  userCreatedSuggestions.forEach(s => s.documentId && participatedDocIds.add(s.documentId));
  
  // Docs where user interacted
  allInteractions.forEach(ui => ui.documentId && participatedDocIds.add(ui.documentId));
  
  // Docs where user voted on suggestions (check all pending, not just active)
  pendingSuggestions.forEach(s => {
    if (votedSuggestionIds.has(s.id) && s.documentId) {
      participatedDocIds.add(s.documentId);
    }
  });

  // Count only active (non-expired) pending suggestions in participated docs that user hasn't voted on and didn't create
  const count = activePendingSuggestions.filter(s =>
    s.type !== 'edit_suggestion' &&
    participatedDocIds.has(s.documentId) &&
    s.created_by !== user.email &&
    !votedSuggestionIds.has(s.id)
  ).length;

  return Response.json({ count });
});