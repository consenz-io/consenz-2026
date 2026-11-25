import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { waitUntil } from 'base44:runtime';
import { buildTranslationsWithMessage } from '../../shared/notificationTranslations.ts';

// Recipient-facing copy for the "you have a new message" email, per language.
const MESSAGE_EMAIL_COPY = {
  he: {
    subject: 'הודעה חדשה מ{name}',
    greeting: 'שלום',
    preheader: '{name} שלח/ה לך הודעה חדשה ב-Consenz',
    intro: '{name} שלח/ה לך הודעה חדשה במערכת המסרים של Consenz:',
    ctaLabel: 'לצפייה בהודעה',
    footer: 'קיבלת מייל זה כי יש לך חשבון ב-Consenz. אפשר להשיב להודעה מתוך המערכת.',
  },
  en: {
    subject: 'New message from {name}',
    greeting: 'Hello',
    preheader: '{name} sent you a new message on Consenz',
    intro: '{name} sent you a new message in the Consenz messaging system:',
    ctaLabel: 'View message',
    footer: 'You are receiving this email because you have a Consenz account. You can reply from inside the app.',
  },
  ar: {
    subject: 'رسالة جديدة من {name}',
    greeting: 'مرحباً',
    preheader: '{name} أرسل لك رسالة جديدة على Consenz',
    intro: '{name} أرسل لك رسالة جديدة في نظام الرسائل في Consenz:',
    ctaLabel: 'عرض الرسالة',
    footer: 'تلقيت هذا البريد لأن لديك حساباً في Consenz. يمكنك الرد من داخل التطبيق.',
  },
};

// One email per conversation every 10 minutes — an active chat must not send
// an email for every single message.
const MESSAGE_EMAIL_THROTTLE_MS = 10 * 60 * 1000;
const lastMessageEmailAt = new Map();

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Per-user rate limiter — prevents spam via the messaging system.
// 20 messages per minute per user.
const messageRateLimiter = new Map();
const MESSAGE_RATE_LIMIT = 20;
const MESSAGE_WINDOW_MS = 60000;

function checkMessageRateLimit(userId) {
  const now = Date.now();
  const userKey = `msg-${userId}`;
  if (!messageRateLimiter.has(userKey)) {
    messageRateLimiter.set(userKey, { count: 1, resetAt: now + MESSAGE_WINDOW_MS });
    return { allowed: true };
  }
  const record = messageRateLimiter.get(userKey);
  if (now >= record.resetAt) {
    record.count = 1;
    record.resetAt = now + MESSAGE_WINDOW_MS;
    messageRateLimiter.set(userKey, record);
    return { allowed: true };
  }
  record.count++;
  messageRateLimiter.set(userKey, record);
  if (record.count > MESSAGE_RATE_LIMIT) {
    return { allowed: false, remainingSeconds: Math.ceil((record.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of messageRateLimiter.entries()) {
    if (now >= record.resetAt) messageRateLimiter.delete(key);
  }
}, 5 * 60 * 1000);

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const rateLimitCheck = checkMessageRateLimit(user.id);
    if (!rateLimitCheck.allowed) {
      return Response.json(
        { error: 'Rate limit exceeded', remainingSeconds: rateLimitCheck.remainingSeconds },
        { status: 429 }
      );
    }

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
        title: `הודעה חדשה מ${senderName}`, // Default language is Hebrew
        message: preview,
        translations: buildTranslationsWithMessage('directMessageTitle', preview, { name: senderName }),
        relatedEntityId: conversation.id,
        relatedEntityType: 'conversation',
        actionUrl: '/Messages?conversation=' + conversation.id
      });
    } catch (e) {
      // Non-critical — message was still sent
    }

    // Email the recipient about the message (non-critical, sent after the response)
    try {
      const lastSent = lastMessageEmailAt.get(conversation.id) || 0;
      if (Date.now() - lastSent > MESSAGE_EMAIL_THROTTLE_MS) {
        const recipients = await base44.asServiceRole.entities.User.filter({ id: recipientId });
        const recipient = recipients[0];
        if (recipient?.email) {
          lastMessageEmailAt.set(conversation.id, Date.now());
          const senderName = user.full_name || 'User';
          const copy = MESSAGE_EMAIL_COPY[recipient.preferredLanguage] || MESSAGE_EMAIL_COPY.he;
          waitUntil(
            base44.asServiceRole.integrations.Core.SendEmail({
              to: recipient.email,
              template_name: 'DirectMessage',
              subject: copy.subject.replace('{name}', senderName),
              category: 'transactional',
              variables: {
                greeting: copy.greeting,
                recipient_name: escapeHtml(recipient.full_name || recipient.email),
                preheader: copy.preheader.replace('{name}', escapeHtml(senderName)),
                intro: copy.intro.replace('{name}', escapeHtml(senderName)),
                sender_name: escapeHtml(senderName),
                message_preview: escapeHtml(preview),
                cta_label: copy.ctaLabel,
                cta_url: `https://consenz.net/Messages?conversation=${conversation.id}`,
                footer_note: copy.footer,
              },
            }).catch(() => {})
          );
        }
      }
    } catch (e) {
      // Non-critical — the message was still delivered in the app
    }

    return Response.json({ conversation, message });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}