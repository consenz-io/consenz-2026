import React from "react";
import { useLanguage } from "@/components/LanguageContext";

export default function DocumentTextContent({ content, className = "" }) {
  const { isRTL } = useLanguage();
  
  return (
    <div 
      className={`document-content ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
      style={{
        fontFamily: "var(--font-document)",
        fontSize: "1.375rem",
        lineHeight: "1.8",
        letterSpacing: "0.01em",
        fontWeight: "400",
        textAlign: isRTL ? "right" : "left"
      }}
    />
  );
}