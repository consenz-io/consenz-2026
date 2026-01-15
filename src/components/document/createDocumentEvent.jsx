import { base44 } from "@/api/base44Client";

/**
 * Helper function to create document events for the activity log
 */
export async function createDocumentEvent({
  documentId,
  eventType,
  userId,
  userEmail,
  userName,
  relatedEntityId = null,
  relatedEntityType = null,
  summary,
  details = {}
}) {
  try {
    await base44.entities.DocumentEvent.create({
      documentId,
      eventType,
      userId,
      userEmail,
      userName,
      relatedEntityId,
      relatedEntityType,
      summary,
      details
    });
  } catch (error) {
    console.error('[DOCUMENT EVENT] Failed to create event:', error);
    // Don't throw - events should not block the main flow
  }
}