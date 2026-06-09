import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/components/LanguageContext";
import { Sparkles, ThumbsDown, ThumbsUp, ShieldCheck, TrendingUp, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function PointsInfoModal({ open, onClose }) {
  const { language, isRTL } = useLanguage();

  const t = (en, he, ar) => language === 'he' ? he : language === 'ar' ? ar : en;

  const costs = [
    {
      label: t("Edit Section Suggestion", "הצעה לעריכת סעיף", "اقتراح تعديل قسم"),
      sub: t("Suggest editing an existing section", "הצעת עריכה לסעיף קיים", "اقتراح تعديل قسم موجود"),
      amount: -200,
    },
    {
      label: t("New Section Suggestion", "הצעה לסעיף חדש", "اقتراح قسم جديد"),
      sub: t("Suggest adding a new section", "הצעת הוספת סעיף חדש", "اقتراح إضافة قسم جديد"),
      amount: -350,
    },
  ];

  const rewards = [
    {
      label: t("Pro vote on your suggestion", "הצבעת בעד על ההצעה שלך", "تصويت مع على مقترحك"),
      sub: t("Each pro vote received", "כל הצבעת בעד עבור הצעותיך", "كل تصويت مع تلقيته"),
      amount: +10,
    },
    {
      label: t("Suggestion accepted by community", "הצעה שהתקבלה", "اقتراح قبله المجتمع"),
      sub: t("Suggestion reaches consensus threshold", "הצעה שלך קיבלה מספיק תמיכה ועברה את סף הקונצנזוס", "الاقتراح يتجاوز عتبة الإجماع"),
      amount: +500,
    },
    {
      label: t("Your vote aligned with outcome", "הצבעתך תרמה לקבלת או דחיית הצעה", "تصويتك توافق مع النتيجة النهائية"),
      sub: t("Voted pro on an accepted suggestion", "אם הצבעת בעד הצעה שהתקבלה או נגד עבור הצעה שנדחתה", "صوّتت مع على اقتراح تم قبوله"),
      amount: +50,
    },
  ];

  const mechanisms = [
    {
      icon: ShieldCheck,
      color: "text-red-600 bg-red-50 border-red-200",
      title: t("Noise Filtering", "סינון רעשים", "تصفية الضوضاء"),
      desc: t(
        "The 200–350 point cost acts as a quality filter. Users think twice before submitting content. Only those who believe their suggestion has real value will invest their points — creating natural self-regulation without central censorship.",
        "העלות של 200–350 נקודות פועלת כפילטר איכות. משתמשים חושבים פעמיים לפני הגשת תוכן. רק מי שמאמין שההצעה שלו בעלת ערך אמיתי ישקיע נקודות — ויסות עצמי טבעי ללא צנזורה מרכזית.",
        "تكلفة 200–350 نقطة تعمل كمرشح للجودة. يفكر المستخدمون مرتين قبل تقديم المحتوى. فقط من يعتقد أن اقتراحه ذو قيمة حقيقية سيستثمر نقاطه — تنظيم ذاتي طبيعي بدون رقابة مركزية."
      ),
    },
    {
      icon: TrendingUp,
      color: "text-green-600 bg-green-50 border-green-200",
      title: t("Positive Incentives", "תמריצים חיוביים", "حوافز إيجابية"),
      desc: t(
        "Every pro vote earns +10 points. Accepted suggestions earn +100. This aligns personal benefit with collective good — quality is measured by community consensus, not a central authority.",
        "כל הצבעת בעד מזכה ב-+10 נקודות. הצעות שהתקבלו מזכות ב-+100. זה מיישר תועלת אישית עם טובת הכלל — האיכות נמדדת בקונצנזוס קהילתי, לא ברשות מרכזית.",
        "كل صوت مع يكسب +10 نقاط. الاقتراحات المقبولة تكسب +100. هذا يوائم الفائدة الشخصية مع الصالح الجماعي — الجودة تُقاس بإجماع المجتمع، وليس بسلطة مركزية."
      ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto" dir={isRTL ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-amber-500" />
            {t("Points & Gamification", "ניקוד וגיימיפיקציה", "النقاط والتلعيب")}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-slate-600 leading-relaxed">
          {t(
            "A reputation and incentive system designed to filter noise, build credibility, and reward contributions measured by community consensus — not mere participation.",
            "מערכת מוניטין ותמריצים שנועדה לסנן רעשים, לבנות אמינות ולתגמל תרומה חיובית לתהליך הנמדדת בהסכמת הקהילה.",
            "نظام سمعة وحوافز مصمم لتصفية الضوضاء وبناء المصداقية ومكافأة المساهمات المقاسة بإجماع المجتمع — وليس بمجرد المشاركة."
          )}
        </p>

        {/* Costs & Rewards */}
        <div className="grid grid-cols-2 gap-3 mt-1">
          {/* Costs */}
          <div className="rounded-lg border border-red-200 overflow-hidden">
            <div className="bg-red-50 px-3 py-2 flex items-center gap-1.5">
              <ThumbsDown className="w-4 h-4 text-red-600" />
              <span className="font-semibold text-sm text-red-800">{t("Costs", "עלויות", "التكاليف")}</span>
            </div>
            <div className="divide-y divide-red-100">
              {costs.map((c, i) => (
                <div key={i} className="px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-slate-800 leading-snug">{c.label}</p>
                    <Badge className="bg-red-600 text-white text-xs shrink-0">{c.amount}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{c.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Rewards */}
          <div className="rounded-lg border border-green-200 overflow-hidden">
            <div className="bg-green-50 px-3 py-2 flex items-center gap-1.5">
              <ThumbsUp className="w-4 h-4 text-green-600" />
              <span className="font-semibold text-sm text-green-800">{t("Rewards", "תגמולים", "المكافآت")}</span>
            </div>
            <div className="divide-y divide-green-100">
              {rewards.map((r, i) => (
                <div key={i} className="px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-slate-800 leading-snug">{r.label}</p>
                    <Badge className="bg-green-600 text-white text-xs shrink-0">+{r.amount}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{r.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mechanisms */}
        <div className="space-y-2 mt-1">
          {mechanisms.map(({ icon: Icon, color, title, desc }, i) => (
            <div key={i} className={`flex gap-3 p-3 rounded-lg border ${color}`}>
              <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${color.split(" ")[0]}`} />
              <div>
                <p className="font-semibold text-sm text-slate-900">{title}</p>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Key insight */}
        <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            {t(
              "The system doesn't punish participation — it rewards quality participation. If your suggestions are valuable and earn community support, you gain reputation and continue contributing. Only spam depletes points.",
              "המערכת לא מענישה השתתפות — היא מתגמלת השתתפות באיכות. אם ההצעות שלך בעלות ערך ומקבלות תמיכה קהילתית, אתה צובר מוניטין וממשיך לתרום. רק ספאם מדלדל נקודות.",
              "النظام لا يعاقب المشاركة — بل يكافئ المشاركة الجيدة. إذا كانت مقترحاتك قيمة وحصلت على دعم المجتمع، فإنك تكتسب سمعة وتستمر في المساهمة. فقط البريد المزعج يستنزف النقاط."
            )}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}