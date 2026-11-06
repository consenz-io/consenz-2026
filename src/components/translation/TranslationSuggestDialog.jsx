import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/LanguageContext";

const labels = {
  he: {
    title: "הצעת תיקון תרגום",
    desc: "הנוסח הנוכחי מוצג למעלה. כתבו את הניסוח המוצע — הוא יישלח לאישור מנהל.",
    current: "הנוסח הנוכחי",
    proposed: "הנוסח המוצע",
    proposedPlaceholder: "כתבו כאן את התרגום המשופר...",
    note: "הסבר (לא חובה)",
    notePlaceholder: "מדוע הנוסח הנוכחי אינו מדויק?",
    cancel: "ביטול",
    submit: "שליחת ההצעה",
    sending: "שולח...",
    success: "ההצעה נשלחה לאישור המנהל",
    errors: {
      duplicate_own: "כבר יש לך הצעה ממתינה לטקסט הזה בשפה הזו",
      too_many_pending: "יש כבר כמה הצעות ממתינות לטקסט הזה. נסו שוב לאחר שיוכרעו.",
      identical: "הנוסח המוצע זהה לנוסח הנוכחי",
      invalid_text: "הנוסח המוצע קצר מדי או ארוך מדי",
      default: "שליחת ההצעה נכשלה. נסו שוב.",
    },
  },
  ar: {
    title: "اقتراح تصحيح ترجمة",
    desc: "الصياغة الحالية معروضة أعلاه. اكتب الصياغة المقترحة وسيتم إرسالها لموافقة المشرف.",
    current: "الصياغة الحالية",
    proposed: "الصياغة المقترحة",
    proposedPlaceholder: "اكتب الترجمة المحسّنة هنا...",
    note: "شرح (اختياري)",
    notePlaceholder: "لماذا الصياغة الحالية غير دقيقة؟",
    cancel: "إلغاء",
    submit: "إرسال الاقتراح",
    sending: "جارٍ الإرسال...",
    success: "تم إرسال الاقتراح للمراجعة",
    errors: {
      duplicate_own: "لديك بالفعل اقتراح معلق لهذا النص بهذه اللغة",
      too_many_pending: "توجد اقتراحات معلقة كثيرة لهذا النص. حاول بعد البت فيها.",
      identical: "الصياغة المقترحة مطابقة للصياغة الحالية",
      invalid_text: "الصياغة المقترحة قصيرة جداً أو طويلة جداً",
      default: "لم يتم إرسال الاقتراح. حاول مرة أخرى.",
    },
  },
  en: {
    title: "Suggest a translation fix",
    desc: "The current wording is shown above. Write your improved version — it will be sent to an admin for approval.",
    current: "Current wording",
    proposed: "Proposed wording",
    proposedPlaceholder: "Write the improved translation here...",
    note: "Explanation (optional)",
    notePlaceholder: "Why is the current wording inaccurate?",
    cancel: "Cancel",
    submit: "Send suggestion",
    sending: "Sending...",
    success: "Suggestion sent for admin review",
    errors: {
      duplicate_own: "You already have a pending suggestion for this text in this language",
      too_many_pending: "There are already several pending suggestions for this text. Try again after they are reviewed.",
      identical: "The proposed wording is identical to the current one",
      invalid_text: "The proposed wording is too short or too long",
      default: "The suggestion was not sent. Please try again.",
    },
  },
};

/**
 * Dialog for submitting a translation correction. Works for both a platform
 * string (platformKey) and a translated piece of user content.
 */
export default function TranslationSuggestDialog({ open, onOpenChange, target, currentText }) {
  const { language } = useLanguage();
  const text = labels[language] || labels.en;
  const [proposed, setProposed] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setProposed("");
      setNote("");
      setError("");
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = proposed.trim();
    if (trimmed.length < 2) {
      setError(text.errors.invalid_text);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await base44.functions.invoke("submitTranslationSuggestion", {
        ...target,
        currentText,
        proposedText: trimmed,
        note: note.trim(),
      });
      toast.success(text.success);
      onOpenChange(false);
    } catch (err) {
      const code = err?.response?.data?.error || err?.message;
      setError(text.errors[code] || text.errors.default);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir={language === "en" ? "ltr" : "rtl"}>
        <DialogHeader>
          <DialogTitle>{text.title}</DialogTitle>
          <DialogDescription>{text.desc}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{text.current}</p>
            <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-wrap max-h-40 overflow-auto">
              {currentText}
            </p>
          </div>

          <div>
            <label htmlFor="translation-proposal" className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">
              {text.proposed}
            </label>
            <Textarea
              id="translation-proposal"
              value={proposed}
              onChange={(e) => setProposed(e.target.value)}
              placeholder={text.proposedPlaceholder}
              rows={4}
              maxLength={2000}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="translation-note" className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">
              {text.note}
            </label>
            <Textarea
              id="translation-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={text.notePlaceholder}
              rows={2}
              maxLength={500}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {text.cancel}
            </Button>
            <Button type="submit" disabled={saving || proposed.trim().length < 2}>
              {saving && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              {saving ? text.sending : text.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}