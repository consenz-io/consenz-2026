import React, { useMemo } from "react";
import { useLanguage } from "@/components/LanguageContext";
import { computeChangeBlockDiff } from "./changeBlockDiff";

/**
 * ChangeBlockDiffView — renders a change-block diff between two HTML strings.
 *
 * Each change-block is rendered as the old phrase (struck through, soft red)
 * immediately followed by the new phrase (highlighted, soft green) with no
 * separating whitespace, so the reader sees "replaced" as one move.
 * Rich-text formatting (bold, links, headings, lists) is preserved.
 */
export default function ChangeBlockDiffView({
  originalContent,
  newContent,
  className = "",
  style,
}) {
  const { isRTL } = useLanguage();

  const segments = useMemo(
    () => computeChangeBlockDiff(originalContent || "", newContent || ""),
    [originalContent, newContent]
  );

  const hasChanges = segments.some(
    (s) => s.type === "changed" || s.type === "added" || s.type === "removed" || s.type === "removed-block"
  );

  const baseStyle = {
    direction: isRTL ? "rtl" : "ltr",
    textAlign: isRTL ? "right" : "left",
    fontFamily: "'Times New Roman', 'David Libre', 'Noto Serif', Georgia, serif",
    fontSize: "1.125rem",
    lineHeight: "1.8",
    ...style,
  };

  if (!hasChanges) {
    return (
      <div
        className={className}
        style={baseStyle}
        dangerouslySetInnerHTML={{ __html: newContent || originalContent || "" }}
      />
    );
  }

  return (
    <div
      className={className}
      style={{ ...baseStyle, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
    >
      {segments.map((seg, idx) => {
        if (seg.type === "changed") {
          return (
            <span key={idx} className="change-block">
              <span
                className="bg-[#fef2f2] text-red-700 line-through opacity-80 rounded-[3px] px-[1px]"
                dangerouslySetInnerHTML={{ __html: seg.oldHtml }}
              />
              <span
                className="bg-[#dcfce7] text-green-800 font-medium rounded-[3px] px-[1px] border-b border-green-400/60"
                dangerouslySetInnerHTML={{ __html: seg.newHtml }}
              />
            </span>
          );
        }
        if (seg.type === "removed" || seg.type === "removed-block") {
          return (
            <span
              key={idx}
              className="bg-[#fef2f2] text-red-700 line-through opacity-80 rounded-[3px] px-[1px]"
              dangerouslySetInnerHTML={{ __html: seg.html }}
            />
          );
        }
        if (seg.type === "added") {
          return (
            <span
              key={idx}
              className="bg-[#dcfce7] text-green-800 font-medium rounded-[3px] px-[1px] border-b border-green-400/60"
              dangerouslySetInnerHTML={{ __html: seg.html }}
            />
          );
        }
        // unchanged / space / block — render raw html
        return (
          <span
            key={idx}
            dangerouslySetInnerHTML={{ __html: seg.html }}
          />
        );
      })}
    </div>
  );
}