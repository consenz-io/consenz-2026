import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { checkDocumentAccess } from '../../shared/documentAuth.ts';
import { buildTranslations, t } from '../../shared/notificationTranslations.ts';

/**
 * Finds existing open proposals / sections in the same document that already
 * cover the change a user is about to publish.
 *
 * Candidates are pre-filtered on the server in a fixed priority order, and a
 * single LLM call decides which of them are substantively the same change.
 * Only strong matches from the earliest priority stage that produced one are
 * returned (max 3), so later stages never fill the list.
 */

const MAX_CANDIDATES = 18;
const MAX_RESULTS = 3;
const MAX_SNIPPET = 700;
const MAX_PROPOSAL_TEXT = 1600;
const SNIPPET_IN_RESULT = 220;
const LANGUAGES = ['en', 'he', 'ar'];

function toPlainText(html: string): string {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text: string, max: number): string {
  const value = String(text || '');
  return value.length > max ? value.slice(0, max) + '…' : value;
}

async function notifyDocumentAdmins(base44, document, detail: string) {
  try {
    const admins = await base44.asServiceRole.entities.DocumentAdmin
      .filter({ documentId: document.id })
      .catch(() => []);

    const ids = new Set<string>();
    if (document.created_by_id) ids.add(document.created_by_id);
    admins.forEach((a) => { if (a.userId) ids.add(a.userId); });
    if (ids.size === 0) return;

    const users = await base44.asServiceRole.entities.User
      .filter({ id: { $in: [...ids] } })
      .catch(() => []);
    if (users.length === 0) return;

    const replacements = { doc: document.title || '', detail };
    const translations = buildTranslations('similarCheckFailedTitle', 'similarCheckFailedMessage', replacements);

    const notifications = users.map((u) => {
      const lang = LANGUAGES.includes(u.preferredLanguage) ? u.preferredLanguage : 'he';
      return {
        userId: u.id,
        type: 'similarity_check_failed',
        title: t(lang, 'similarCheckFailedTitle', replacements),
        message: t(lang, 'similarCheckFailedMessage', replacements),
        translations,
        relatedEntityId: document.id,
        relatedEntityType: 'document',
        actionUrl: `/DocumentView?id=${document.id}`,
        read: false,
      };
    });

    await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
  } catch (error) {
    console.error('[FIND SIMILAR] admin notification failed:', error.message);
  }
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const documentId = String(body.documentId || '');
    const sectionId = body.sectionId ? String(body.sectionId) : null;
    const topicId = body.topicId ? String(body.topicId) : null;
    const type = body.type === 'new_section' ? 'new_section' : 'edit_section';
    const language = LANGUAGES.includes(body.language) ? body.language : 'he';
    const proposalText = toPlainText(body.newContent);
    const explanation = toPlainText(body.explanation);

    if (!documentId || !proposalText) {
      return Response.json({ error: 'documentId and newContent are required' }, { status: 400 });
    }

    const document = await base44.asServiceRole.entities.Document
      .filter({ id: documentId })
      .then((r) => r[0])
      .catch(() => null);
    if (!document) {
      return Response.json({ error: 'Document not found' }, { status: 404 });
    }

    const { authorized } = await checkDocumentAccess(base44, document, user);
    if (!authorized) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // The target section distinguishes "change this section" proposals and is
    // excluded from the candidates (comparing a section with itself is noise).
    let targetSection = null;
    if (type === 'edit_section') {
      if (!sectionId) {
        return Response.json({ error: 'sectionId is required' }, { status: 400 });
      }
      targetSection = await base44.asServiceRole.entities.Section
        .filter({ id: sectionId, documentId })
        .then((r) => r[0])
        .catch(() => null);
      if (!targetSection) {
        return Response.json({ error: 'Section not found' }, { status: 404 });
      }
    }

    const targetTopicId = type === 'edit_section' ? (targetSection?.topicId || null) : topicId;

    const [pendingSuggestions, allSections, topics] = await Promise.all([
      base44.asServiceRole.entities.Suggestion.filter({ documentId, status: 'pending' }).catch(() => []),
      base44.asServiceRole.entities.Section.filter({ documentId }).catch(() => []),
      base44.asServiceRole.entities.Topic.filter({ documentId }).catch(() => []),
    ]);

    const topicTitleById = new Map(topics.map((tp) => [tp.id, tp.title || '']));
    const candidates = [];
    const usedKeys = new Set<string>();

    const push = (tier, item) => {
      if (candidates.length >= MAX_CANDIDATES) return;
      if (!item.text || item.text.length < 15) return;
      if (usedKeys.has(item.key)) return;
      usedKeys.add(item.key);
      candidates.push({ ...item, tier });
    };

    const suggestionCandidate = (s) => ({
      key: `suggestion:${s.id}`,
      kind: 'suggestion',
      id: s.id,
      sectionId: s.sectionId || null,
      topicId: s.topicId || null,
      suggestionType: s.type,
      title: s.title || '',
      topicTitle: topicTitleById.get(s.topicId) || '',
      text: toPlainText(s.newContent || s.originalContent || ''),
      createdById: s.created_by_id || null,
      createdDate: s.created_date || null,
      proVotes: s.proVotes || 0,
      conVotes: s.conVotes || 0,
    });

    const sectionCandidate = (sec) => ({
      key: `section:${sec.id}`,
      kind: 'section',
      id: sec.id,
      sectionId: sec.id,
      topicId: sec.topicId || null,
      suggestionType: null,
      title: topicTitleById.get(sec.topicId) || '',
      topicTitle: topicTitleById.get(sec.topicId) || '',
      text: toPlainText(sec.content || ''),
      createdById: sec.created_by_id || null,
      createdDate: sec.created_date || null,
      proVotes: 0,
      conVotes: 0,
    });

    const inTargetTopic = (id) => !!targetTopicId && id === targetTopicId;
    const isTargetSection = (sec) => !!targetSection && sec.id === targetSection.id;

    // Stage 1 — open proposals to change the very same section.
    if (targetSection) {
      pendingSuggestions
        .filter((s) => s.type === 'edit_section' && s.sectionId === targetSection.id)
        .forEach((s) => push(0, suggestionCandidate(s)));
    }

    // Stage 2 — any other open proposal in the same topic.
    pendingSuggestions
      .filter((s) => inTargetTopic(s.topicId))
      .forEach((s) => push(1, suggestionCandidate(s)));

    // Stage 3 — existing sections in the same topic.
    allSections
      .filter((sec) => inTargetTopic(sec.topicId) && !isTargetSection(sec))
      .forEach((sec) => push(2, sectionCandidate(sec)));

    // Stage 4 — remaining open proposals in the document.
    pendingSuggestions.forEach((s) => push(3, suggestionCandidate(s)));

    // Stage 5 — remaining existing sections in the document.
    allSections
      .filter((sec) => !isTargetSection(sec))
      .forEach((sec) => push(4, sectionCandidate(sec)));

    if (candidates.length === 0) {
      return Response.json({ success: true, checkFailed: false, matches: [] });
    }

    const candidateBlock = candidates
      .map((c, index) => {
        const kindLabel = c.kind === 'section'
          ? 'existing section'
          : `open proposal (${c.suggestionType})`;
        const titleLine = c.kind === 'section'
          ? `topic: ${c.topicTitle || '-'}`
          : `topic: ${c.topicTitle || '-'} | title: ${c.title || '-'}`;
        return `[${index + 1}] id="${c.key}" | ${kindLabel} | ${titleLine}\n${truncate(c.text, MAX_SNIPPET)}`;
      })
      .join('\n\n');

    const prompt = `You are the duplicate-proposal detector of a collaborative document platform. A user is about to publish a new proposal. Decide which listed items already address the SAME substantive change or the same practical outcome, so the user can vote on an existing discussion instead of opening a duplicate.

USER PROPOSAL
Type: ${type === 'new_section' ? 'proposal for a new section' : 'proposal to change a section'}
${explanation ? `Explanation: ${truncate(explanation, 800)}` : ''}
Proposed text: ${truncate(proposalText, MAX_PROPOSAL_TEXT)}

CANDIDATES
${candidateBlock}

RULES
1. Compare meaning and practical outcome, never superficial wording. Candidates may be written in another language or phrased differently — translate mentally before comparing.
2. "strong" = adopting that item would achieve essentially the same result as the user's proposal, or it clearly debates this exact change. "weak" = same broad subject, a general overlap, or unrelated. Never upgrade a weak overlap to strong.
3. Use only ids from the candidate list. Never invent or modify an id.
4. Return at most 3 strong matches. If none qualify, return an empty list.
5. Each explanation must be one short sentence (max 25 words) in language code "${language}", stating the concrete overlap. Do not say that items are "similar" in general terms.
6. A candidate counts as strong only if someone who supports the user's proposal would meaningfully support it too.`;

    let rawMatches = [];
    try {
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            matches: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  explanation: { type: 'string' },
                  match: { type: 'string', enum: ['strong', 'weak'] },
                },
                required: ['id', 'explanation', 'match'],
              },
            },
          },
          required: ['matches'],
        },
      });
      rawMatches = Array.isArray(result?.matches) ? result.matches : [];
    } catch (error) {
      console.error('[FIND SIMILAR] LLM call failed:', error.message);
      await notifyDocumentAdmins(base44, document, truncate(error.message || 'unknown error', 200));
      return Response.json({ success: true, checkFailed: true, matches: [] });
    }

    const byKey = new Map(candidates.map((c) => [c.key, c]));
    const strong = [];
    const seenKeys = new Set<string>();

    for (const item of rawMatches) {
      const key = String(item?.id || '');
      const candidate = byKey.get(key);
      if (!candidate || seenKeys.has(key)) continue;
      if (item.match !== 'strong') continue;
      seenKeys.add(key);
      strong.push({ ...candidate, explanation: String(item.explanation || '').trim() });
    }

    if (strong.length === 0) {
      return Response.json({ success: true, checkFailed: false, matches: [] });
    }

    // Only the earliest priority stage that produced a strong match is shown.
    const earliestTier = Math.min(...strong.map((s) => s.tier));
    const selected = strong.filter((s) => s.tier === earliestTier).slice(0, MAX_RESULTS);

    // Author name, age and current vote counts give each match enough context to
    // act on without opening it first.
    const authorIds = [...new Set(selected.map((s) => s.createdById).filter(Boolean))];
    const sectionIds = selected.filter((s) => s.kind === 'section').map((s) => s.id);

    const [profiles, sectionVotes] = await Promise.all([
      authorIds.length
        ? base44.asServiceRole.entities.UserPublicProfile
            .filter({ userId: { $in: authorIds } })
            .catch(() => [])
        : Promise.resolve([]),
      sectionIds.length
        ? base44.asServiceRole.entities.SectionVote
            .filter({ sectionId: { $in: sectionIds } })
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    const nameById = new Map<string, string>();
    for (const profile of profiles) {
      if (profile?.userId && !nameById.has(profile.userId) && profile.fullName) {
        nameById.set(profile.userId, profile.fullName);
      }
    }

    const sectionVotesById = new Map<string, { pro: number; con: number }>();
    for (const vote of sectionVotes) {
      const current = sectionVotesById.get(vote.sectionId) || { pro: 0, con: 0 };
      if (vote.vote === 'pro') current.pro += 1;
      else if (vote.vote === 'con') current.con += 1;
      sectionVotesById.set(vote.sectionId, current);
    }

    const matches = selected.map((s) => {
      const sectionCounts = s.kind === 'section' ? sectionVotesById.get(s.id) : null;
      return {
        key: s.key,
        kind: s.kind,
        id: s.id,
        sectionId: s.sectionId,
        topicId: s.topicId,
        suggestionType: s.suggestionType,
        title: s.title,
        topicTitle: s.topicTitle,
        snippet: truncate(s.text, SNIPPET_IN_RESULT),
        explanation: s.explanation,
        authorName: s.createdById ? nameById.get(s.createdById) || null : null,
        createdDate: s.createdDate || null,
        proVotes: sectionCounts ? sectionCounts.pro : s.proVotes || 0,
        conVotes: sectionCounts ? sectionCounts.con : s.conVotes || 0,
      };
    });

    return Response.json({ success: true, checkFailed: false, matches });
  } catch (error) {
    console.error('[FIND SIMILAR] unexpected error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}