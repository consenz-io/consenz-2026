import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/components/LanguageContext";
import { FileEdit, ThumbsUp, Lightbulb, CheckCircle2, Sparkles } from "lucide-react";

const actions = {
  he: [
    {
      icon: FileEdit,
      color: "text-blue-600 bg-blue-50 border-blue-200",
      title: "הצעת שינוי משמעותי",
      desc: "כשאתה מציע שינוי שמוביל את המסמך קדימה, אתה תורם לעיצוב התוכן. הצעות שמקבלות תמיכה רחבה מהקהילה מצביעות על כך שזיהית צורך אמיתי.",
    },
    {
      icon: ThumbsUp,
      color: "text-green-600 bg-green-50 border-green-200",
      title: "הצבעה שתורמת להסכמה",
      desc: "הצבעה היא אמצעי לגבש עמדה קולקטיבית. כשאתה מצביע, אתה עוזר לקהילה להגיע לתמונה ברורה יותר — ובמיוחד כשהצבעתך תואמת להכרעה הסופית.",
    },
    {
      icon: Lightbulb,
      color: "text-amber-600 bg-amber-50 border-amber-200",
      title: "טיעון שמשכנע",
      desc: "טיעון טוב עוזר לאחרים לחשוב מחדש ולגבש עמדה מבוססת. כשמשתתפים אחרים מסמנים שהטיעון שלך שכנע אותם — יש לכך ערך ממשי לתהליך.",
    },
    {
      icon: CheckCircle2,
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
      title: "הצעה שהתקבלה על ידי הקהילה",
      desc: "כשהצעה שלך זוכה לתמיכה מספקת ומשתלבת במסמך — זהו הרגע המשמעותי ביותר: הקהילה קיבלה את הרעיון שלך כחלק מהגרסה המוסכמת.",
    },
  ],
  en: [
    {
      icon: FileEdit,
      color: "text-blue-600 bg-blue-50 border-blue-200",
      title: "Suggesting a meaningful change",
      desc: "When you propose a change that moves the document forward, you contribute to shaping its content. Suggestions that gain broad community support show you've identified a real need.",
    },
    {
      icon: ThumbsUp,
      color: "text-green-600 bg-green-50 border-green-200",
      title: "Voting that drives consensus",
      desc: "Voting helps the community form a collective stance. When you vote, you help clarify the direction — especially when your vote aligns with the final outcome.",
    },
    {
      icon: Lightbulb,
      color: "text-amber-600 bg-amber-50 border-amber-200",
      title: "An argument that convinces",
      desc: "A good argument helps others reconsider and form a grounded position. When other participants mark your argument as convincing — it has real value for the process.",
    },
    {
      icon: CheckCircle2,
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
      title: "A suggestion accepted by the community",
      desc: "When your suggestion gains enough support and becomes part of the document — that's the most meaningful moment: the community accepted your idea as part of the agreed version.",
    },
  ],
  ar: [
    {
      icon: FileEdit,
      color: "text-blue-600 bg-blue-50 border-blue-200",
      title: "اقتراح تغيير ذي معنى",
      desc: "عندما تقترح تغييرًا يدفع الوثيقة للأمام، فأنت تساهم في تشكيل محتواها. الاقتراحات التي تحظى بدعم واسع تدل على أنك حددت حاجة حقيقية.",
    },
    {
      icon: ThumbsUp,
      color: "text-green-600 bg-green-50 border-green-200",
      title: "تصويت يُعزز الإجماع",
      desc: "التصويت يساعد المجتمع على تشكيل موقف جماعي. عندما تصوّت، فأنت تساعد في توضيح الاتجاه — خاصةً حين يتوافق تصويتك مع النتيجة النهائية.",
    },
    {
      icon: Lightbulb,
      color: "text-amber-600 bg-amber-50 border-amber-200",
      title: "حجة مقنعة",
      desc: "الحجة الجيدة تساعد الآخرين على إعادة التفكير وتكوين موقف مستند. عندما يُشير المشاركون إلى أن حجتك أقنعتهم — فلذلك قيمة حقيقية في العملية.",
    },
    {
      icon: CheckCircle2,
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
      title: "اقتراح قبله المجتمع",
      desc: "حين يحظى اقتراحك بدعم كافٍ ويُدمج في الوثيقة — هذه هي اللحظة الأكثر أهمية: قبل المجتمع فكرتك كجزء من النسخة المتفق عليها.",
    },
  ],
};

export default function PointsInfoModal({ open, onClose }) {
  const { language, isRTL } = useLanguage();
  const items = actions[language] || actions.en;

  const heading = {
    he: "נקודות — מה המטרה?",
    en: "Points — What's the Goal?",
    ar: "النقاط — ما الهدف؟",
  }[language];

  const subtitle = {
    he: "נקודות ב-Consenz לא נועדו לתגמל השתתפות גרידא. הן מיועדות לעודד מהלכים שמקדמים את המסמך לעבר הסכמה אמיתית.",
    en: "Points in Consenz aren't meant to reward mere participation. They're designed to encourage moves that advance the document toward genuine consensus.",
    ar: "النقاط في Consenz ليست مخصصة لمكافأة المشاركة فحسب. بل هي مصممة لتشجيع الخطوات التي تدفع الوثيقة نحو إجماع حقيقي.",
  }[language];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir={isRTL ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-amber-500" />
            {heading}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-slate-600 leading-relaxed">{subtitle}</p>

        <div className="space-y-3 mt-2">
          {items.map(({ icon: Icon, color, title, desc }, i) => (
            <div key={i} className={`flex gap-3 p-3 rounded-lg border ${color}`}>
              <div className="mt-0.5 shrink-0">
                <Icon className={`w-5 h-5 ${color.split(" ")[0]}`} />
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-900">{title}</p>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-400 text-center mt-2">
          {language === "he"
            ? "ככל שתתרום להסכמות — כך תצבור יותר."
            : language === "ar"
            ? "كلما ساهمت في الإجماع، كلما جمعت أكثر."
            : "The more you contribute to consensus — the more you earn."}
        </p>
      </DialogContent>
    </Dialog>
  );
}