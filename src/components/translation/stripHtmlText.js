// Turns stored rich-text HTML into the plain text a reviewer reads.
// Document sections, suggestions and comments are saved as HTML, so showing
// the raw string in the review queue leaked tags like <p> into the wording.
export function stripHtmlText(value) {
  if (!value) return "";
  const raw = String(value);
  if (!/[<&]/.test(raw)) return raw;
  const doc = new DOMParser().parseFromString(raw, "text/html");
  return (doc.body.textContent || "").replace(/\u00a0/g, " ");
}

export function toPreview(value, limit = 160) {
  const plain = stripHtmlText(value).replace(/\s+/g, " ").trim();
  if (!plain) return null;
  return plain.length > limit ? `${plain.slice(0, limit).trim()}…` : plain;
}