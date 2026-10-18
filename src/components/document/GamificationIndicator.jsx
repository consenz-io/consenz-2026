import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Sparkles } from "lucide-react";

/**
 * Minimal gamification status indicator for the document page.
 * Shows a small pill/badge indicating whether the points & gamification
 * system is enabled for this document. Hovering reveals a tooltip with
 * a short explanation; clicking navigates to the LearnMore page's
 * gamification section for full details.
 *
 * Intentionally tiny and unobtrusive — sits next to the document title.
 */
export default function GamificationIndicator({ gamificationEnabled, language = 'he', isRTL }) {
  const enabled = !!gamificationEnabled;

  const tooltipText = enabled
    ? (language === 'he'
        ? 'מערכת ניקוד וגיימיפיקציה פעילה במסמך זה. הגשת הצעות עולה נקודות וזכייה בהסכמה מתגמלת בנקודות. לחץ ללמוד עוד'
        : language === 'ar'
        ? 'نظام النقاط والتلعيب مفعّل في هذا المستند. تقديم الاقتراحات يكلف نقاطًا والقبول يكافئ بنقاط. انقر للتعلم أكثر'
        : 'Points & gamification are enabled for this document. Submitting suggestions costs points; acceptance rewards points. Click to learn more')
    : (language === 'he'
        ? 'מערכת הניקוד והגיימיפיקציה כבויה במסמך זה. ניתן להגיש הצעות ללא עלות נקודות. לחץ ללמוד עוד על המערכת'
        : language === 'ar'
        ? 'نظام النقاط والتلعيب معطّل في هذا المستند. يمكن تقديم اقتراحات دون تكلفة نقاط. انقر للتعلم أكثر عن النظام'
        : 'Points & gamification are disabled for this document. Suggestions can be submitted without points cost. Click to learn about the system');

  const label = enabled
    ? (language === 'he' ? 'ניקוד פעיל' : language === 'ar' ? 'نقاط مفعّلة' : 'Points on')
    : (language === 'he' ? 'ניקוד כבוי' : language === 'ar' ? 'بدون نقاط' : 'Points off');

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to={`${createPageUrl("LearnMore")}#gamification`}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
              enabled
                ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-300'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:border-slate-300'
            }`}
            aria-label={tooltipText}
          >
            <Sparkles className={`w-3 h-3 ${enabled ? 'text-amber-500' : 'text-slate-400'}`} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[260px] text-center font-medium" dir={isRTL ? 'rtl' : 'ltr'}>
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}