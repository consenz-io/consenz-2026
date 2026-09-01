import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Public endpoint — no user auth required (called by email client or redirect)
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const logId = url.searchParams.get('logId');
  const type = url.searchParams.get('type');
  const redirectUrl = url.searchParams.get('redirectUrl');

  if (!logId || !['open', 'click'].includes(type)) {
    return Response.json({ error: 'Invalid params' }, { status: 400 });
  }

  // Atomic increment — avoids race condition when multiple opens/clicks arrive concurrently
  const track = async (field) => {
    try {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.EmailLog.updateMany(
        { id: logId },
        { $inc: { [field]: 1 } }
      );
    } catch (_) {
      // analytics failure must never affect the response
    }
  };

  // For click events — track FIRST (await), then redirect
  if (type === 'click') {
    await track('clickCount');
    if (redirectUrl) {
      // Strict same-origin validation using the URL parser — prevents open redirect
      // via backslash/control-char evasions that bypass naive startsWith('/') checks.
      const requestOrigin = new URL(req.url).origin;
      let parsedUrl;
      try {
        parsedUrl = new URL(redirectUrl, requestOrigin);
      } catch {
        return new Response('Invalid redirect URL', { status: 400 });
      }
      if (parsedUrl.origin !== requestOrigin) {
        return new Response('Invalid redirect URL', { status: 400 });
      }
      const safePath = parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
      return new Response(null, {
        status: 302,
        headers: { Location: safePath },
      });
    }
    return new Response('Tracked', { status: 200 });
  }

  // For open pixel — track first, then return pixel
  if (type === 'open') {
    await track('openCount');
  }

  const pixel = new Uint8Array([
    0x47,0x49,0x46,0x38,0x39,0x61,0x01,0x00,0x01,0x00,0x80,0x00,0x00,
    0xff,0xff,0xff,0x00,0x00,0x00,0x21,0xf9,0x04,0x00,0x00,0x00,0x00,
    0x00,0x2c,0x00,0x00,0x00,0x00,0x01,0x00,0x01,0x00,0x00,0x02,0x02,
    0x44,0x01,0x00,0x3b,
  ]);

  return new Response(pixel, {
    status: 200,
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
  });
});