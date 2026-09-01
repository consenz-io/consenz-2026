// Authorization gate for service-role backend functions that are invoked
// internally (by other functions via asServiceRole.functions.invoke) but are
// also HTTP-reachable. Such functions perform destructive service-role
// mutations and must not be callable by anonymous external callers.
//
// Accepts either:
//   1. An authenticated user session (base44.auth.me() resolves), or
//   2. The internal automation token in the request body (body.internalToken),
//      passed by internal callers (other functions) that have no user session.
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
  if (!user && !tokenOk) {
    return { ok: false, user: null, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true, user, response: null };
}

export { INTERNAL_AUTOMATION_TOKEN };