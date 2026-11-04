import { base44 } from "@/api/base44Client";

// Hard limit for the similarity check before the UI lets the user continue.
export const SIMILAR_CHECK_TIMEOUT_MS = 25000;

export function plainText(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export async function findSimilarProposals(payload) {
  const response = await Promise.race([
    base44.functions.invoke("findSimilarProposals", payload),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("SIMILAR_CHECK_TIMEOUT")), SIMILAR_CHECK_TIMEOUT_MS)
    ),
  ]);

  if (!response?.data?.success) {
    throw new Error(response?.data?.error || "similar_check_failed");
  }

  return response.data;
}