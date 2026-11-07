import React from "react";
import TranslateAllButton from "./TranslateAllButton";
import { useBatchTranslateAll } from "./hooks/useBatchTranslateAll";

/**
 * Wraps TranslateAllButton with the batch-translation handler.
 * Must be rendered inside a TranslationProvider so useBatchTranslateAll
 * can access setGlobalShowTranslated / setIsTranslatingAll from context.
 *
 * `suggestions` and `comments` are passed so the batch covers every piece of
 * user content on the page — proposal texts, explanations and comments —
 * not just the document header and sections.
 */
export default function DocumentTranslateAllButton({
  document,
  topics,
  sections,
  suggestions,
  comments,
  className,
}) {
  const handleTranslateAll = useBatchTranslateAll({ document, topics, sections, suggestions, comments });
  return (
    <TranslateAllButton
      document={document}
      onActivate={handleTranslateAll}
      className={className}
    />
  );
}