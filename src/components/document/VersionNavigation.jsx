import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function VersionNavigation({ 
  currentIndex, 
  totalVersions, 
  onNavigate, 
  currentSnapshot,
  language,
  isRTL 
}) {
  if (totalVersions <= 1) return null;

  const olderLabel = language === 'he' ? '← ישן' : language === 'ar' ? '← أقدم' : '← Older';
  const newerLabel = language === 'he' ? 'חדש →' : language === 'ar' ? 'أحدث →' : 'Newer →';

  return (
    <div className="flex items-center gap-2 flex-wrap mb-3 print:hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Older version button (index increases = older) */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onNavigate(Math.min(currentIndex + 1, totalVersions - 1))}
        disabled={currentIndex >= totalVersions - 1}
        className="h-8 px-3 gap-1 text-xs"
      >
        {isRTL ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        {olderLabel}
      </Button>

      <div className="flex flex-col items-center min-w-[110px]">
        <Badge
          variant="outline"
          className={`px-3 text-xs font-semibold ${
            currentIndex === 0
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          {currentIndex === 0 ? (
            language === 'he' ? 'גרסה נוכחית' : language === 'ar' ? 'الإصدار الحالي' : 'Current Version'
          ) : (
            language === 'he'
              ? `גרסה ${totalVersions - currentIndex} / ${totalVersions - 1}`
              : language === 'ar'
              ? `إصدار ${totalVersions - currentIndex} / ${totalVersions - 1}`
              : `v${totalVersions - currentIndex} / ${totalVersions - 1}`
          )}
        </Badge>
        {currentIndex > 0 && currentSnapshot?.isDirectEdit && (
          <span className="text-[10px] text-amber-600 font-semibold mt-0.5">
            {language === 'he' ? 'עריכת אדמין' : language === 'ar' ? 'تعديل المسؤول' : 'Admin Edit'}
          </span>
        )}
        {currentSnapshot?.changeDescription && currentIndex > 0 && (
          <span
            className="text-[10px] text-slate-500 mt-0.5 max-w-[150px] truncate text-center"
            title={currentSnapshot.changeDescription}
          >
            {currentSnapshot.changeDescription.replace('לפני: ', '')}
          </span>
        )}
      </div>

      {/* Newer version button (index decreases = newer) */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onNavigate(Math.max(0, currentIndex - 1))}
        disabled={currentIndex === 0}
        className="h-8 px-3 gap-1 text-xs"
      >
        {newerLabel}
        {isRTL ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </Button>
    </div>
  );
}