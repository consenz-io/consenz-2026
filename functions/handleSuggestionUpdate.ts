import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// This automation handles suggestion status changes.
// 
// IMPORTANT - Notification responsibility per status:
// - 'accepted': Notifications are sent by processAcceptance (backend function). NOT handled here.
// - 'rejected' by admin: Notifications are sent directly by the frontend (SuggestionSidebar / suggestiondetail)
//                        via notifySuggestionStatusChange. NOT handled here.
// - 'rejected' by expiry: Notifications are sent by expireSuggestions (backend function). NOT handled here.
//
// This automation is kept active for future use (e.g., logging, analytics),
// but does NOT send any notifications to avoid duplicates.

Deno.serve(async (req) => {
  try {
    const { event, data: suggestion, old_data: oldSuggestion } = await req.json();

    if (!suggestion || event.type !== 'update') {
      return Response.json({ message: 'Not an update event' }, { status: 200 });
    }

    const statusChanged = oldSuggestion?.status !== suggestion.status;
    if (!statusChanged) {
      return Response.json({ message: 'Status not changed' }, { status: 200 });
    }

    console.log('[AUTOMATION] Suggestion status changed:', suggestion.id, oldSuggestion.status, '->', suggestion.status);
    console.log('[AUTOMATION] rejectedByAdmin:', suggestion.rejectedByAdmin, '| Notifications handled by frontend/expireSuggestions. No action needed.');

    return Response.json({ message: 'Status change logged. Notifications handled elsewhere.' });
  } catch (error) {
    console.error('[AUTOMATION ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});