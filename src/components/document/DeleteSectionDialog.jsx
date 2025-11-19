import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function DeleteSectionDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  isDeleting 
}) {
  const { t, isRTL } = useLanguage();
  const [saveToHistory, setSaveToHistory] = useState(true);

  const handleConfirm = () => {
    onConfirm(saveToHistory);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            {t('deleteSection')}
          </DialogTitle>
          <DialogDescription>
            {t('confirmDeleteSection')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className={`flex items-center space-x-2 ${isRTL ? 'flex-row-reverse space-x-reverse' : ''}`}>
            <Checkbox
              id="saveToHistory"
              checked={saveToHistory}
              onCheckedChange={setSaveToHistory}
            />
            <label
              htmlFor="saveToHistory"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {t('saveToHistory')}
            </label>
          </div>
        </div>

        <DialogFooter className={isRTL ? 'flex-row-reverse' : ''}>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            {t('cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? t('deleting') : t('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}