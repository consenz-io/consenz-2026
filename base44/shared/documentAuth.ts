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