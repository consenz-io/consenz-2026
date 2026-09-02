import React from "react";

/**
 * Unified document-title heading.
 *
 * Shared by every page where the document title is the primary page heading
 * (DocumentView via DocumentHeader, and DocumentCleanView). Keeps the title in
 * the same editorial serif family used for document body content, with one
 * consistent size, weight, color, and alignment across the app.
 */
const DOCUMENT_TITLE_FONT =
"'Times New Roman', 'David Libre', 'Noto Serif', Georgia, serif";

export default function DocumentTitleHeading({ children, id, className = "" }) {
  return (
    <h1
      id={id}
      className={`text-slate-900 flex-1 min-w-0 max-w-full break-words leading-tight text-3xl md:text-3xl [font-family:'Noto_Serif',_serif] font-normal ${className}`}
      style={{ fontFamily: DOCUMENT_TITLE_FONT }}>
      
      {children}
    </h1>);

}