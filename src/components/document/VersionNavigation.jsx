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

  return (
    <div className="flex justify-center w-full mb-4 print:hidden">
      <div className="bg-white/95 backdrop-blur-sm border-2 border-slate-300 rounded-full shadow-lg px-4 py-2">
        <div className="flex items-center gap-3">
          {/* Older version button (index increases = older) */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate(Math.min(currentIndex + 1, totalVersions - 1))}
            disabled={currentIndex >= totalVersions - 1}
            title={language === 'he' ? 'גרסה ישנה יותר' : language === 'ar' ? 'إصدار أقدم' : 'Older version'}
            className="h-9 w-9 p-0 rounded-full"
          >
            {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
          
          <div className="flex flex-col items-center min-w-[100px]">
            <Badge 
              variant="outline" 
              className={`px-3 text-xs font-semibold ${
                currentIndex === 0 
                  ? 'bg-green-50 text-green-700 border-green-200' 
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {currentIndex === 0 ? (
                language === 'he' ? 'נוכחית' : language === 'ar' ? 'حالية' : 'Current'
              ) : (
                language === 'he' 
                  ? `גרסה ${totalVersions - currentIndex} מתוך ${totalVersions - 1}`
                  : language === 'ar'
                  ? `إصدار ${totalVersions - currentIndex} من ${totalVersions - 1}`
                  : `Version ${totalVersions - currentIndex} of ${totalVersions - 1}`
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
            title={language === 'he' ? 'גרסה חדשה יותר' : language === 'ar' ? 'إصدار أحدث' : 'Newer version'}
            className="h-9 w-9 p-0 rounded-full"
          >
            {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}