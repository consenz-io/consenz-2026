import React, { useState } from "react";
import { useLanguage } from "@/components/LanguageContext";

/**
 * A drop zone for empty slots where no suggestion cards exist.
 * Admin-only — renders nothing for non-admins.
 *
 * Props:
 * - onDrop: (draggedSuggestionId, newInsertPosition) => void
 * - getPosition: () => number  — computes the insertPosition for this slot
 * - isAdmin: boolean
 */
export default function SuggestionDropZone({ onDrop, getPosition, isAdmin }) {
  const { isRTL, language } = useLanguage();
  const [isOver, setIsOver] = useState(false);

  if (!isAdmin) return null;

  return null;


























}