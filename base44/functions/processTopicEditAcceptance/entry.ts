import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { INTERNAL_AUTOMATION_TOKEN } from '../../shared/authGate.ts';

// Server-side acceptance of a topic-title edit suggestion.
// The same transition used to run in the browser (checkTopicEditConsensus +
// autoAcceptTopicEditSuggestion, and again inline in useTopicVoteMutation):
// it trusted the suggestion's own proVotes/conVotes fields, which the creator
// is allowed to update, so a creator could inflate the counters and accept
// their own proposal. Here the vote delta is recounted from the TopicEditVote
// records and the status change is a CAS on `status: 'pending'`, so only one
// caller can ever perform the acceptance and its side effects.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { suggestionId } = body;

    const isInternal = !!body.internalToken && body.internalToken === INTERNAL_AUTOMATION_TOKEN;
    const user = isInternal
      ? null
      : await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!isInternal && !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!suggestionId) return Response.json({ error: 'suggestionId is required' }, { status: 400 });

    const suggestion = await base44.asServiceRole.entities.TopicEditSuggestion
      .get(suggestionId)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!suggestion) return Response.json({ error: 'Suggestion not found' }, { status: 404 });
    if (suggestion.status !== 'pending') {
      return Response.json({ success: true, accepted: false, reason: 'already_processed' });
    }

    const document = await base44.asServiceRole.entities.Document
      .get(suggestion.documentId)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!document) return Response.json({ error: 'Document not found' }, { status: 404 });

    // Recount from the vote records; dedupe per voter because a single user can
    // own more than one row.
    const votes = await base44.asServiceRole.entities.TopicEditVote.filter({ suggestionId });
    const byVoter = new Map();
    for (const vote of votes) {
      if (vote.userId) byVoter.set(vote.userId, vote);
    }
    const deduped = Array.from(byVoter.values());
    const proVotes = deduped.filter((v) => v.vote === 'pro').length;
    const conVotes = deduped.filter((v) => v.vote === 'con').length;
    const threshold = Math.max(2, document.threshold || 2);

    if (proVotes - conVotes < threshold) {
      return Response.json({ success: true, accepted: false, reason: 'threshold_not_met', proVotes, conVotes, threshold });
    }

    const lock = await base44.asServiceRole.entities.TopicEditSuggestion.updateMany(
      { id: suggestionId, status: 'pending' },
      { $set: { status: 'accepted', proVotes, conVotes } }
    );
    if (!lock?.updated) {
      return Response.json({ success: true, accepted: false, reason: 'already_processed' });
    }

    // The status is ours — apply the change and record the version.
    await base44.asServiceRole.entities.Topic.update(suggestion.topicId, { title: suggestion.newTitle });

    try {
      const latestVersions = await base44.asServiceRole.entities.DocumentVersion
        .filter({ documentId: suggestion.documentId }, '-version', 1);
      const nextVersion = latestVersions.length > 0 ? (latestVersions[0].version || 0) + 1 : 1;
      const topicSections = await base44.asServiceRole.entities.Section.filter({ topicId: suggestion.topicId });
      const firstSectionId = topicSections[0]?.id;
      if (firstSectionId) {
        await base44.asServiceRole.entities.DocumentVersion.create({
          documentId: suggestion.documentId,
          sectionId: firstSectionId,
          content: `topic_title_change:${suggestion.topicId}:${suggestion.originalTitle}:${suggestion.newTitle}`,
          changeDescription: `כותרת נושא עודכנה: ${suggestion.originalTitle} → ${suggestion.newTitle}`,
          version: nextVersion,
          changeType: 'suggestion_accepted',
          suggestionId: suggestion.id,
          originalLanguage: 'he',
        });
      }
    } catch (versionError) {
      console.error('[TOPIC ACCEPTANCE] Version record failed:', versionError);
    }

    return Response.json({
      success: true,
      accepted: true,
      topicId: suggestion.topicId,
      newTitle: suggestion.newTitle,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}