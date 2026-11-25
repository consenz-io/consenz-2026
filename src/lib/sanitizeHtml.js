import DOMPurify from "dompurify";

// Sanitize user-authored rich-text HTML before rendering via
// dangerouslySetInnerHTML or document.write. Strips scripts, event
// handlers, iframe/embed/object/srcdoc, javascript: URLs, and other
// XSS vectors while preserving safe formatting tags (<p>, <strong>,
// <em>, <a>, lists, headings, images, tables, etc.).
//
// Used by every sink that renders stored document/suggestion/section
// content as markup — the single chokepoint for the stored-XSS surface.
// Memoized results. Rich-text content strings are stable API values that get
// re-sanitized on every re-render (a document page re-renders on each vote,
// scroll-threshold toggle and state change), and DOMPurify's HTML parse is by
// far the most expensive part of rendering a section. A bounded cache turns
// repeat renders into a Map lookup.
const CACHE_MAX_ENTRIES = 300;
const CACHE_MAX_CHARS = 2_000_000;
const cache = new Map();
let cacheChars = 0;

export function sanitizeHtml(html) {
  if (!html) return "";

  const cached = cache.get(html);
  if (cached !== undefined) return cached;

  const clean = DOMPurify.sanitize(html, {
    FORBID_TAGS: [
      "style", "iframe", "object", "embed", "form", "input", "button",
      "textarea", "select", "base", "link", "meta", "math", "svg",
    ],
    FORBID_ATTR: ["srcdoc"],
  });

  cache.set(html, clean);
  cacheChars += html.length;

  // Evict oldest entries first (Map keeps insertion order).
  while (cache.size > CACHE_MAX_ENTRIES || cacheChars > CACHE_MAX_CHARS) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
    cacheChars -= oldest.length;
    if (cache.size === 0) break;
  }

  return clean;
}