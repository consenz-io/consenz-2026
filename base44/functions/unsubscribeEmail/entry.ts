import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { verifyUnsubscribeToken } from '../../shared/emailUnsubscribeToken.ts';

// Public endpoint: the email opt-out link is followed from a mail client, where
// the recipient is usually not signed in. The signed token proves which account
// the link belongs to, so no session is needed.
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  const parsed = await verifyUnsubscribeToken(body?.token);
  if (!parsed) {
    return Response.json({ error: 'Invalid link' }, { status: 400 });
  }

  const base44 = createClientFromRequest(req);

  try {
    await base44.asServiceRole.entities.User.update(parsed.userId, {
      emailOptIn: false,
      emailOptInAt: null,
    });
  } catch (err) {
    console.error('unsubscribeEmail: failed to update preferences:', err?.message);
    return Response.json({ error: 'Could not update preferences' }, { status: 500 });
  }

  return Response.json({ success: true });
});