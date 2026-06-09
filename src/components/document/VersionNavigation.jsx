import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

export default function VersionNavigation({ 
  currentIndex, 
  totalVersions, 
  onNavigate, 
  currentSnapshot,
  language,
  isRTL 
}) {
  const isLoading = totalVersions === 0;
  const hasMultipleVersions = totalVersions > 1;

  const isCurrentVersion = currentIndex === 0;
  const isOldestVersion = currentIndex >= totalVersions - 1;
  // Version numbers: index 1 = most recent change (highest number), last index = oldest (1)
  // currentIndex=1 → versionNumber = totalVersions-1, currentIndex=last → versionNumber = 1
  const versionNumber = totalVersions - currentIndex;

  const label = isLoading
    ? (language === 'he' ? 'טוען גרסאות...' : language === 'ar' ? 'جارٍ التحميل...' : 'Loading versions...')
    : isCurrentVersion
    ? (language === 'he' ? 'גרסה נוכחית' : language === 'ar' ? 'الإصدار الحالي' : 'Current Version')
    : currentSnapshot?.isOriginal
    ? (language === 'he' ? 'גרסה מקורית' : language === 'ar' ? 'الإصدار الأصلي' : 'Original Version')
    : (language === 'he' ? `גרסה ${versionNumber}` : language === 'ar' ? `إصدار ${versionNumber}` : `Version ${versionNumber}`);

  const changeLabel = !isCurrentVersion && currentSnapshot ? (() => {
    if (currentSnapshot.isNewSection) return language === 'he' ? '➕ סעיף נוסף' : language === 'ar' ? '➕ قسم جديد' : '➕ Section Added';
    if (currentSnapshot.isDeleted) return language === 'he' ? '🗑 סעיף נמחק' : language === 'ar' ? '🗑 قسم حُذف' : '🗑 Section Deleted';
    if (currentSnapshot.isDirectEdit) return language === 'he' ? '✏️ עריכת מנהל' : language === 'ar' ? '✏️ تعديل المسؤول' : '✏️ Admin Edit';
    if (currentSnapshot.isTopicTitleChange) return language === 'he' ? '📝 שינוי כותרת נושא' : '📝 Topic Renamed';
    if (currentSnapshot.changedSectionId) return language === 'he' ? '✏️ סעיף עודכן' : language === 'ar' ? '✏️ قسم عُدِّل' : '✏️ Section Edited';
    return null;
  })() : null;

  const timestampLabel = currentSnapshot?.timestamp && !isCurrentVersion
    ? format(new Date(currentSnapshot.timestamp), 'dd/MM/yy HH:mm')
    : null;

  return (
    <div className="versions-list fixed bottom-0 right-0 z-50 print:hidden" style={{ left: 'var(--sidebar-nav-width, 16rem)' }}>
      <div className="bg-white border-t-2 border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
          
          {/* Left button: RTL=Older, LTR=Older */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const next = Math.min(currentIndex + 1, totalVersions - 1);
              onNavigate(next);
              if (next > 0) window.dispatchEvent(new CustomEvent('versions:selected'));
            }}
            disabled={isLoading || !hasMultipleVersions || isOldestVersion}
            className="versions-older-btn h-9 px-4 gap-1 text-xs font-medium flex-shrink-0"
          >
            {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {isRTL
              ? (language === 'he' ? 'גרסה קודמת' : 'إصدار أقدم')
              : 'Older'}
          </Button>

          {/* Center info */}
          <div className="flex flex-col items-center min-w-0 flex-1 text-center">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isCurrentVersion ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {label}
            </span>
            {changeLabel && (
              <span className="text-[11px] text-slate-500 mt-0.5 truncate max-w-full">{changeLabel}</span>
            )}
            {timestampLabel && (
              <span className="text-[10px] text-slate-400">{timestampLabel}</span>
            )}
          </div>

          {/* Right button: RTL=Newer, LTR=Newer */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const prev = Math.max(0, currentIndex - 1);
              onNavigate(prev);
              if (prev > 0) window.dispatchEvent(new CustomEvent('versions:selected'));
            }}
            disabled={isLoading || !hasMultipleVersions || isCurrentVersion}
            className="h-9 px-4 gap-1 text-xs font-medium flex-shrink-0"
          >
            {isRTL
              ? (language === 'he' ? 'גרסה חדשה יותר' : 'إصدار أحدث')
              : 'Newer'}
            {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}