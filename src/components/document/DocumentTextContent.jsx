import React from "react";
import { useLanguage } from "@/components/LanguageContext";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

// Memoized: the props are primitives, so a section's HTML is only re-rendered
// (and re-sanitized) when its content or language direction actually changes,
// not on every parent state change.
const DocumentTextContent = React.memo(function DocumentTextContent({ content, className = "" }) {
  const { isRTL } = useLanguage();
  
  return (
    <div 
      className={`document-content text-base md:text-xl ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
      style={{
        fontFamily: "var(--font-document)",
        lineHeight: "1.8",
        letterSpacing: "0.01em",
        fontWeight: "400",
        textAlign: isRTL ? "right" : "left"
      }}
    />
  );
});

export default DocumentTextContent;