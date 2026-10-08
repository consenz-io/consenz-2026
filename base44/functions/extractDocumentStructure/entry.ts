import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Per-user rate limit: document-structure extraction is an expensive LLM call.
// Cap at 5 extractions per 10 minutes per user to prevent credit abuse.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const rateLimiter = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const key = `extract-${userId}`;
  const record = rateLimiter.get(key);
  if (!record || now >= record.resetAt) {
    rateLimiter.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true };
  }
  record.count++;
  if (record.count > RATE_LIMIT) {
    const remainingMs = record.resetAt - now;
    return { allowed: false, remainingMs };
  }
  return { allowed: true };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimiter.entries()) {
    if (now >= record.resetAt) rateLimiter.delete(key);
  }
}, 5 * 60 * 1000);

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { fileUrl } = await req.json();
    if (!fileUrl || typeof fileUrl !== 'string') {
      return Response.json({ error: 'Missing fileUrl' }, { status: 400 });
    }

    // Only allow files uploaded to this app's own storage. The client uploads
    // via UploadPublicFile first, so the URL is always on a Base44 storage host.
    // Rejecting arbitrary external URLs prevents feeding untrusted content to
    // the LLM and consuming credits on someone else's behalf.
    let parsedUrl;
    try {
      parsedUrl = new URL(fileUrl);
    } catch {
      return Response.json({ error: 'Invalid fileUrl' }, { status: 400 });
    }
    if (!parsedUrl.hostname.endsWith('base44.com')) {
      return Response.json({ error: 'fileUrl must point to app storage' }, { status: 400 });
    }

    // Per-user rate limit
    const rl = checkRateLimit(user.id);
    if (!rl.allowed) {
      const mins = Math.ceil(rl.remainingMs / 60000);
      return Response.json({ error: `Rate limit exceeded. Try again in ${mins} minute(s).` }, { status: 429 });
    }

    const prompt = `Extract document structure into topics and sections.

RULES:
1. Find all headings/chapters - each becomes a TOPIC
2. Split content into SHORT sections - each paragraph = 1 section
3. Keep sections under 200 words each
4. Preserve original text exactly
5. Use exact heading text for topic titles

Return JSON with title, topics array (each with title and sections array with content).`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [fileUrl],
      response_json_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          topics: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                sections: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      content: { type: "string" }
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return Response.json(result || { title: '', topics: [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}