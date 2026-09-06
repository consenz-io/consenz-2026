import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Returns the count of unread messages for the current user.
 * Replaces a client-side fetch of up to 50 full Message records (just to
 * count them) with a single round-trip returning one number — lighter on
 * bandwidth and immune to per-user rate limits (uses asServiceRole).
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ count: 0 });

    // Cap at 200 — the badge only needs a lower bound (displays "9+" above 9).
    const unread = await base44.asServiceRole.entities.Message.filter(
      { recipientId: user.id, read: false },
      '-created_date',
      200
    );
    return Response.json({ count: unread.length });
  } catch (error) {
    return Response.json({ count: 0, error: error.message }, { status: 500 });
  }
}