import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, TrendingUp, Award, Users } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function InsufficientPointsDialog({ 
  isOpen, 
  onClose, 
  requiredPoints, 
  currentPoints,
  actionType = "suggestion" // "suggestion" or "document"
}) {
  const { t, isRTL } = useLanguage();

  const actionText = actionType === "document" 
    ? "ליצור מסמך חדש" 
    : "ליצור הצעה";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">אין מספיק נקודות</DialogTitle>
              <DialogDescription className="text-sm text-slate-600">
                נדרשות {requiredPoints} נקודות | יש לך {currentPoints}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">למה צריך נקודות?</h4>
            <p className="text-sm text-blue-800">
              מערכת הנקודות נועדה לטפח סביבה איכותית על ידי סינון רעשים – 
              שכן יצירתם עולה בנקודות – ובניית מוניטין למשתמשים, 
              תוך תמרוץ תרומות חיוביות שנמדדות בהסכמת הקהילה.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-slate-900">איך צוברים נקודות?</h4>
            
            <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <div className="font-medium text-green-900">קבלת הצבעות בעד (+10)</div>
                <p className="text-xs text-green-700">כל הצבעה בעד על ההצעות שלך מעניקה לך 10 נקודות</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                <Award className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <div className="font-medium text-purple-900">הצעה מתקבלת (+100)</div>
                <p className="text-xs text-purple-700">כאשר ההצעה שלך עוברת את סף הקונצנזוס ומתקבלת למסמך</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <div className="font-medium text-indigo-900">תרומה לקונצנזוס (+50)</div>
                <p className="text-xs text-indigo-700">כאשר ההצבעה שלך משפיעה על קבלת הצעה</p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-900">
              <strong>טיפ:</strong> צור הצעות איכותיות שיזכו לתמיכה רחבה בקהילה. 
              הקפד להסביר היטב את השינויים המוצעים ולתרום לדיון.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full">
            הבנתי
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}