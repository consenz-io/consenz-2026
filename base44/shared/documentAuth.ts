/**
 * Verify that a user is authorized to perform privileged operations on a
 * document. Authorization is based on non-client-writable data only:
 *
 *   1. System admin role (user.role === 'admin')
 *   2. Document ownership (document.created_by_id === user.id)
 *   3. A DocumentAdmin record that was created by the document's original
 *      creator (docAdmin.created_by_id === document.created_by_id).
 *
 * The DocumentAdmin entity's create rule is open, so any user could self-
 * grant a record naming themselves admin of any document. We defend against
 * this by checking that the DocumentAdmin record was created by the
 * document's original creator — created_by_id is set by the platform based
 * on the authenticated creator and is not client-writable.
 *
 * Returns { authorized, document, notFound }.
 */
export async function checkDocumentAuthorization(base44, documentId, user) {
  const document = await base44.asServiceRole.entities.Document
    .filter({ id: documentId })
    .then(r => r[0])
    .catch(() => null);

  if (!document) {
    return { authorized: false, document: null, notFound: true };
  }

  if (user.role === 'admin' || document.created_by_id === user.id) {
    return { authorized: true, document };
  }

  const docAdmins = await base44.asServiceRole.entities.DocumentAdmin
    .filter({ documentId, userId: user.id });

  const hasValidAdmin = docAdmins.some(
    da => da.created_by_id === document.created_by_id
  );

  return { authorized: hasValidAdmin, document };
}

/**
 * Verify that a user's group membership is legitimate (not self-forged).
 * GroupMember.create RLS allows any user to mint a record with arbitrary
 * groupId/userId/role. We only trust a membership if it was established
 * through a verified flow:
 *
 *   1. The membership record was created by the group's creator
 *      (member.created_by_id === group.created_by_id)
 *   2. Backed by an accepted GroupInvitation that was created by the group's
 *      creator, or by a user whose own membership was created by the group
 *      creator (transitively trusted, no recursion)
 *   3. Backed by an approved GroupJoinRequest (self-approval is prevented
 *      by tightened update RLS)
 *
 * Returns { isMember, isAdmin }.
 */
export async function verifyGroupMembership(base44, group, user) {
  if (user.role === 'admin') return { isMember: true, isAdmin: true };
  if (group.created_by_id === user.id) return { isMember: true, isAdmin: true };

  const groupId = group.id;
  const memberships = await base44.asServiceRole.entities.GroupMember
    .filter({ groupId, userId: user.id })
    .catch(() => []);

  if (memberships.length === 0) return { isMember: false, isAdmin: false };

  const member = memberships[0];
  let hasProvenance = false;

  // 1. Created by group creator
  if (member.created_by_id === group.created_by_id) {
    hasProvenance = true;
  }

  // 2. Backed by accepted GroupInvitation with provenance
  if (!hasProvenance && user.email) {
    const invitations = await base44.asServiceRole.entities.GroupInvitation
      .filter({ groupId, email: user.email, status: 'accepted' })
      .catch(() => []);
    for (const inv of invitations) {
      if (inv.created_by_id === group.created_by_id) {
        hasProvenance = true;
        break;
      }
      // Inviter must have a membership created by the group creator
      const inviterMemberships = await base44.asServiceRole.entities.GroupMember
        .filter({ groupId, userId: inv.created_by_id })
        .catch(() => []);
      if (inviterMemberships.some(m => m.created_by_id === group.created_by_id)) {
        hasProvenance = true;
        break;
      }
    }
  }

  // 3. Backed by approved GroupJoinRequest
  if (!hasProvenance) {
    const requests = await base44.asServiceRole.entities.GroupJoinRequest
      .filter({ groupId, userId: user.id, status: 'approved' })
      .catch(() => []);
    if (requests.length > 0) {
      hasProvenance = true;
    }
  }

  if (!hasProvenance) return { isMember: false, isAdmin: false };

  return { isMember: true, isAdmin: member.role === 'admin' };
}

/**
 * Verify that a user can access a document, considering group privacy.
 * If the document belongs to a private or hidden group, the user must be
 * a member. Public groups and documents without a group are accessible to
 * all authenticated users.
 *
 * Returns { authorized: boolean, reason?: string }.
 */
export async function checkDocumentAccess(base44, document, user) {
  // Admins can access everything
  if (user.role === 'admin') return { authorized: true };

  // No group — accessible to all authenticated users
  if (!document.groupId) return { authorized: true };

  // Fetch the group to check privacy status
  const groups = await base44.asServiceRole.entities.Group
    .filter({ id: document.groupId })
    .catch(() => []);

  if (groups.length === 0) return { authorized: true };

  const group = groups[0];

  // Public group — accessible to all
  if (group.status !== 'private' && group.status !== 'hidden') {
    return { authorized: true };
  }

  // Private/hidden group — verify membership with provenance
  const { isMember } = await verifyGroupMembership(base44, group, user);
  return { authorized: isMember, reason: isMember ? undefined : 'Forbidden' };
}