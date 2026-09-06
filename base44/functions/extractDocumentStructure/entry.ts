import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { fileUrl } = await req.json();
    if (!fileUrl || typeof fileUrl !== 'string') {
      return Response.json({ error: 'Missing fileUrl' }, { status: 400 });
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