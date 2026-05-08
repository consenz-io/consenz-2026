import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Public endpoint — no user auth required (called by email client or redirect)
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const url = new URL(req.url);
  const logId = url.searchParams.get('logId');
  const type = url.searchParams.get('type');
  const redirectUrl = url.searchParams.get('redirectUrl');

  if (!logId || !['open', 'click'].includes(type)) {
    return Response.json({ error: 'Invalid params' }, { status: 400 });
  }

  try {
    const logs = await base44.asServiceRole.entities.EmailLog.filter({ id: logId });
    if (logs.length > 0) {
      const log = logs[0];
      const update = type === 'open'
        ? { openCount: (log.openCount || 0) + 1 }
        : { clickCount: (log.clickCount || 0) + 1 };
      await base44.asServiceRole.entities.EmailLog.update(logId, update);
    }
  } catch (err) {
    console.error('trackEmailEvent error:', err.message);
  }

  // For click events — redirect to the target URL
  if (type === 'click' && redirectUrl) {
    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl },
    });
  }

  // For open pixel — return 1x1 transparent GIF
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