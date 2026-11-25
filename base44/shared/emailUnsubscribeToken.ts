// HMAC-signed tokens for the email opt-out link.
//
// The unsubscribe link is followed from an email client, in a browser that may
// not be signed in, so it cannot rely on a session. Each link carries a token
// that binds one user id and email address, signed with the internal automation
// token; unsubscribeEmail verifies it before turning email off for that user.

import { INTERNAL_AUTOMATION_TOKEN } from "./internalToken.ts";

const encoder = new TextEncoder();

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value) {
  return atob(value.replace(/-/g, "+").replace(/_/g, "/"));
}

export async function signUnsubscribeToken(userId, email) {
  if (!INTERNAL_AUTOMATION_TOKEN || !userId || !email) return "";
  const payload = `${userId}|${String(email).toLowerCase().trim()}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(INTERNAL_AUTOMATION_TOKEN),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`unsubscribe:${payload}`));
  return `${toBase64Url(encoder.encode(payload))}.${toBase64Url(sig)}`;
}

// Returns { userId, email } for a valid token, or null.
export async function verifyUnsubscribeToken(token) {
  if (!INTERNAL_AUTOMATION_TOKEN || !token || typeof token !== "string") return null;
  const [payloadPart, sigPart] = token.split(".");
  if (!payloadPart || !sigPart) return null;

  let payload;
  try {
    payload = fromBase64Url(payloadPart);
  } catch {
    return null;
  }

  const [userId, email] = payload.split("|");
  if (!userId || !email) return null;

  const expected = await signUnsubscribeToken(userId, email);
  if (!expected || expected !== token) return null;

  return { userId, email };
}