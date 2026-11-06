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

/** Records written by a backend function (service role) are prefixed like this. */
const SERVICE_OWNER_PREFIX = 'service_';

/** True when the record was created by a backend function, not by a browser. */
export function isServiceOwned(ownerId) {
  return typeof ownerId === 'string' && ownerId.startsWith(SERVICE_OWNER_PREFIX);
}

/**
 * Verify that a user's group membership is legitimate (not self-forged).
 *
 * GroupMember.create is open and the author of a record may also update it,
 * so a record the user created themselves proves nothing — neither membership
 * nor admin status. A membership only counts when its provenance is verifiable:
 *
 *   1. The record was created by the group's creator, or by a backend function
 *      (service role — e.g. the approved-join-request and accepted-invitation
 *      flows in manageGroupMembership / acceptGroupInvitation).
 *   2. The record was created by someone who is themselves a trusted member of
 *      the group (the group creator, or a service-owned membership) — one level
 *      of transitivity, so members added by a group admin are trusted too.
 *   3. Backed by an accepted GroupInvitation created by the group creator or by
 *      a trusted member.
 *   4. Backed by an approved GroupJoinRequest. Approvals are only ever written
 *      by the admin-only update rule / the manageGroupMembership backend
 *      function, so a record created already-'approved' is rejected (creation
 *      RLS also restricts status to 'pending').
 *
 * Admin status is derived only from a record with the above provenance — never
 * from a self-created record's client-writable role field.
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

  // A record the user authored themselves can be minted (and later edited) at
  // will through the entity API, so it carries no trust.
  const isTrustedRecord = (m) => !!m.created_by_id && m.created_by_id !== user.id;
  const member = memberships.find(isTrustedRecord);

  // Is the author of a membership record itself trusted inside this group?
  const isTrustedAuthor = async (authorId) => {
    if (!authorId) return false;
    if (authorId === group.created_by_id || isServiceOwned(authorId)) return true;
    const authorMemberships = await base44.asServiceRole.entities.GroupMember
      .filter({ groupId, userId: authorId })
      .catch(() => []);
    return authorMemberships.some(
      m => m.created_by_id === group.created_by_id || isServiceOwned(m.created_by_id)
    );
  };

  let hasProvenance = false;

  // 1 + 2. Membership record with verifiable provenance
  if (member) {
    if (member.created_by_id === group.created_by_id || isServiceOwned(member.created_by_id)) {
      hasProvenance = true;
    } else if (await isTrustedAuthor(member.created_by_id)) {
      hasProvenance = true;
    }
  }

  // 3. Backed by accepted GroupInvitation with provenance
  if (!hasProvenance && user.email) {
    const invitations = await base44.asServiceRole.entities.GroupInvitation
      .filter({ groupId, email: user.email, status: 'accepted' })
      .catch(() => []);
    for (const inv of invitations) {
      if (inv.created_by_id === group.created_by_id || isServiceOwned(inv.created_by_id)) {
        hasProvenance = true;
        break;
      }
      // Inviter must itself be a trusted member of the group
      if (await isTrustedAuthor(inv.created_by_id)) {
        hasProvenance = true;
        break;
      }
    }
  }

  // 4. Backed by an approved GroupJoinRequest. A request created already
  // 'approved' was forged (approval is always an update by the backend
  // function), so require that it was modified after creation.
  if (!hasProvenance) {
    const requests = await base44.asServiceRole.entities.GroupJoinRequest
      .filter({ groupId, userId: user.id, status: 'approved' })
      .catch(() => []);
    hasProvenance = requests.some(
      r => new Date(r.updated_date || 0).getTime() > new Date(r.created_date || 0).getTime()
    );
  }

  if (!hasProvenance) return { isMember: false, isAdmin: false };

  // Admin status only from a record whose role could not be self-assigned.
  return { isMember: true, isAdmin: !!member && member.role === 'admin' };
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