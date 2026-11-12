import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { checkDocumentAuthorization } from '../../shared/documentAuth.ts';
import { INTERNAL_AUTOMATION_TOKEN } from '../../shared/authGate.ts';
import { awardRejectionVotePoints } from '../../shared/rejectionVotePoints.ts';

// The single server-side owner of administrator state transitions on a Suggestion.
// Before this function existed the browser performed these writes directly
// (status, rejectedByAdmin, thresholdAtRejection, timerEndsAt, acceptanceLock),
// and admin acceptance went through the legacy processAcceptance engine while
// community votes went through processAcceptanceV4 — two engines for one state
// machine. Every transition now runs here: authorization is verified against
// non-client-writable data (checkDocumentAuthorization), each write is a CAS on
// the status the caller saw, and acceptance delegates to processAcceptanceV4.
const ACTIONS = ['accept', 'reject', 'reopen'];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { suggestionId } = body;
    // Accept the UI's status vocabulary as well, so callers cannot desync.
    const action =
      body.action === 'accepted' ? 'accept' :
      body.action === 'rejected' ? 'reject' :
      body.action === 'pending' ? 'reopen' : body.action;

    if (!suggestionId || !ACTIONS.includes(action)) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const suggestion = await base44.asServiceRole.entities.Suggestion
      .get(suggestionId)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!suggestion) return Response.json({ error: 'Suggestion not found' }, { status: 404 });

    const { authorized, document } = await checkDocumentAuthorization(base44, suggestion.documentId, user);
    if (!authorized || !document) return Response.json({ error: 'Forbidden' }, { status: 403 });

    if (action === 'accept') {
      if (suggestion.status !== 'pending') {
        return Response.json({ success: true, status: suggestion.status, message: 'Already processed' });
      }

      let result;
      try {
        const res = await base44.asServiceRole.functions.invoke('processAcceptanceV4', {
          suggestionId,
          documentId: suggestion.documentId,
          voterId: user.id,
          wasNewVote: false,
          forceAccept: true,
          internalToken: INTERNAL_AUTOMATION_TOKEN,
        });
        result = res?.data ?? res;
      } catch (invokeError) {
        return Response.json(
          { error: invokeError?.response?.data?.error || invokeError.message || 'Acceptance failed' },
          { status: 500 }
        );
      }

      if (result?.error) return Response.json({ error: result.error }, { status: 500 });

      // Only claim the admin override once the engine actually moved the
      // suggestion — processAcceptanceV4 may legitimately decline (locked,
      // already processed, or threshold no longer met).
      const after = await base44.asServiceRole.entities.Suggestion.get(suggestionId);
      if (after?.status !== 'accepted') {
        return Response.json(
          { success: false, status: after?.status || suggestion.status, error: result?.message || 'Acceptance did not complete' },
          { status: 409 }
        );
      }

      // processAcceptanceV4 sets status=accepted; only the admin flag is ours.
      await base44.asServiceRole.entities.Suggestion.update(suggestionId, { approvedByAdmin: true });
      return Response.json({ success: true, status: 'accepted' });
    }

    if (action === 'reject') {
      const lock = await base44.asServiceRole.entities.Suggestion.updateMany(
        { id: suggestionId, status: 'pending' },
        {
          $set: {
            status: 'rejected',
            rejectedByAdmin: true,
            thresholdAtRejection: Math.max(2, document.threshold || 2),
            acceptanceLock: false,
          },
        }
      );
      if (!lock?.updated) return Response.json({ error: 'Suggestion already processed' }, { status: 409 });

      // An admin rejection pays the opposing voters, just like an expiry does.
      const points = await awardRejectionVotePoints(base44.asServiceRole, { ...suggestion, status: 'rejected' }, document);
      return Response.json({ success: true, status: 'rejected', points });
    }

    // reopen — identified as "returned to voting", not as a set of cleared fields.
    if (suggestion.status !== 'rejected') {
      return Response.json({ error: 'Only rejected suggestions can be reopened' }, { status: 409 });
    }

    // Re-sync the denormalized counters from the Vote records so all past votes
    // survive the reopen accurately even if the counts drifted.
    const votes = await base44.asServiceRole.entities.Vote.filter({ suggestionId });
    const byVoter = new Map();
    for (const vote of votes) {
      if (vote.userId) byVoter.set(vote.userId, vote);
    }
    const deduped = Array.from(byVoter.values());
    const proVotes = deduped.filter((v) => v.vote === 'pro').length;
    const conVotes = deduped.filter((v) => v.vote === 'con').length;

    const hours = document.defaultSuggestionLifetimeHours;
    const timerEndsAt =
      hours === null ? null : new Date(Date.now() + (hours || 72) * 60 * 60 * 1000).toISOString();

    const reopened = await base44.asServiceRole.entities.Suggestion.updateMany(
      { id: suggestionId, status: 'rejected' },
      {
        $set: {
          status: 'pending',
          timerEndsAt,
          proVotes,
          conVotes,
          rejectedByAdmin: false,
          approvedByAdmin: false,
          acceptanceLock: false,
          thresholdAtRejection: null,
          acceptedAt: null,
          participantsAtAcceptance: null,
          suggestionConsensus: null,
        },
      }
    );
    if (!reopened?.updated) return Response.json({ error: 'Suggestion already reopened' }, { status: 409 });

    return Response.json({ success: true, status: 'pending', timerEndsAt });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}