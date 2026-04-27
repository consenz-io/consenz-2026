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
  const [userVotes, userCreatedSuggestions, pendingSuggestions] = await Promise.all([
    serviceBase44.entities.Vote.filter({ userId: user.id }, null, 500),
    serviceBase44.entities.Suggestion.filter({ created_by: user.email }, null, 200),
    serviceBase44.entities.Suggestion.filter({ status: 'pending' }, null, 300),
  ]);

  // Build set of document IDs the user participated in
  const participatedDocIds = new Set();
  userCreatedSuggestions.forEach(s => s.documentId && participatedDocIds.add(s.documentId));

  const votedSuggestionIds = new Set(userVotes.map(v => v.suggestionId));
  pendingSuggestions.forEach(s => {
    if (votedSuggestionIds.has(s.id) && s.documentId) {
      participatedDocIds.add(s.documentId);
    }
  });

  // Count pending suggestions in participated docs that user hasn't voted on and didn't create
  const count = pendingSuggestions.filter(s =>
    s.type !== 'edit_suggestion' &&
    participatedDocIds.has(s.documentId) &&
    s.created_by !== user.email &&
    !votedSuggestionIds.has(s.id)
  ).length;

  return Response.json({ count });
});