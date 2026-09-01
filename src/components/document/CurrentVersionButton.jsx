import React from "react";
import { FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseUserDate } from "@/components/utils/dateFormatter";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

/**
 * "Consensus Version" button — opens the current-version modal.
 * Placed below the document description. Compact outline style: prominent
 * enough to draw attention to the fact that there is a tangible product of
 * the process, without dominating the title hierarchy.
 *
 * The explanatory subtext + "as of" date live in a tooltip (per design call)
 * to convey the living/dynamic nature of the consensus.
 */
export default function CurrentVersionButton({ onClick, language, isRTL, lastVersionDate }) {
  const label =
    language === "he"
      ? "לצפייה בגרסת ההסכמה העדכנית"
      : language === "ar"
      ? "لعرض نسخة التوافق الحديثة"
      : "View the latest consensus version";

  const dateStr = lastVersionDate
    ? parseUserDate(lastVersionDate).toLocaleString(
        language === "he" ? "he-IL" : language === "ar" ? "ar-SA" : "en-GB",
        { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
      )
    : null;

  const tooltip =
    language === "he"
      ? `צפו בגרסת המסמך המעודכנת, המשקפת את ההסכמות שהתקבלו בקהילה${dateStr ? `. נכון ל-${dateStr}` : ""}`
      : language === "ar"
      ? `اعرض أحدث نسخة من الوثيقة، تعكس التوافق المجتمعي${dateStr ? `. حتى ${dateStr}` : ""}`
      : `View the latest document version reflecting community consensus${dateStr ? `. As of ${dateStr}` : ""}`;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onClick}
            variant="outline"
            size="sm"
            className={`group gap-2 border-blue-200 bg-blue-50/60 hover:bg-blue-100 hover:border-blue-300 text-blue-700 ${
              isRTL ? "flex-row-reverse" : ""
            }`}
          >
            <FileCheck2 className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
            <span className="font-semibold">{label}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side={isRTL ? "left" : "right"} className="max-w-xs text-center font-medium">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}