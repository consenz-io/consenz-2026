import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Coins, ExternalLink } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { createPageUrl } from "@/utils";

export default function PointsCostConfirmDialog({ 
  isOpen, 
  onClose, 
  onConfirm,
  cost,
  currentPoints,
  actionType // "document" or "suggestion"
}) {
  const { t, isRTL } = useLanguage();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const actionText = actionType === "document" 
    ? "יצירת מסמך חדש" 
    : "יצירת הצעה";

  const handleConfirm = () => {
    if (dontShowAgain) {
      localStorage.setItem(`consenz_skip_points_confirm_${actionType}`, 'true');
    }
    onConfirm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Coins className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">אישור {actionText}</DialogTitle>
              <DialogDescription className="text-sm text-slate-600">
                פעולה זו תנכה {cost} נקודות
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-600">הנקודות שלך כרגע:</span>
              <span className="text-2xl font-bold text-slate-900">{currentPoints}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-600">עלות {actionText}:</span>
              <span className="text-xl font-bold text-red-600">-{cost}</span>
            </div>
            <div className="border-t border-slate-300 my-2"></div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-700">יתרה לאחר הפעולה:</span>
              <span className="text-2xl font-bold text-green-600">{currentPoints - cost}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Checkbox
                id="dontShowAgain"
                checked={dontShowAgain}
                onCheckedChange={setDontShowAgain}
              />
              <label
                htmlFor="dontShowAgain"
                className="text-sm text-blue-900 cursor-pointer"
              >
                אל תציג הודעה זו שוב
              </label>
            </div>
            <a
              href={`${createPageUrl("LearnMore")}#gamification`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              {t('learnMore')}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button onClick={onClose} variant="outline">
            ביטול
          </Button>
          <Button onClick={handleConfirm} className="bg-gradient-to-r from-blue-600 to-indigo-600">
            אישור ומשיך
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}