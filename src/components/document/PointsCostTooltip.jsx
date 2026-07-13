import React from "react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Sparkles, Award } from "lucide-react";

const POINTS_COST_NEW = 350;
const POINTS_COST_EDIT = 200;
const POINTS_REWARD_ACCEPTED = 500;

/**
 * Wraps an action button and, when gamification is enabled for the document,
 * shows a tooltip on hover explaining the points cost of the action and the
 * reward for an accepted suggestion. When gamification is off, renders children as-is.
 *
 * actionType: "new" (new section) | "edit" (edit section)
 */
export default function PointsCostTooltip({ gamificationEnabled, actionType, language = 'he', isRTL, children }) {
  if (!gamificationEnabled) return children;

  const cost = actionType === 'new' ? POINTS_COST_NEW : POINTS_COST_EDIT;

  const costLabel =
    language === 'he'
      ? `פרסום הצעה יעלה לך ${cost} נקודות`
      : language === 'ar'
      ? `نشر هذا الاقتراح سيكلفك ${cost} نقطة`
      : `Publishing this suggestion costs ${cost} points`;

  const rewardLabel =
    language === 'he'
      ? `אם הצעתך תזכה להסכמה ותתקבל, יוענקו לך ${POINTS_REWARD_ACCEPTED} נקודות`
      : language === 'ar'
      ? `إذا حظي اقتراحك بالموافقة وتم قبوله، ستُمنح ${POINTS_REWARD_ACCEPTED} نقطة`
      : `If your suggestion reaches consensus and is accepted, you'll be awarded ${POINTS_REWARD_ACCEPTED} points`;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[260px] p-3 text-start"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <span className="text-sm font-medium">{costLabel}</span>
            </div>
            <div className="flex items-start gap-2 pt-2 border-t border-slate-200">
              <Award className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span className="text-sm text-green-700 font-medium">{rewardLabel}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}