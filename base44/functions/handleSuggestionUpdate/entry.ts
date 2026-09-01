import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { INTERNAL_AUTOMATION_TOKEN } from "../../shared/internalToken.ts";

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
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data: suggestion, old_data: oldSuggestion, args = {} } = body;
    // Auth: allow the internal automation (token via function_args) or an admin.
    // External anonymous callers are rejected with 401.
    const user = await base44.auth.me().catch(() => null);
    const isInternalAutomation = args.internalToken === INTERNAL_AUTOMATION_TOKEN;
    if (!isInternalAutomation && user?.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

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