import { base44 } from "@/api/base44Client";

/**
 * Automatically adds user to group membership if they participated in any document in that group
 * This function should be called after user performs a qualifying action (vote, comment, sign)
 * 
 * @param {string} userId - User ID
 * @param {string} documentId - Document ID where user participated
 */
export async function autoAddToGroup(userId, documentId) {
  try {
    // Get document to find its group
    const documents = await base44.entities.Document.filter({ id: documentId });
    if (documents.length === 0 || !documents[0].groupId) {
      return; // Document not in a group
    }
    
    const groupId = documents[0].groupId;
    
    // Check if user is already a member
    const existingMemberships = await base44.entities.GroupMember.filter({ 
      groupId, 
      userId 
    });
    
    if (existingMemberships.length > 0) {
      return; // Already a member
    }
    
    // Add user as member with 'member' role
    await base44.entities.GroupMember.create({
      groupId,
      userId,
      role: 'member'
    });
    
    console.log('[AUTO-ADD-TO-GROUP] Added user', userId, 'to group', groupId);
  } catch (error) {
    console.error('[AUTO-ADD-TO-GROUP] Error adding user to group:', error);
  }
}