import React from "react";
import { motion } from "framer-motion";
import { ThumbsUp, ThumbsDown } from "lucide-react";

const LABELS = {
  he: { threshold: "סף", short: (n) => `לא הגיע לסף — חסרו ${n} תומכים`, reached: "הגיע לסף התמיכה" },
  ar: { threshold: "العتبة", short: (n) => `لم يصل للعتبة — نقص ${n} مؤيدين`, reached: "وصل إلى عتبة الدعم" },
  en: { threshold: "Threshold", short: (n) => `Did not reach threshold — ${n} supporters short`, reached: "Reached the support threshold" },
};

/**
 * Consensus-threshold bar for a closed (rejected) suggestion — same visual
 * language as VotingProgressSection, with the threshold frozen at rejection time.
 */
export default function RejectedSuggestionThreshold({ suggestion, document, language }) {
  const labels = LABELS[language] || LABELS.en;
  const isRTL = language === "he" || language === "ar";
  const isDeleteSection = suggestion?.type === "delete_section";

  const proVotes = suggestion?.proVotes || 0;
  const conVotes = suggestion?.conVotes || 0;
  const displayPro = isDeleteSection ? conVotes : proVotes;
  const displayCon = isDeleteSection ? proVotes : conVotes;

  const delta = proVotes - conVotes;
  const threshold = Math.max(
    2,
    suggestion?.thresholdAtRejection != null ? suggestion.thresholdAtRejection : document?.threshold || 2
  );
  const progressPercent = Math.min(100, Math.max(0, (delta / threshold) * 100));
  const votesNeeded = Math.max(0, threshold - delta);
  const passed = delta >= threshold;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
      <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
        <motion.div
          className={`absolute inset-y-0 ${isRTL ? "right-0" : "left-0"} rounded-full ${passed ? "bg-green-500" : "bg-red-400"}`}
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <ThumbsUp className="w-3 h-3" />
          {displayPro}
        </span>
        <span className="font-medium">
          {labels.threshold}: {threshold}
        </span>
        <span className="flex items-center gap-1">
          {displayCon}
          <ThumbsDown className="w-3 h-3" />
        </span>
      </div>

      <p className="text-xs mt-2 font-medium text-slate-500 text-center">
        {passed ? labels.reached : labels.short(votesNeeded)}
      </p>
    </div>
  );
}