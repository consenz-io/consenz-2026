import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Public endpoint — no user auth required (called by email client or redirect)
// Responds immediately then updates DB in background to minimize latency
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const logId = url.searchParams.get('logId');
  const type = url.searchParams.get('type');
  const redirectUrl = url.searchParams.get('redirectUrl');

  if (!logId || !['open', 'click'].includes(type)) {
    return Response.json({ error: 'Invalid params' }, { status: 400 });
  }

  // For click events — redirect immediately, track in background
  if (type === 'click' && redirectUrl) {
    // Fire-and-forget tracking
    const base44 = createClientFromRequest(req);
    EdgeRuntime?.waitUntil?.(trackIncrement(base44, logId, 'clickCount').catch(() => {}));
    
    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl },
    });
  }

  // For open pixel — return GIF immediately, track in background
  const pixel = new Uint8Array([
    0x47,0x49,0x46,0x38,0x39,0x61,0x01,0x00,0x01,0x00,0x80,0x00,0x00,
    0xff,0xff,0xff,0x00,0x00,0x00,0x21,0xf9,0x04,0x00,0x00,0x00,0x00,
    0x00,0x2c,0x00,0x00,0x00,0x00,0x01,0x00,0x01,0x00,0x00,0x02,0x02,
    0x44,0x01,0x00,0x3b,
  ]);

  if (type === 'open') {
    const base44 = createClientFromRequest(req);
    EdgeRuntime?.waitUntil?.(trackIncrement(base44, logId, 'openCount').catch(() => {}));
  }

  return new Response(pixel, {
    status: 200,
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
  });
});

// Read-then-increment — kept simple; race window is acceptable for analytics counters
async function trackIncrement(base44, logId, field) {
  const logs = await base44.asServiceRole.entities.EmailLog.filter({ id: logId });
  if (logs.length === 0) return;
  const current = logs[0][field] || 0;
  await base44.asServiceRole.entities.EmailLog.update(logId, { [field]: current + 1 });
}