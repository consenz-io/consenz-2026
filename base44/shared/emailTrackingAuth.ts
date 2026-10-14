// HMAC-SHA256 signing for email tracking URLs.
//
// trackEmailEvent is a public endpoint (called by email clients loading a
// tracking pixel or following a redirect link) so it cannot use session auth.
// Instead, sendDocumentSummaryEmail signs each logId+type with the internal
// automation token, and trackEmailEvent verifies the signature before
// incrementing counters. This prevents unauthorized callers from manipulating
// email analytics via the service-role EmailLog update.
//
// The signature covers BOTH the logId and the event type (open|click), so a
// recipient cannot reuse a valid open-pixel URL to register a click (or vice
// versa) by editing the `type` query parameter.

import { INTERNAL_AUTOMATION_TOKEN } from "./internalToken.ts";

// Returns a base64url-safe HMAC-SHA256 signature for the given logId+type.
export async function signLogId(logId, type) {
  if (!INTERNAL_AUTOMATION_TOKEN || !logId || !type) return "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(INTERNAL_AUTOMATION_TOKEN),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${logId}:${type}`));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Verifies a signature returned by signLogId. Returns false on any mismatch.
export async function verifyLogId(logId, type, sig) {
  if (!INTERNAL_AUTOMATION_TOKEN || !sig) return false;
  const expected = await signLogId(logId, type);
  return expected === sig;
}