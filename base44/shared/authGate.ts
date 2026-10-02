// Authorization gate for service-role backend functions that are invoked
// internally (by other functions via asServiceRole.functions.invoke) but are
// also HTTP-reachable. Such functions perform destructive service-role
// mutations and must not be callable by arbitrary authenticated users.
//
// Accepts either:
//   1. An admin user session (base44.auth.me() resolves with role 'admin'), or
//   2. The internal automation token in the request body (body.internalToken),
//      passed by internal callers (other functions) that have no user session.
//
// Regular (non-admin) authenticated users are rejected — they should go through
// the vote endpoints (voteOnSuggestion/V2), which call these functions
// internally with the token, not invoke them directly.
//
// Usage:
//   const body = await req.json();
//   const { ok, user, response } = await authorizeInternalOrUser(base44, body);
//   if (!ok) return response;
import { secrets } from "base44:runtime";

const INTERNAL_AUTOMATION_TOKEN = secrets.get("INTERNAL_AUTOMATION_TOKEN") ?? "";

export async function authorizeInternalOrUser(base44, body) {
  let user = null;
  try { user = await base44.auth.me(); } catch {}
  const tokenOk = !!body?.internalToken && body.internalToken === INTERNAL_AUTOMATION_TOKEN;
  const isAdmin = user?.role === 'admin';
  if (!isAdmin && !tokenOk) {
    return { ok: false, user: null, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true, user, response: null };
}

export { INTERNAL_AUTOMATION_TOKEN };