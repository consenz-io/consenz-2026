import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { recipientId, content } = body;

    if (!recipientId || !content || !content.trim()) {
      return Response.json({ error: 'Missing recipientId or content' }, { status: 400 });
    }

    if (recipientId === user.id) {
      return Response.json({ error: 'Cannot message yourself' }, { status: 400 });
    }

    const trimmedContent = content.trim();

    // Sorted conversation key for deduplication
    const ids = [user.id, recipientId].sort();
    const conversationKey = ids.join('|');

    // Find existing conversation
    const existing = await base44.entities.Conversation.filter({ conversationKey });

    let conversation;
    const now = new Date().toISOString();
    const preview = trimmedContent.slice(0, 100);

    if (existing.length > 0) {
      conversation = existing[0];
      conversation = await base44.entities.Conversation.update(conversation.id, {
        lastMessageAt: now,
        lastMessagePreview: preview,
        lastMessageSenderId: user.id
      });
    } else {
      conversation = await base44.entities.Conversation.create({
        participants: [user.id, recipientId],
        conversationKey,
        lastMessageAt: now,
        lastMessagePreview: preview,
        lastMessageSenderId: user.id
      });
    }

    // Create the message
    const message = await base44.entities.Message.create({
      conversationId: conversation.id,
      senderId: user.id,
      recipientId,
      content: trimmedContent
    });

    // Create notification for recipient (service role ensures it's created)
    try {
      const senderName = user.full_name || 'User';
      await base44.asServiceRole.entities.Notification.create({
        userId: recipientId,
        type: 'direct_message',
        title: `New message from ${senderName}`,
        message: preview,
        relatedEntityId: conversation.id,
        relatedEntityType: 'conversation',
        actionUrl: '/Messages?conversation=' + conversation.id
      });
    } catch (e) {
      // Non-critical — message was still sent
    }

    return Response.json({ conversation, message });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}