// HMAC-SHA256 signing for email tracking URLs.
//
// trackEmailEvent is a public endpoint (called by email clients loading a
// tracking pixel or following a redirect link) so it cannot use session auth.
// Instead, sendDocumentSummaryEmail signs each logId with the internal
// automation token, and trackEmailEvent verifies the signature before
// incrementing counters. This prevents unauthorized callers from manipulating
// email analytics via the service-role EmailLog update.

import { INTERNAL_AUTOMATION_TOKEN } from "./internalToken.ts";

// Returns a base64url-safe HMAC-SHA256 signature for the given logId.
export async function signLogId(logId) {
  if (!INTERNAL_AUTOMATION_TOKEN || !logId) return "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(INTERNAL_AUTOMATION_TOKEN),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(logId));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Verifies a signature returned by signLogId. Returns false on any mismatch.
export async function verifyLogId(logId, sig) {
  if (!INTERNAL_AUTOMATION_TOKEN || !sig) return false;
  const expected = await signLogId(logId);
  return expected === sig;
}