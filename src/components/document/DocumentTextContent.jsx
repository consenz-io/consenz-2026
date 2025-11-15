import React from "react";

export default function DocumentTextContent({ content, className = "" }) {
  return (
    <div 
      className={`document-content ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
      style={{
        fontFamily: "'Amiri', 'Noto Serif Hebrew', 'Noto Serif', Georgia, serif",
        fontSize: "1.125rem",
        lineHeight: "1.8",
        letterSpacing: "0.01em"
      }}
    />
  );
}