import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { checkDocumentAuthorization } from '../../shared/documentAuth.ts';
import { buildTranslations, t } from '../../shared/notificationTranslations.ts';
import { detectLanguage, isValidObjectId, filterValidObjectIds } from '../../shared/documentUtils.ts';

// Gather all document participant user IDs (suggestion creators, voters, commenters,
// agreement signers, document creator). Used for sending admin-edit notifications.
async function gatherParticipantIds(base44, documentId, document) {
  const [docSuggestions, docSections, agreements] = await Promise.all([
    base44.asServiceRole.entities.Suggestion.filter({ documentId }),
    base44.asServiceRole.entities.Section.filter({ documentId }),
    base44.asServiceRole.entities.DocumentAgreement.filter({ documentId }),
  ]);

  const docSuggestionIds = docSuggestions.map(s => s.id);
  const docSectionIds = docSections.map(s => s.id);

  const [docVotes, docComments] = await Promise.all([
    docSuggestionIds.length > 0
      ? base44.asServiceRole.entities.Vote.filter({ suggestionId: { $in: docSuggestionIds } })
      : Promise.resolve([]),
    base44.asServiceRole.entities.Comment.filter({
      rootEntityId: { $in: [...docSuggestionIds, ...docSectionIds, documentId] }
    }),
  ]);

  const contributorIds = new Set();
  if (document.created_by_id) contributorIds.add(document.created_by_id);
  agreements.forEach(a => { if (a.userId) contributorIds.add(a.userId); });
  docVotes.forEach(v => { if (v.userId) contributorIds.add(v.userId); });
  docComments.forEach(c => { if (c.created_by_id) contributorIds.add(c.created_by_id); });
  docSuggestions.forEach(s => { if (s.created_by_id) contributorIds.add(s.created_by_id); });

  return contributorIds;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      documentId,
      editType,
      sectionId,
      topicId,
      newContent,
      newTitle,
      newTopicTitle,
      insertPosition,
      changeDescription,
    } = body;

    if (!documentId || !editType) {
      return Response.json({ error: 'Missing documentId or editType' }, { status: 400 });
    }

    // Verify admin authorization for this document
    const { authorized, document, notFound } = await checkDocumentAuthorization(base44, documentId, user);
    if (notFound) return Response.json({ error: 'Document not found' }, { status: 404 });
    if (!authorized) return Response.json({ error: 'Forbidden — admin access required' }, { status: 403 });

    let editLabel = '';
    let notificationTitleKey = '';
    let notificationMessageKey = '';
    let notificationType = 'suggestion_accepted';

    // ── edit_section ──
    if (editType === 'edit_section' && sectionId) {
      const section = await base44.asServiceRole.entities.Section.filter({ id: sectionId }).then(r => r[0]);
      if (!section) return Response.json({ error: 'Section not found' }, { status: 404 });

      const versions = await base44.asServiceRole.entities.DocumentVersion.filter({ sectionId: section.id });
      const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version || 0)) + 1 : 1;
      const newContentLanguage = detectLanguage(newContent || '');

      // Version with OLD content (before change)
      await base44.asServiceRole.entities.DocumentVersion.create({
        documentId,
        sectionId: section.id,
        topicId: section.topicId,
        sectionOrder: section.order,
        content: section.content,
        changeDescription: `לפני: ${changeDescription || 'עריכת אדמין'}`,
        version: nextVersion,
        changeType: 'direct_edit',
        originalLanguage: section.originalLanguage || 'he',
      });

      // Update the section
      await base44.asServiceRole.entities.Section.update(section.id, {
        content: newContent,
        lastEditedBy: user.id,
        originalLanguage: newContentLanguage,
      });

      // Version with NEW content (after change)
      await base44.asServiceRole.entities.DocumentVersion.create({
        documentId,
        sectionId: section.id,
        topicId: section.topicId,
        sectionOrder: section.order,
        content: newContent,
        changeDescription: changeDescription || 'עריכת אדמין',
        version: nextVersion + 1,
        changeType: 'direct_edit',
        originalLanguage: newContentLanguage,
      });

      editLabel = changeDescription || 'עריכת אדמין';
      notificationTitleKey = 'adminEditSectionTitle';
      notificationMessageKey = 'adminEditSectionMessage';

    // ── new_section ──
    } else if (editType === 'new_section') {
      let targetTopicId = topicId;

      // Create new topic if requested
      if (!targetTopicId && newTopicTitle) {
        const existingTopics = await base44.asServiceRole.entities.Topic.filter({ documentId }, 'order');
        const maxOrder = existingTopics.length > 0 ? Math.max(...existingTopics.map(t => t.order || 0)) : -1;
        const newTopic = await base44.asServiceRole.entities.Topic.create({
          documentId,
          title: newTopicTitle,
          order: maxOrder + 1,
          originalLanguage: detectLanguage(newTopicTitle),
        });
        targetTopicId = newTopic?.id;
      }

      if (!targetTopicId) {
        return Response.json({ error: 'No topicId for new section' }, { status: 400 });
      }

      // Compute insertion order with shifting
      const allSections = await base44.asServiceRole.entities.Section.filter({ documentId, topicId: targetTopicId });
      let newOrder;
      if (insertPosition !== undefined && insertPosition !== null) {
        newOrder = Math.floor(insertPosition);
        const sectionsToShift = allSections.filter(s => s.order >= newOrder);
        if (sectionsToShift.length > 0) {
          await Promise.all(
            sectionsToShift.map(s => base44.asServiceRole.entities.Section.update(s.id, { order: s.order + 1 }))
          );
        }
      } else {
        newOrder = allSections.length > 0 ? Math.max(...allSections.map(s => s.order || 0)) + 1 : 0;
      }

      const newContentLanguage = detectLanguage(newContent || '');
      const newSection = await base44.asServiceRole.entities.Section.create({
        documentId,
        topicId: targetTopicId,
        content: newContent,
        order: newOrder,
        lastEditedBy: user.id,
        originalLanguage: newContentLanguage,
      });

      // Initial version for the new section
      await base44.asServiceRole.entities.DocumentVersion.create({
        documentId,
        sectionId: newSection.id,
        topicId: targetTopicId,
        sectionOrder: newOrder,
        content: newContent,
        changeDescription: changeDescription || 'סעיף חדש של אדמין',
        version: 1,
        changeType: 'direct_edit',
        originalLanguage: newContentLanguage,
      });

      editLabel = changeDescription || 'סעיף חדש';
      notificationTitleKey = 'adminNewSectionTitle';
      notificationMessageKey = 'adminNewSectionMessage';

    // ── delete_section ──
    } else if (editType === 'delete_section' && sectionId) {
      const section = await base44.asServiceRole.entities.Section.filter({ id: sectionId }).then(r => r[0]);
      if (!section) return Response.json({ error: 'Section not found' }, { status: 404 });

      const versions = await base44.asServiceRole.entities.DocumentVersion.filter({ sectionId: section.id });
      const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version || 0)) + 1 : 1;

      // Version with OLD content (before deletion)
      await base44.asServiceRole.entities.DocumentVersion.create({
        documentId,
        sectionId: section.id,
        topicId: section.topicId,
        sectionOrder: section.order,
        content: section.content,
        changeDescription: `לפני: מחיקת סעיף על ידי אדמין`,
        version: nextVersion,
        changeType: 'direct_edit',
        originalLanguage: section.originalLanguage || 'he',
      });

      // Delete the section
      await base44.asServiceRole.entities.Section.delete(section.id);

      // Handle orphaned suggestions — anchor them to their original position
      const orphaned = await base44.asServiceRole.entities.Suggestion.filter({
        documentId,
        status: 'pending',
        sectionId: section.id,
      });
      if (orphaned.length > 0) {
        await Promise.all(
          orphaned.map(s =>
            base44.asServiceRole.entities.Suggestion.update(s.id, {
              topicId: s.topicId || section.topicId,
              originalSectionOrder: section.order,
            })
          )
        );
      }

      // Version with empty content (after deletion)
      await base44.asServiceRole.entities.DocumentVersion.create({
        documentId,
        sectionId: section.id,
        topicId: section.topicId,
        sectionOrder: section.order,
        content: '',
        changeDescription: 'מחיקת סעיף על ידי אדמין',
        version: nextVersion + 1,
        changeType: 'direct_edit',
      });

      editLabel = 'מחיקת סעיף';
      notificationTitleKey = 'adminDeleteSectionTitle';
      notificationMessageKey = 'adminDeleteSectionMessage';
      notificationType = 'section_deleted';

    // ── edit_topic ──
    } else if (editType === 'edit_topic' && topicId) {
      const topic = await base44.asServiceRole.entities.Topic.filter({ id: topicId }).then(r => r[0]);
      if (!topic) return Response.json({ error: 'Topic not found' }, { status: 404 });

      const originalTitle = topic.title;
      const trimmedNewTitle = newTitle.trim();

      await base44.asServiceRole.entities.Topic.update(topicId, { title: trimmedNewTitle });

      // Create a version record for the topic title change (same format as community-voted changes).
      // Uses the topic's first section as the required sectionId, matching useTopicVoteMutation.
      const topicSections = await base44.asServiceRole.entities.Section.filter({ topicId });
      const firstSectionId = topicSections[0]?.id;
      if (firstSectionId) {
        const latestVersions = await base44.asServiceRole.entities.DocumentVersion.filter({ documentId }, '-version', 1);
        const nextVersion = latestVersions.length > 0 ? (latestVersions[0].version || 0) + 1 : 1;

        await base44.asServiceRole.entities.DocumentVersion.create({
          documentId,
          sectionId: firstSectionId,
          topicId,
          content: `topic_title_change:${topicId}:${originalTitle}:${trimmedNewTitle}`,
          changeDescription: `כותרת נושא עודכנה: ${originalTitle} → ${trimmedNewTitle}`,
          version: nextVersion,
          changeType: 'direct_edit',
          originalLanguage: detectLanguage(trimmedNewTitle),
        });
      }

      editLabel = `${originalTitle} → ${trimmedNewTitle}`;
      notificationTitleKey = 'adminEditTopicTitle';
      notificationMessageKey = 'adminEditTopicMessage';

    } else {
      return Response.json({ error: 'Invalid editType or missing parameters' }, { status: 400 });
    }

    // ── Send notifications to all document participants ──
    // (Same participant set as processAcceptanceV4, but NO consensus meter update)
    const contributorIds = await gatherParticipantIds(base44, documentId, document);
    // Don't notify the admin who made the edit
    contributorIds.delete(user.id);

    let allUsers = [];
    if (contributorIds.size > 0) {
      const idArray = filterValidObjectIds(Array.from(contributorIds));
      if (idArray.length > 0) {
        allUsers = await base44.asServiceRole.entities.User.filter({ id: { $in: idArray } });
      }
    }

    const adminName = user.full_name || 'Admin';
    const replacements = { title: editLabel, doc: document.title, name: adminName };
    const translations = buildTranslations(notificationTitleKey, notificationMessageKey, replacements);

    const notifications = allUsers.map(u => ({
      userId: u.id,
      type: notificationType,
      title: t(u.preferredLanguage || 'he', notificationTitleKey, replacements),
      message: t(u.preferredLanguage || 'he', notificationMessageKey, replacements),
      translations,
      relatedEntityId: documentId,
      relatedEntityType: 'document',
      actionUrl: `/documentview?id=${documentId}`,
    }));

    if (notifications.length > 0) {
      try {
        await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
        console.log('[APPLY ADMIN EDIT] Sent', notifications.length, 'notifications');
      } catch (notifErr) {
        console.error('[APPLY ADMIN EDIT] Notification send failed:', notifErr);
      }
    }

    // NOTE: Deliberately NOT updating the consensus meter (consensuses, threshold,
    // totalUsersInteracted) — only community voting affects the consensus meter.

    return Response.json({
      success: true,
      editType,
      notificationsSent: notifications.length,
    });

  } catch (error) {
    console.error('[APPLY ADMIN EDIT ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}