import React from "react";
import { useLanguage } from "@/components/LanguageContext";

export default function DocumentTextContent({ content, className = "" }) {
  const { isRTL } = useLanguage();
  
  return (
    <div 
      className={`document-content ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
      style={{
        fontFamily: "'Times New Roman', 'David Libre', 'Noto Serif', Georgia, serif",
        fontSize: "1.125rem",
        lineHeight: "1.8",
        letterSpacing: "0.01em",
        fontWeight: "400",
        direction: isRTL ? "rtl" : "ltr",
        textAlign: isRTL ? "right" : "left"
      }}
    />
  );
}