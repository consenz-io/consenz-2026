import React, { useEffect, useRef } from "react";
import { useVersionTranslation } from "./hooks/useVersionTranslation";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { Loader2 } from "lucide-react";
import ChangeBlockDiffView from "./ChangeBlockDiffView";

/**
 * Displays historical (non-current) section content with translation support.
 *
 * When `showTranslated` is true, auto-translates the content using the
 * canonical Translation entity (sourceEntityType: 'version') and displays
 * the translated version. Uses a synthetic sourceEntityId (sectionId +
 * versionIndex) so the cache key is separate from the current section
 * content's key (section:{id}:current), preventing cache thrashing.
 */
export function HistoryTranslatableContent({
  content,
  documentId,
  sourceEntityId,
  showTranslated,
  className,
  style,
  onClick,
}) {
  const {
    translatedContent,
    isTranslating,
    needsTranslation,
    translate,
  } = useVersionTranslation({
    documentId,
    sourceEntityType: "version",
    sourceEntityId,
    sourceField: "content",
    content,
    isHtml: true,
    globalShowTranslated: showTranslated,
  });

  // Track which content we've already requested — reset whenever the content
  // changes (the component stays mounted while browsing between versions).
  const initiatedFor = useRef(null);
  const requestKey = `${sourceEntityId}|${content}`;
  useEffect(() => {
    if (showTranslated && needsTranslation && !translatedContent && !isTranslating && initiatedFor.current !== requestKey) {
      initiatedFor.current = requestKey;
      translate();
    }
  }, [showTranslated, needsTranslation, translatedContent, isTranslating, translate, requestKey]);

  const isValid = translatedContent && translatedContent.length > 1;
  const displayContent = showTranslated && isValid ? translatedContent : content;

  if (isTranslating && showTranslated && !isValid) {
    return (
      <div className={`flex items-center justify-center py-4 ${className || ""}`} style={style}>
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div
      className={className}
      style={style}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayContent) }}
    />
  );
}

/**
 * Displays a historical diff (old vs new content) with translation support.
 * Translates both old and new content when `showTranslated` is true, then
 * passes them to ChangeBlockDiffView.
 */
export function HistoryTranslatableDiff({
  originalContent,
  newContent,
  documentId,
  sourceEntityIdBase,
  showTranslated,
  className,
  style,
}) {
  const oldTranslation = useVersionTranslation({
    documentId,
    sourceEntityType: "version",
    sourceEntityId: `${sourceEntityIdBase}_old`,
    sourceField: "content",
    content: originalContent,
    isHtml: true,
    globalShowTranslated: showTranslated,
  });

  const newTranslation = useVersionTranslation({
    documentId,
    sourceEntityType: "version",
    sourceEntityId: `${sourceEntityIdBase}_new`,
    sourceField: "content",
    content: newContent,
    isHtml: true,
    globalShowTranslated: showTranslated,
  });

  const initiatedFor = useRef(null);
  const requestKey = `${sourceEntityIdBase}|${originalContent}|${newContent}`;
  useEffect(() => {
    if (!showTranslated || initiatedFor.current === requestKey) return;
    initiatedFor.current = requestKey;
    if (oldTranslation.needsTranslation && !oldTranslation.translatedContent && !oldTranslation.isTranslating) {
      oldTranslation.translate();
    }
    if (newTranslation.needsTranslation && !newTranslation.translatedContent && !newTranslation.isTranslating) {
      newTranslation.translate();
    }
  }, [showTranslated, requestKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const oldValid = oldTranslation.translatedContent && oldTranslation.translatedContent.length > 1;
  const newValid = newTranslation.translatedContent && newTranslation.translatedContent.length > 1;
  const displayOriginal = showTranslated && oldValid ? oldTranslation.translatedContent : originalContent;
  const displayNew = showTranslated && newValid ? newTranslation.translatedContent : newContent;

  if (showTranslated && (oldTranslation.isTranslating || newTranslation.isTranslating) && (!oldValid || !newValid)) {
    return (
      <div className={`flex items-center justify-center py-4 ${className || ""}`} style={style}>
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <ChangeBlockDiffView
      originalContent={displayOriginal}
      newContent={displayNew}
      className={className}
      style={style}
    />
  );
}