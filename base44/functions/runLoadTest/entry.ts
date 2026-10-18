import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { testType, documentId, concurrentUsers = 10 } = await req.json();

    // Cap concurrentUsers to prevent large-scale synthetic data from
    // triggering real automations (point awards, notifications) on production.
    const cappedConcurrentUsers = Math.min(concurrentUsers, 10);

    const results = {};
    const startTime = Date.now();

    if (testType === 'concurrent_votes') {
      // בדיקת הצבעות מקבילות
      const suggestions = await base44.entities.Suggestion.filter({ documentId, status: 'pending' });
      
      if (suggestions.length === 0) {
        return Response.json({ error: 'No pending suggestions found' }, { status: 400 });
      }

      // סימולציה של משתמשים מרובים מצביעים בו זמנית
      const votePromises = [];
      for (let i = 0; i < cappedConcurrentUsers; i++) {
        const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
        const vote = Math.random() > 0.5 ? 'pro' : 'con';
        
        votePromises.push(
          base44.asServiceRole.entities.Vote.create({
            suggestionId: randomSuggestion.id,
            userId: `test-user-${i}`,
            vote
          }).catch(err => ({ error: err.message }))
        );
      }

      const voteResults = await Promise.all(votePromises);
      const successfulVotes = voteResults.filter(r => !r.error).length;
      const failedVotes = voteResults.filter(r => r.error).length;

      results.votesCreated = successfulVotes;
      results.votesFailed = failedVotes;
      results.votesTime = Date.now() - startTime;
      results.avgTimePerVote = results.votesTime / cappedConcurrentUsers;

    } else if (testType === 'concurrent_comments') {
      // בדיקת תגובות מקבילות
      const suggestions = await base44.entities.Suggestion.filter({ documentId });
      
      if (suggestions.length === 0) {
        return Response.json({ error: 'No suggestions found' }, { status: 400 });
      }

      const commentPromises = [];
      for (let i = 0; i < concurrentUsers; i++) {
        const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
        
        commentPromises.push(
          base44.asServiceRole.entities.Comment.create({
            rootEntityType: 'suggestion',
            rootEntityId: randomSuggestion.id,
            content: `תגובת בדיקה ${i + 1}`,
            created_by: `test-user-${i}@test.com`
          }).catch(err => ({ error: err.message }))
        );
      }

      const commentResults = await Promise.all(commentPromises);
      const successfulComments = commentResults.filter(r => !r.error).length;
      const failedComments = commentResults.filter(r => r.error).length;

      results.commentsCreated = successfulComments;
      results.commentsFailed = failedComments;
      results.commentsTime = Date.now() - startTime;
      results.avgTimePerComment = results.commentsTime / concurrentUsers;

    } else if (testType === 'concurrent_suggestions') {
      // בדיקת הצעות מקבילות
      const sections = await base44.entities.Section.filter({ documentId });
      
      if (sections.length === 0) {
        return Response.json({ error: 'No sections found' }, { status: 400 });
      }

      const suggestionPromises = [];
      for (let i = 0; i < Math.min(concurrentUsers, 50); i++) { // מגביל ל-50 כדי לא ליצור יותר מדי
        const randomSection = sections[Math.floor(Math.random() * sections.length)];
        
        suggestionPromises.push(
          base44.asServiceRole.entities.Suggestion.create({
            documentId,
            sectionId: randomSection.id,
            topicId: randomSection.topicId,
            type: 'edit_section',
            title: `הצעת עומס ${i + 1}`,
            newContent: `<p>תוכן בדיקת עומס ${i + 1}</p>`,
            originalContent: randomSection.content,
            explanation: `בדיקת עומס ${i + 1}`,
            status: 'pending',
            proVotes: 0,
            conVotes: 0,
            timerEndsAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
            created_by: `test-user-${i}@test.com`
          }).catch(err => ({ error: err.message }))
        );
      }

      const suggestionResults = await Promise.all(suggestionPromises);
      const successfulSuggestions = suggestionResults.filter(r => !r.error).length;
      const failedSuggestions = suggestionResults.filter(r => r.error).length;

      results.suggestionsCreated = successfulSuggestions;
      results.suggestionsFailed = failedSuggestions;
      results.suggestionsTime = Date.now() - startTime;
      results.avgTimePerSuggestion = results.suggestionsTime / Math.min(concurrentUsers, 50);

    } else if (testType === 'read_performance') {
      // בדיקת ביצועי קריאה
      const reads = [];
      
      // קריאות מקבילות של נתונים
      const readPromises = Array.from({ length: 20 }, async (_, i) => {
        const readStart = Date.now();
        const [doc, topics, sections, suggestions] = await Promise.all([
          base44.entities.Document.filter({ id: documentId }),
          base44.entities.Topic.filter({ documentId }),
          base44.entities.Section.filter({ documentId }),
          base44.entities.Suggestion.filter({ documentId })
        ]);
        const readTime = Date.now() - readStart;
        return { 
          iteration: i + 1, 
          readTime,
          recordsRead: doc.length + topics.length + sections.length + suggestions.length
        };
      });

      const readResults = await Promise.all(readPromises);
      const avgReadTime = readResults.reduce((sum, r) => sum + r.readTime, 0) / readResults.length;
      const maxReadTime = Math.max(...readResults.map(r => r.readTime));
      const minReadTime = Math.min(...readResults.map(r => r.readTime));

      results.reads = readResults.length;
      results.avgReadTime = avgReadTime;
      results.maxReadTime = maxReadTime;
      results.minReadTime = minReadTime;
      results.totalRecordsRead = readResults[0]?.recordsRead || 0;

    } else {
      return Response.json({ error: 'Invalid test type' }, { status: 400 });
    }

    results.totalTime = Date.now() - startTime;

    // ── Cleanup: delete all synthetic records created during the test ──
    // The test creates votes/comments/suggestions with `test-user-*` userIds
    // and `test-user-*@test.com` created_by values. These trigger real entity
    // automations (handleNewVote awards points, handleNewComment sends
    // notifications). We cannot undo the point awards or notifications, but
    // we MUST remove the synthetic records so they don't pollute production
    // data (fake vote counts, fake suggestions in the document, etc.).
    try {
      const sr = base44.asServiceRole;
      const [suggs, sections] = await Promise.all([
        sr.entities.Suggestion.filter({ documentId }),
        sr.entities.Section.filter({ documentId }),
      ]);
      const suggIds = suggs.map(s => s.id);
      const secIds = sections.map(s => s.id);

      // Delete synthetic votes (userId starts with test-user-)
      const votes = suggIds.length > 0
        ? await sr.entities.Vote.filter({ suggestionId: { $in: suggIds } })
        : [];
      const syntheticVotes = votes.filter(v => typeof v.userId === 'string' && v.userId.startsWith('test-user-'));

      // Delete synthetic comments (created_by starts with test-user-)
      const commentTargetIds = [...suggIds, ...secIds, documentId];
      const comments = await sr.entities.Comment.filter({ rootEntityId: { $in: commentTargetIds } });
      const syntheticComments = comments.filter(c => typeof c.created_by === 'string' && c.created_by.startsWith('test-user-'));

      // Delete synthetic suggestions (created_by starts with test-user-)
      const syntheticSuggs = suggs.filter(s => typeof s.created_by === 'string' && s.created_by.startsWith('test-user-'));

      await Promise.all([
        ...syntheticVotes.map(v => sr.entities.Vote.delete(v.id).catch(() => {})),
        ...syntheticComments.map(c => sr.entities.Comment.delete(c.id).catch(() => {})),
        ...syntheticSuggs.map(s => sr.entities.Suggestion.delete(s.id).catch(() => {})),
      ]);

      results.cleanup = {
        votesDeleted: syntheticVotes.length,
        commentsDeleted: syntheticComments.length,
        suggestionsDeleted: syntheticSuggs.length,
      };
    } catch (cleanupErr) {
      console.error('[LOAD TEST] Cleanup failed:', cleanupErr.message);
      results.cleanup = { error: cleanupErr.message };
    }

    return Response.json({
      success: true,
      testType,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[LOAD TEST ERROR]', error);
    return Response.json({ 
      error: 'Internal server error'
    }, { status: 500 });
  }
});