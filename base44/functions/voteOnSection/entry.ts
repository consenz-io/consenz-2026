import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// In-memory lock to prevent the same user voting on the same section concurrently
const processingVotes = new Set();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sectionId, vote } = await req.json();

    if (!sectionId || !vote) {
      return Response.json({ error: 'Missing sectionId or vote' }, { status: 400 });
    }

    if (vote !== 'pro' && vote !== 'con') {
      return Response.json({ error: 'Invalid vote value' }, { status: 400 });
    }

    // Idempotency lock — prevent duplicate concurrent requests for same user+section
    const lockKey = `${user.id}-${sectionId}`;
    if (processingVotes.has(lockKey)) {
      return Response.json({ error: 'Vote already in progress' }, { status: 429 });
    }
    processingVotes.add(lockKey);
    setTimeout(() => processingVotes.delete(lockKey), 10000);

    try {
      // Use asServiceRole for all SectionVote operations — bypasses RLS so we can
      // count ALL votes (not just the current user's), matching voteOnSuggestion.
      const allVotes = await base44.asServiceRole.entities.SectionVote.filter({ sectionId });
      const userVotes = allVotes.filter(v => v.userId === user.id);

      // Clean up duplicate votes for this user (safety check — keep one)
      if (userVotes.length > 1) {
        await Promise.all(
          userVotes.slice(1).map(v => base44.asServiceRole.entities.SectionVote.delete(v.id))
        );
      }
      const existingVote = userVotes[0] || null;

      let action;
      if (existingVote) {
        if (existingVote.vote === vote) {
          // Toggle off — same vote clicked again
          await base44.asServiceRole.entities.SectionVote.delete(existingVote.id);
          action = 'deleted';
        } else {
          // Change vote direction
          await base44.asServiceRole.entities.SectionVote.update(existingVote.id, { vote });
          action = 'updated';
        }
      } else {
        await base44.asServiceRole.entities.SectionVote.create({ sectionId, userId: user.id, vote });
        action = 'created';
      }

      // Return fresh vote counts from DB (source of truth — all votes via service role)
      const freshVotes = await base44.asServiceRole.entities.SectionVote.filter({ sectionId });
      const proCount = freshVotes.filter(v => v.vote === 'pro').length;
      const conCount = freshVotes.filter(v => v.vote === 'con').length;

      // ── Deletion check ──────────────────────────────────────────────
      // For existing/accepted sections, voting is for deletion:
      // if opponents (con) minus supporters (pro) reaches the document's
      // support threshold, the section is automatically deleted.
      let sectionDeleted = false;
      const section = await base44.asServiceRole.entities.Section.get(sectionId).catch(() => null);
      if (section) {
        const document = await base44.asServiceRole.entities.Document.get(section.documentId).catch(() => null);
        const threshold = Math.max(2, document?.threshold || 2);

        if (conCount - proCount >= threshold) {
          // Log a version history entry before deleting (for reconstruction)
          try {
            const lastVersion = await base44.asServiceRole.entities.DocumentVersion.filter({ sectionId }, '-version', 1);
            const version = (lastVersion && lastVersion.length > 0 ? lastVersion[0].version : 0) + 1;
            await base44.asServiceRole.entities.DocumentVersion.create({
              documentId: section.documentId,
              sectionId,
              topicId: section.topicId,
              sectionOrder: section.order,
              content: section.content,
              changeDescription: 'הסעיף נמחק בהצבעת קהילה',
              version,
              changeType: 'section_deleted',
              originalLanguage: section.originalLanguage || 'he',
              translations: section.translations || {},
            });
          } catch (e) {
            console.error('[VOTE ON SECTION version log error]', e);
          }

          // Anchor pending suggestions targeting this section to their original position
          // (topicId + originalSectionOrder) so they remain visible & votable after deletion.
          // We do NOT reject them — the community can still accept them, which recreates the section.
          try {
            const orphaned = await base44.asServiceRole.entities.Suggestion.filter({
              documentId: section.documentId,
              status: 'pending',
              sectionId
            });
            if (orphaned.length > 0) {
              await Promise.all(
                orphaned.map(s =>
                  base44.asServiceRole.entities.Suggestion.update(s.id, {
                    topicId: s.topicId || section.topicId,
                    originalSectionOrder: section.order
                  })
                )
              );
              console.log('[VOTE ON SECTION] Anchored', orphaned.length, 'orphaned suggestions to original position');
            }
          } catch (e) {
            console.error('[VOTE ON SECTION orphan anchor error]', e);
          }

          await base44.asServiceRole.entities.Section.delete(sectionId);
          // Clean up the section's votes too
          try {
            await base44.asServiceRole.entities.SectionVote.deleteMany({ sectionId });
          } catch (e) {
            console.error('[VOTE ON SECTION vote cleanup error]', e);
          }
          sectionDeleted = true;
        }
      }

      return Response.json({ success: true, action, proCount, conCount, votes: freshVotes, sectionDeleted });

    } finally {
      processingVotes.delete(lockKey);
    }

  } catch (error) {
    console.error('[VOTE ON SECTION ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});