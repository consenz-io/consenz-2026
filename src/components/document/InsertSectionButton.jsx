import React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import PointsCostTooltip from "@/components/document/PointsCostTooltip";
import { useDocContent } from "@/components/document/DocumentContentContext";

export default function InsertSectionButton({ onClick, wrapperClassName = "h-8 my-1 z-10", innerClassName = "" }) {
  const { t, isRTL, language, document } = useDocContent();
  return (
    <div className={`group relative flex items-center justify-center ${wrapperClassName}`}>
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity ${innerClassName}`}>
        <div className="h-full flex items-center justify-center">
          <PointsCostTooltip gamificationEnabled={document?.gamificationEnabled} actionType="new" language={language} isRTL={isRTL}>
            <Button
              size="sm"
              variant="outline"
              onClick={onClick}
              className="bg-white shadow-md border-blue-300 text-blue-600 hover:bg-blue-50">
              <Plus className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
              {t('insertSectionHere')}
            </Button>
          </PointsCostTooltip>
        </div>
      </div>
    </div>
  );
}