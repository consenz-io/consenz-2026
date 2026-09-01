import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Preview-style rendering of rich-text (HTML) content: shows the first few
 * lines by default with a soft gradient fade, and a toggle to reveal the rest.
 * Used for document descriptions in list rows where vertical space is limited.
 *
 * Overflow is detected by measuring the rendered content, so the toggle only
 * appears when the content actually exceeds the preview height (no char-length
 * guesswork, works across viewport widths).
 */
export default function TranslatablePreview({
  content,
  className = "",
  isRTL = false,
  language = "he",
  maxLines = 5,
}) {
  const [showFull, setShowFull] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // scrollHeight is the full content height even while clamped by maxHeight,
    // so this works whether the preview is collapsed or expanded.
    const lineHeight = parseFloat(window.getComputedStyle(el).lineHeight) || 20;
    const clampedHeight = maxLines * lineHeight;
    setIsOverflowing(el.scrollHeight > clampedHeight + 2);
  }, [content, maxLines]);

  const moreText = language === "he" ? "הצג עוד" : language === "ar" ? "عرض المزيد" : "Show more";
  const lessText = language === "he" ? "הצג פחות" : language === "ar" ? "عرض أقل" : "Show less";

  return (
    <div className="relative">
      <div
        ref={ref}
        className={className}
        style={showFull ? undefined : { maxHeight: `${maxLines * 1.25}rem`, overflow: "hidden" }}
        dangerouslySetInnerHTML={{ __html: content }}
        dir={isRTL ? "rtl" : "ltr"}
      />
      {!showFull && isOverflowing && (
        <div
          className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none"
          aria-hidden="true"
        />
      )}
      {isOverflowing && (
        <Button
          variant="link"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowFull((s) => !s);
          }}
          className="mt-1 p-0 h-auto text-blue-600 hover:text-blue-800"
        >
          {showFull ? lessText : moreText}
        </Button>
      )}
    </div>
  );
}