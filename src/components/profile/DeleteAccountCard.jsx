import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Loader2, Trash2, AlertTriangle, X } from "lucide-react";

const copy = {
  he: {
    title: "מחיקת החשבון",
    description: "אפשר למחוק את החשבון בכל עת. הפעולה סופית ואי אפשר לבטל אותה.",
    deletedTitle: "יימחק לצמיתות",
    deleted: [
      "השם, כתובת הדואר האלקטרוני והפרופיל",
      "הודעות אישיות ושיחות",
      "התראות והיסטוריית נקודות",
      "חברות בקבוצות והזמנות",
      "יומני שליחת דואר",
    ],
    keptTitle: "יישאר במסמכים, בלי השם שלכם",
    kept: [
      "הצעות ותגובות שהעליתם",
      "הצבעות שהצבעתם",
      "חתימות על מסמכים שחתמתם עליהם",
    ],
    keptNote: "ההצעות, התגובות וההצבעות נשארות כפי שהתקבלו, מפני שההחלטות של הקבוצה והתיעוד שלהן שייכים לקבוצה. הן יוצגו כ״משתתף שנמחק״ ולא יהיה קישור בינן לבין זהותכם.",
    button: "מחיקת החשבון",
    dialogTitle: "למחוק את החשבון?",
    dialogDesc: "המחיקה סופית. לא נוכל לשחזר את החשבון, את הנקודות או את החברות שלכם בקבוצות.",
    checkbox: "אני מבין/ה שהמחיקה סופית",
    confirm: "מחיקה סופית",
    cancel: "ביטול",
    error: "המחיקה לא הושלמה. נסו שוב.",
    adminError: "חשבון מנהל מערכת לא נמחק מכאן. העבירו את הרשאת הניהול לחשבון אחר ואז נסו שוב.",
  },
  en: {
    title: "Delete account",
    description: "You can delete your account at any time. It cannot be undone.",
    deletedTitle: "Deleted permanently",
    deleted: [
      "Your name, email address and profile",
      "Private messages and conversations",
      "Notifications and points history",
      "Group memberships and invitations",
      "Email delivery logs",
    ],
    keptTitle: "Kept in the documents, without your name",
    kept: [
      "Proposals and comments you posted",
      "Votes you cast",
      "Signatures on documents you signed",
    ],
    keptNote: "Proposals, comments and votes stay exactly as they were, because a group's decisions and the record that proves them belong to the group. They are shown as written by a deleted participant, with nothing linking them to your identity.",
    button: "Delete account",
    dialogTitle: "Delete your account?",
    dialogDesc: "This is final. We cannot restore the account, your points or your group memberships.",
    checkbox: "I understand this is permanent",
    confirm: "Delete permanently",
    cancel: "Cancel",
    error: "The account was not deleted. Please try again.",
    adminError: "An admin account cannot be deleted here. Give admin rights to another account first, then try again.",
  },
  ar: {
    title: "حذف الحساب",
    description: "يمكنك حذف حسابك في أي وقت. الحذف نهائي ولا يمكن التراجع عنه.",
    deletedTitle: "يُحذف نهائياً",
    deleted: [
      "الاسم والبريد الإلكتروني والملف الشخصي",
      "الرسائل الخاصة والمحادثات",
      "الإشعارات وسجل النقاط",
      "العضوية في المجموعات والدعوات",
      "سجلات إرسال البريد",
    ],
    keptTitle: "يبقى في الوثائق، من دون اسمك",
    kept: [
      "الاقتراحات والتعليقات التي نشرتها",
      "التصويتات التي صوّتت بها",
      "التوقيعات على الوثائق التي وقعتها",
    ],
    keptNote: "تبقى الاقتراحات والتعليقات والتصويتات كما وردت، لأن قرارات المجموعة والسجل الذي يوثقها ملك للمجموعة. وتُعرض باسم مشارك محذوف، من دون أي رابط بينها وبين هويتك.",
    button: "حذف الحساب",
    dialogTitle: "حذف حسابك؟",
    dialogDesc: "الحذف نهائي. لن نتمكن من استعادة الحساب أو النقاط أو عضويتك في المجموعات.",
    checkbox: "أفهم أن الحذف نهائي",
    confirm: "حذف نهائي",
    cancel: "إلغاء",
    error: "لم يتم الحذف. حاول مرة أخرى.",
    adminError: "لا يمكن حذف حساب مدير من هنا. انقل صلاحية الإدارة إلى حساب آخر ثم حاول مرة أخرى.",
  },
};

export default function DeleteAccountCard() {
  const { language, isRTL } = useLanguage();
  const c = copy[language] || copy.en;
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await base44.functions.invoke("deleteAccount", { confirm: "DELETE" });
      if (response?.data?.success) {
        await base44.auth.logout("/");
        return;
      }
      setError(c.error);
      setLoading(false);
    } catch (err) {
      const code = err?.response?.data?.error;
      setError(code === "admin_account" ? c.adminError : c.error);
      setLoading(false);
    }
  };

  return (
    <Card className="bg-white border-red-200 overflow-hidden w-full max-w-full">
      <CardHeader className="p-3 md:p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" aria-hidden="true" />
          <CardTitle className="break-words text-red-700">{c.title}</CardTitle>
        </div>
        <CardDescription className="break-words">{c.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-3 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-red-100 bg-red-50/60 p-4">
            <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
              <X className="w-4 h-4" aria-hidden="true" />
              {c.deletedTitle}
            </h3>
            <ul className="space-y-1 text-sm text-slate-700 list-disc ps-5">
              {c.deleted.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-800 mb-2">{c.keptTitle}</h3>
            <ul className="space-y-1 text-sm text-slate-700 list-disc ps-5">
              {c.kept.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">{c.keptNote}</p>

        <AlertDialog
          open={open}
          onOpenChange={(next) => {
            if (loading) return;
            setOpen(next);
            if (!next) {
              setConfirmed(false);
              setError("");
            }
          }}
        >
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full md:w-auto">
              <Trash2 className={`w-4 h-4 ${isRTL ? "ms-2" : "me-2"}`} aria-hidden="true" />
              {c.button}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{c.dialogTitle}</AlertDialogTitle>
              <AlertDialogDescription>{c.dialogDesc}</AlertDialogDescription>
            </AlertDialogHeader>

            <label className="flex items-start gap-3 cursor-pointer py-2">
              <Checkbox
                checked={confirmed}
                onCheckedChange={(value) => setConfirmed(value === true)}
                className="mt-0.5"
                aria-label={c.checkbox}
              />
              <span className="text-sm text-slate-700">{c.checkbox}</span>
            </label>

            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2">{error}</p>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>{c.cancel}</AlertDialogCancel>
              <Button variant="destructive" onClick={handleDelete} disabled={!confirmed || loading}>
                {loading && <Loader2 className="w-4 h-4 me-2 animate-spin" aria-hidden="true" />}
                {c.confirm}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}