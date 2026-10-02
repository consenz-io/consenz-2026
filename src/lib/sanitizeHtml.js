import DOMPurify from "dompurify";

// Sanitize user-authored rich-text HTML before rendering via
// dangerouslySetInnerHTML or document.write. Strips scripts, event
// handlers, iframe/embed/object/srcdoc, javascript: URLs, and other
// XSS vectors while preserving safe formatting tags (<p>, <strong>,
// <em>, <a>, lists, headings, images, tables, etc.).
//
// Used by every sink that renders stored document/suggestion/section
// content as markup — the single chokepoint for the stored-XSS surface.
export function sanitizeHtml(html) {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: [
      "style", "iframe", "object", "embed", "form", "input", "button",
      "textarea", "select", "base", "link", "meta", "math", "svg",
    ],
    FORBID_ATTR: ["srcdoc"],
  });
}