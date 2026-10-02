import React from "react";
import { useLanguage } from "@/components/LanguageContext";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

export default function DocumentTextContent({ content, className = "" }) {
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
}