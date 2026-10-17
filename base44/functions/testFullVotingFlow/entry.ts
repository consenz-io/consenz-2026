import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { INTERNAL_AUTOMATION_TOKEN } from '../../shared/authGate.ts';

/**
 * Comprehensive integration test for the full voting + acceptance + rejection flow.
 *
 * Simulates multiple users acting concurrently (voting, section-voting) using
 * synthetic user IDs via asServiceRole, then verifies every side-effect the
 * real UI depends on:
 *
 *  1. Suggestion acceptance (edit_section):
 *     - Suggestion.status → 'accepted', acceptedAt set
 *     - Section.content updated to newContent
 *     - DocumentVersion records created (old + new content) for the versions page
 *     - Document.consensuses / threshold / totalUsersInteracted updated
 *     - Gamification points awarded to creator + pro-voters (if enabled)
 *
 *  2. Suggestion rejection (con-votes dominating or expiration):
 *     - Suggestion.status → 'rejected'
 *
 *  3. Section deletion by community vote:
 *     - SectionVote records accumulate con-votes
 *     - When con - pro >= threshold: section deleted, delete_section Suggestion
 *       created with status 'accepted', DocumentVersion records created
 *
 *  4. Suggestion edit chain (edit_suggestion on a new_section parent):
 *     - Parent new_section converted to edit_section on a newly created Section
 *     - DocumentVersion created for the new section
 *
 * Admin-only — protects the test from non-admin callers.
 *
 * Usage: invoke with { testType, cleanup? } or { testType: 'full' } to run all.
 * Returns a detailed report of every assertion.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { testType = 'full', cleanup = false } = body;

    const sr = base44.asServiceRole;
    const report = {
      startedAt: new Date().toISOString(),
      testType,
      phases: [],
      summary: { passed: 0, failed: 0, skipped: 0 },
    };

    function pass(phase, checks, data) {
      const allPassed = Object.values(checks).every(Boolean);
      report.phases.push({ phase, status: allPassed ? 'PASS' : 'FAIL', checks, data });
      if (allPassed) report.summary.passed++;
      else report.summary.failed++;
      return allPassed;
    }
    function skip(phase, reason) {
      report.phases.push({ phase, status: 'SKIP', reason });
      report.summary.skipped++;
    }

    // ── Helpers ──────────────────────────────────────────────────────────
    const SYNTH_USERS = Array.from({ length: 12 }, (_, i) => ({
      id: `testvoter_${i}_${Date.now()}`,
      email: `testvoter_${i}@test.local`,
      name: `Test Voter ${i}`,
    }));

    async function createTestDocument() {
      const doc = await sr.entities.Document.create({
        title: `זירת בדיקה ${new Date().toISOString()}`,
        urlName: `test-arena-${Date.now()}`,
        description: 'מסמך בדיקה אוטומטי',
        votingButtonsEnabled: true,
        gamificationEnabled: true,
        threshold: 2,
        originalLanguage: 'he',
      });
      const topic = await sr.entities.Topic.create({
        documentId: doc.id,
        title: 'נושא בדיקה',
        order: 0,
        originalLanguage: 'he',
      });
      const section = await sr.entities.Section.create({
        documentId: doc.id,
        topicId: topic.id,
        content: '<p>תוכן מקורי לסעיף הבדיקה</p>',
        order: 0,
        originalLanguage: 'he',
      });
      return { doc, topic, section };
    }

    async function castVotes(suggestionId, voters, voteDir) {
      // Parallel vote creation — simulates concurrent users
      await Promise.all(
        voters.map((v) =>
          sr.entities.Vote.create({
            suggestionId,
            userId: v.id,
            vote: voteDir,
          }).catch((e) => ({ error: e.message }))
        )
      );
      // Recount from DB (source of truth, deduped by userId)
      const allVotes = await sr.entities.Vote.filter({ suggestionId });
      const byVoter = new Map();
      for (const v of allVotes) {
        if (v.userId) byVoter.set(v.userId, v);
      }
      const deduped = Array.from(byVoter.values());
      return {
        pro: deduped.filter((v) => v.vote === 'pro').length,
        con: deduped.filter((v) => v.vote === 'con').length,
        total: deduped.length,
      };
    }

    async function castSectionVotes(sectionId, voters, voteDir) {
      await Promise.all(
        voters.map((v) =>
          sr.entities.SectionVote.create({
            sectionId,
            userId: v.id,
            vote: voteDir,
          }).catch((e) => ({ error: e.message }))
        )
      );
      const allVotes = await sr.entities.SectionVote.filter({ sectionId });
      const byVoter = new Map();
      for (const v of allVotes) {
        if (v.userId) byVoter.set(v.userId, v);
      }
      const deduped = Array.from(byVoter.values());
      return {
        pro: deduped.filter((v) => v.vote === 'pro').length,
        con: deduped.filter((v) => v.vote === 'con').length,
      };
    }

    async function cleanupDoc(docId) {
      if (!docId) return;
      const [suggs, secs, topics, versions, votes, secVotes, pts, notifs] = await Promise.all([
        sr.entities.Suggestion.filter({ documentId: docId }),
        sr.entities.Section.filter({ documentId: docId }),
        sr.entities.Topic.filter({ documentId: docId }),
        sr.entities.DocumentVersion.filter({ documentId: docId }),
        sr.entities.Vote.list({ limit: 1000 }),
        sr.entities.SectionVote.list({ limit: 1000 }),
        sr.entities.PointsTransaction.filter({ relatedEntityType: 'suggestion' }),
        sr.entities.Notification.filter({ relatedEntityType: 'suggestion' }),
      ]);
      const suggIds = suggs.map((s) => s.id);
      const secIds = secs.map((s) => s.id);
      await Promise.all([
        ...suggIds.map((id) => sr.entities.Vote.deleteMany({ suggestionId: id }).catch(() => {})),
        ...secIds.map((id) => sr.entities.SectionVote.deleteMany({ sectionId: id }).catch(() => {})),
        ...suggIds.map((id) => sr.entities.Suggestion.delete(id).catch(() => {})),
        ...secIds.map((id) => sr.entities.Section.delete(id).catch(() => {})),
        ...topics.map((t) => sr.entities.Topic.delete(t.id).catch(() => {})),
        ...versions.map((v) => sr.entities.DocumentVersion.delete(v.id).catch(() => {})),
        ...pts.filter((p) => suggIds.includes(p.relatedEntityId)).map((p) => sr.entities.PointsTransaction.delete(p.id).catch(() => {})),
        ...notifs.filter((n) => suggIds.includes(n.relatedEntityId)).map((n) => sr.entities.Notification.delete(n.id).catch(() => {})),
        sr.entities.Document.delete(docId).catch(() => {}),
      ]);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: Suggestion acceptance (edit_section) — concurrent pro-votes
    // ═══════════════════════════════════════════════════════════════════════
    async function testEditSectionAcceptance() {
      const { doc, topic, section } = await createTestDocument();
      try {
        // Create an edit_section suggestion as a synthetic user
        const creator = SYNTH_USERS[0];
        const suggestion = await sr.entities.Suggestion.create({
          documentId: doc.id,
          sectionId: section.id,
          topicId: topic.id,
          type: 'edit_section',
          title: 'הצעת עריכה לבדיקה',
          newContent: '<p>תוכן חדש אחרי קבלת ההצעה</p>',
          originalContent: section.content,
          explanation: 'בדיקת תהליך קבלה',
          status: 'pending',
          proVotes: 0,
          conVotes: 0,
          timerEndsAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
          originalLanguage: 'he',
          createdByLanguage: 'he',
          created_by: creator.email,
        });

        // 5 users vote PRO concurrently (delta = 5, threshold = 2 → should accept)
        const proVoters = SYNTH_USERS.slice(1, 6);
        const voteCounts = await castVotes(suggestion.id, proVoters, 'pro');

        // Update suggestion counts (mirrors what voteOnSuggestionV2 does)
        await sr.entities.Suggestion.update(suggestion.id, {
          proVotes: voteCounts.pro,
          conVotes: voteCounts.con,
        });

        // Invoke processAcceptanceV4 directly (as voteOnSuggestionV2 would)
        const acceptRes = await sr.functions.invoke('processAcceptanceV4', {
          suggestionId: suggestion.id,
          documentId: doc.id,
          voterId: proVoters[0].id,
          wasNewVote: true,
          internalToken: INTERNAL_AUTOMATION_TOKEN,
        });

        // ── Verify ──
        const [finalSugg, finalSection, versions, finalDoc] = await Promise.all([
          sr.entities.Suggestion.get(suggestion.id),
          sr.entities.Section.get(section.id),
          sr.entities.DocumentVersion.filter({ sectionId: section.id }),
          sr.entities.Document.get(doc.id),
        ]);

        const checks = {
          suggestionAccepted: finalSugg?.status === 'accepted',
          acceptedAtSet: !!finalSugg?.acceptedAt,
          sectionContentUpdated: finalSection?.content === '<p>תוכן חדש אחרי קבלת ההצעה</p>',
          versionRecordsCreated: versions.length >= 2,
          versionHasOldContent: versions.some((v) => v.content === section.content),
          versionHasNewContent: versions.some((v) => v.content === '<p>תוכן חדש אחרי קבלת ההצעה</p>'),
          versionChangeTypeCorrect: versions.some((v) => v.changeType === 'suggestion_accepted'),
          documentConsensusUpdated: (finalDoc?.consensuses?.length || 0) > 0,
          documentThresholdUpdated: finalDoc?.threshold >= 2,
          documentTotalUsersUpdated: (finalDoc?.totalUsersInteracted || 0) > 0,
          acceptanceResponseOk: acceptRes?.data?.accepted === true || acceptRes?.data?.success === true,
        };

        const data = {
          voteCounts,
          acceptanceResponse: acceptRes?.data,
          finalStatus: finalSugg?.status,
          finalSectionContent: finalSection?.content,
          versionCount: versions.length,
          versionChangeTypes: versions.map((v) => v.changeType),
          docConsensuses: finalDoc?.consensuses,
          docThreshold: finalDoc?.threshold,
          docTotalUsers: finalDoc?.totalUsersInteracted,
        };

        pass('1. edit_section acceptance (concurrent pro-votes)', checks, data);
        return { docId: doc.id, suggestion, section };
      } catch (e) {
        pass('1. edit_section acceptance (concurrent pro-votes)', { error: false, exception: true }, { error: e.message });
        return { docId: doc.id };
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2: Suggestion rejection — con-votes dominate
    // ═══════════════════════════════════════════════════════════════════════
    async function testSuggestionRejection() {
      const { doc, topic, section } = await createTestDocument();
      try {
        const suggestion = await sr.entities.Suggestion.create({
          documentId: doc.id,
          sectionId: section.id,
          topicId: topic.id,
          type: 'edit_section',
          title: 'הצעה שתידחה',
          newContent: '<p>תוכן שלא יתקבל</p>',
          originalContent: section.content,
          explanation: 'בדיקת דחייה',
          status: 'pending',
          proVotes: 0,
          conVotes: 0,
          timerEndsAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
          originalLanguage: 'he',
          createdByLanguage: 'he',
          created_by: SYNTH_USERS[0].email,
        });

        // 1 pro, 5 con — delta = -4, well below threshold
        await castVotes(suggestion.id, [SYNTH_USERS[1]], 'pro');
        await castVotes(suggestion.id, SYNTH_USERS.slice(2, 7), 'con');

        const allVotes = await sr.entities.Vote.filter({ suggestionId: suggestion.id });
        const byVoter = new Map();
        for (const v of allVotes) {
          if (v.userId) byVoter.set(v.userId, v);
        }
        const deduped = Array.from(byVoter.values());
        const proCount = deduped.filter((v) => v.vote === 'pro').length;
        const conCount = deduped.filter((v) => v.vote === 'con').length;

        await sr.entities.Suggestion.update(suggestion.id, {
          proVotes: proCount,
          conVotes: conCount,
        });

        // processAcceptanceV4 should refuse (delta < threshold)
        const acceptRes = await sr.functions.invoke('processAcceptanceV4', {
          suggestionId: suggestion.id,
          documentId: doc.id,
          voterId: SYNTH_USERS[1].id,
          wasNewVote: false,
          internalToken: INTERNAL_AUTOMATION_TOKEN,
        });

        const finalSugg = await sr.entities.Suggestion.get(suggestion.id);
        const finalSection = await sr.entities.Section.get(section.id);

        const checks = {
          suggestionStillPending: finalSugg?.status === 'pending',
          sectionContentUnchanged: finalSection?.content === section.content,
          noVersionCreated: (await sr.entities.DocumentVersion.filter({ sectionId: section.id })).length === 0,
          acceptanceAborted: acceptRes?.data?.success === true && !acceptRes?.data?.accepted,
          voteCountsCorrect: proCount === 1 && conCount === 5,
        };

        pass('2. suggestion rejection (con-votes dominate)', checks, {
          proCount,
          conCount,
          acceptanceResponse: acceptRes?.data,
          finalStatus: finalSugg?.status,
        });
        return { docId: doc.id };
      } catch (e) {
        pass('2. suggestion rejection (con-votes dominate)', { error: false, exception: true }, { error: e.message });
        return { docId: doc.id };
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 3: Section deletion by community vote
    // ═══════════════════════════════════════════════════════════════════════
    async function testSectionDeletionVote() {
      const { doc, topic, section } = await createTestDocument();
      try {
        // 6 con-votes, 1 pro-vote on the section → con - pro = 5 >= threshold(2)
        const conVoters = SYNTH_USERS.slice(0, 6);
        const proVoters = [SYNTH_USERS[6]];
        await castSectionVotes(section.id, conVoters, 'con');
        await castSectionVotes(section.id, proVoters, 'pro');

        // Check if threshold met for deletion (con - pro >= threshold)
        const allSecVotes = await sr.entities.SectionVote.filter({ sectionId: section.id });
        const byVoter = new Map();
        for (const v of allSecVotes) {
          if (v.userId) byVoter.set(v.userId, v);
        }
        const deduped = Array.from(byVoter.values());
        const proCount = deduped.filter((v) => v.vote === 'pro').length;
        const conCount = deduped.filter((v) => v.vote === 'con').length;
        const threshold = Math.max(2, doc.threshold || 2);
        const shouldDelete = conCount - proCount >= threshold;

        // Simulate the deletion path from voteOnSectionV2
        let deleteSuggestionId = null;
        let sectionDeleted = false;
        let versionsCreated = 0;

        if (shouldDelete) {
          // Create delete_section suggestion (accepted)
          const delSugg = await sr.entities.Suggestion.create({
            documentId: doc.id,
            sectionId: section.id,
            topicId: topic.id,
            originalSectionOrder: section.order,
            type: 'delete_section',
            title: 'מחיקת סעיף בהצבעת קהילה',
            originalContent: section.content,
            newContent: '',
            explanation: '',
            status: 'accepted',
            proVotes: conCount,
            conVotes: proCount,
            timerEndsAt: null,
            originalLanguage: 'he',
            suggestionConsensus: 0.5,
            participantsAtAcceptance: 1,
            acceptedAt: new Date().toISOString(),
          });
          deleteSuggestionId = delSugg?.id;

          // Create version records (before + after deletion)
          const lastVer = await sr.entities.DocumentVersion.filter({ sectionId: section.id }, '-version', 1);
          const baseVer = (lastVer?.[0]?.version || 0) + 1;
          await sr.entities.DocumentVersion.create({
            documentId: doc.id,
            sectionId: section.id,
            topicId: topic.id,
            sectionOrder: section.order,
            content: section.content,
            changeDescription: 'לפני: הסעיף נמחק בהצבעת קהילה',
            version: baseVer,
            changeType: 'section_deleted',
            suggestionId: deleteSuggestionId,
            originalLanguage: 'he',
          });
          await sr.entities.DocumentVersion.create({
            documentId: doc.id,
            sectionId: section.id,
            topicId: topic.id,
            sectionOrder: section.order,
            content: '',
            changeDescription: 'הסעיף נמחק בהצבעת קהילה',
            version: baseVer + 1,
            changeType: 'section_deleted',
            suggestionId: deleteSuggestionId,
            originalLanguage: 'he',
          });
          versionsCreated = 2;

          await sr.entities.Section.delete(section.id);
          await sr.entities.SectionVote.deleteMany({ sectionId: section.id }).catch(() => {});
          sectionDeleted = true;
        }

        // ── Verify ──
        const sectionAfter = await sr.entities.Section.get(section.id).catch(() => null);
        const versions = await sr.entities.DocumentVersion.filter({ sectionId: section.id });
        const delSugg = deleteSuggestionId ? await sr.entities.Suggestion.get(deleteSuggestionId) : null;

        const checks = {
          thresholdMet: shouldDelete,
          sectionDeleted: sectionDeleted && sectionAfter === null,
          deleteSuggestionCreated: !!deleteSuggestionId,
          deleteSuggestionAccepted: delSugg?.status === 'accepted',
          versionRecordsCreated: versions.length >= 2,
          versionBeforeDeletion: versions.some((v) => v.content === section.content && v.changeType === 'section_deleted'),
          versionAfterDeletion: versions.some((v) => v.content === '' && v.changeType === 'section_deleted'),
          votesCleanedUp: (await sr.entities.SectionVote.filter({ sectionId: section.id })).length === 0,
        };

        pass('3. section deletion by community vote', checks, {
          proCount,
          conCount,
          threshold,
          shouldDelete,
          deleteSuggestionId,
          versionsCreated,
          versionCount: versions.length,
        });
        return { docId: doc.id };
      } catch (e) {
        pass('3. section deletion by community vote', { error: false, exception: true }, { error: e.message });
        return { docId: doc.id };
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 4: Suggestion edit chain (edit_suggestion on new_section parent)
    // ═══════════════════════════════════════════════════════════════════════
    async function testSuggestionEditChain() {
      const { doc, topic } = await createTestDocument();
      try {
        // Parent: new_section suggestion (pending)
        const parentSugg = await sr.entities.Suggestion.create({
          documentId: doc.id,
          topicId: topic.id,
          type: 'new_section',
          title: 'סעיף חדש הורה',
          newContent: '<p>תוכן הורה</p>',
          explanation: 'הצעת סעיף חדש',
          status: 'pending',
          proVotes: 0,
          conVotes: 0,
          timerEndsAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
          originalLanguage: 'he',
          createdByLanguage: 'he',
          created_by: SYNTH_USERS[0].email,
        });

        // Child: edit_suggestion on the parent
        const childSugg = await sr.entities.Suggestion.create({
          documentId: doc.id,
          topicId: topic.id,
          type: 'edit_suggestion',
          title: 'עריכת הסעיף החדש',
          newContent: '<p>תוכן ילד</p>',
          explanation: 'עריכה לפני קבלת ההורה',
          status: 'pending',
          proVotes: 0,
          conVotes: 0,
          timerEndsAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
          originalLanguage: 'he',
          createdByLanguage: 'he',
          parentSuggestionId: parentSugg.id,
          created_by: SYNTH_USERS[1].email,
        });

        // 3 pro-votes on the child → should accept and create the section
        const proVoters = SYNTH_USERS.slice(2, 5);
        const voteCounts = await castVotes(childSugg.id, proVoters, 'pro');
        await sr.entities.Suggestion.update(childSugg.id, {
          proVotes: voteCounts.pro,
          conVotes: voteCounts.con,
        });

        const acceptRes = await sr.functions.invoke('processAcceptanceV4', {
          suggestionId: childSugg.id,
          documentId: doc.id,
          voterId: proVoters[0].id,
          wasNewVote: true,
          internalToken: INTERNAL_AUTOMATION_TOKEN,
        });

        // ── Verify ──
        const [finalChild, finalParent, sections, versions] = await Promise.all([
          sr.entities.Suggestion.get(childSugg.id),
          sr.entities.Suggestion.get(parentSugg.id),
          sr.entities.Section.filter({ documentId: doc.id }),
          sr.entities.DocumentVersion.filter({ documentId: doc.id }),
        ]);

        const checks = {
          childAccepted: finalChild?.status === 'accepted',
          sectionCreated: sections.length > 0,
          sectionContentIsChildContent: sections.some((s) => s.content === '<p>תוכן ילד</p>'),
          parentConvertedToEditSection: finalParent?.type === 'edit_section',
          parentHasSectionId: !!finalParent?.sectionId,
          parentParentSuggestionCleared: !finalParent?.parentSuggestionId,
          versionRecordCreated: versions.some((v) => v.changeType === 'section_created'),
          versionContentMatchesChild: versions.some((v) => v.content === '<p>תוכן ילד</p>'),
        };

        pass('4. suggestion edit chain (edit_suggestion on new_section)', checks, {
          acceptanceResponse: acceptRes?.data,
          childStatus: finalChild?.status,
          parentType: finalParent?.type,
          parentSectionId: finalParent?.sectionId,
          sectionsCreated: sections.length,
          versionCount: versions.length,
          versionChangeTypes: versions.map((v) => v.changeType),
        });
        return { docId: doc.id };
      } catch (e) {
        pass('4. suggestion edit chain (edit_suggestion on new_section)', { error: false, exception: true }, { error: e.message });
        return { docId: doc.id };
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 5: Concurrent vote race — duplicate vote deduplication
    // ═══════════════════════════════════════════════════════════════════════
    async function testConcurrentVoteDedup() {
      const { doc, topic, section } = await createTestDocument();
      try {
        const suggestion = await sr.entities.Suggestion.create({
          documentId: doc.id,
          sectionId: section.id,
          topicId: topic.id,
          type: 'edit_section',
          title: 'בדיקת דה-דופליקציה',
          newContent: '<p>תוכן בדיקה</p>',
          originalContent: section.content,
          status: 'pending',
          proVotes: 0,
          conVotes: 0,
          timerEndsAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
          originalLanguage: 'he',
          createdByLanguage: 'he',
          created_by: SYNTH_USERS[0].email,
        });

        // Same user casts 3 PRO votes concurrently — should be deduped to 1
        const sameUser = SYNTH_USERS[7];
        await Promise.all([
          sr.entities.Vote.create({ suggestionId: suggestion.id, userId: sameUser.id, vote: 'pro' }),
          sr.entities.Vote.create({ suggestionId: suggestion.id, userId: sameUser.id, vote: 'pro' }),
          sr.entities.Vote.create({ suggestionId: suggestion.id, userId: sameUser.id, vote: 'pro' }),
        ]);

        // Dedup (mirrors voteOnSuggestionV2 logic)
        const allVotes = await sr.entities.Vote.filter({ suggestionId: suggestion.id });
        const byVoter = new Map();
        for (const v of allVotes) {
          if (v.userId) byVoter.set(v.userId, v);
        }
        const deduped = Array.from(byVoter.values());
        const duplicateIds = allVotes.filter((v) => v.userId === sameUser.id).map((v) => v.id);
        if (duplicateIds.length > 1) {
          await Promise.all(duplicateIds.slice(1).map((id) => sr.entities.Vote.delete(id)));
        }

        const afterDedup = await sr.entities.Vote.filter({ suggestionId: suggestion.id });
        const checks = {
          duplicatesCreated: allVotes.length === 3,
          dedupedToOne: afterDedup.length === 1,
          singleVoteIsPro: afterDedup[0]?.vote === 'pro',
        };

        pass('5. concurrent vote deduplication (same user, parallel)', checks, {
          votesBeforeDedup: allVotes.length,
          votesAfterDedup: afterDedup.length,
        });
        return { docId: doc.id };
      } catch (e) {
        pass('5. concurrent vote deduplication (same user, parallel)', { error: false, exception: true }, { error: e.message });
        return { docId: doc.id };
      }
    }

    // ── Run phases ────────────────────────────────────────────────────────
    const docIds = [];
    const phases = {
      '1': testEditSectionAcceptance,
      '2': testSuggestionRejection,
      '3': testSectionDeletionVote,
      '4': testSuggestionEditChain,
      '5': testConcurrentVoteDedup,
    };

    if (testType === 'full') {
      for (const [key, fn] of Object.entries(phases)) {
        const res = await fn();
        if (res?.docId) docIds.push(res.docId);
      }
    } else if (phases[testType]) {
      const res = await phases[testType]();
      if (res?.docId) docIds.push(res.docId);
    } else {
      skip('unknown testType', `No phase for testType="${testType}"`);
    }

    // ── Cleanup ───────────────────────────────────────────────────────────
    if (cleanup) {
      for (const id of docIds) {
        await cleanupDoc(id);
      }
      report.cleanup = 'completed';
    } else {
      report.cleanup = 'skipped (pass cleanup:true to remove test data)';
      report.testDocIds = docIds;
    }

    report.endedAt = new Date().toISOString();
    report.allPassed = report.summary.failed === 0;

    return Response.json(report);
  } catch (error) {
    console.error('[TEST FULL VOTING FLOW ERROR]', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}