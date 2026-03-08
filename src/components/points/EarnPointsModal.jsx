import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Coins, ArrowDown, ArrowUp, Users, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

const CONTENT = {
  he: {
    title: 'נקודות — למה ולמה?',
    philosophy: 'המערכת מתגמלת הצעות שמקדמות הסכמה אמיתית — לא סתם השתתפות.',
    sections: [
      {
        heading: 'כשאתה מציע',
        color: 'border-slate-200 bg-slate-50',
        headingColor: 'text-slate-700',
        rows: [
          { icon: ArrowDown, iconColor: 'text-red-500', label: 'הגשת הצעת עריכה / מחיקה', value: '−200', valueColor: 'text-red-600' },
          { icon: ArrowDown, iconColor: 'text-red-500', label: 'הגשת הצעה לסעיף חדש', value: '−350', valueColor: 'text-red-600' },
        ],
        note: 'ה"עלות" מעודדת להציע רק מה שבאמת כדאי — ומי שהצעתו מתקבלת מרוויח הרבה יותר ממה שהפסיד.',
      },
      {
        heading: 'כשהקהילה תומכת בהצעה שלך',
        color: 'border-blue-100 bg-blue-50',
        headingColor: 'text-blue-700',
        rows: [
          { icon: ArrowUp, iconColor: 'text-blue-500', label: 'כל הצבעת בעד שמישהו נותן לך', value: '+10', valueColor: 'text-blue-700' },
        ],
        note: 'כשאנשים מצביעים בעד הצעתך, הם אומרים שהיא מקדמת הסכמה. אתה מתוגמל על כך.',
      },
      {
        heading: 'כשההצעה מתקבלת ומשתלבת במסמך',
        color: 'border-green-100 bg-green-50',
        headingColor: 'text-green-700',
        rows: [
          { icon: CheckCircle2, iconColor: 'text-green-500', label: 'הצעת עריכה / מחיקה התקבלה', value: '+300', valueColor: 'text-green-700' },
          { icon: CheckCircle2, iconColor: 'text-green-500', label: 'הצעת סעיף חדש התקבלה', value: '+500', valueColor: 'text-green-700' },
        ],
        note: 'הרגע הגדול ביותר — ההצעה שלך שינתה את המסמך בהסכמת הקהילה.',
      },
    ],
    voteSection: {
      heading: 'מה תפקיד ההצבעה?',
      icon: Users,
      color: 'border-indigo-100 bg-indigo-50',
      headingColor: 'text-indigo-700',
      text: 'כשאתה מצביע על הצעות של אחרים, אתה לא צובר נקודות עבור עצמך — אבל אתה עוזר למסמך להגיע להסכמה ומתגמל מציעים טובים. זו תרומה לקהילה.',
    },
    cta: 'הבנתי, קדימה!',
  },
  ar: {
    title: 'النقاط — لماذا وكيف؟',
    philosophy: 'النظام يكافئ الاقتراحات التي تُحرّك المستند نحو توافق حقيقي — وليس مجرد المشاركة.',
    sections: [
      {
        heading: 'عندما تقترح',
        color: 'border-slate-200 bg-slate-50',
        headingColor: 'text-slate-700',
        rows: [
          { icon: ArrowDown, iconColor: 'text-red-500', label: 'تقديم اقتراح تعديل / حذف', value: '−200', valueColor: 'text-red-600' },
          { icon: ArrowDown, iconColor: 'text-red-500', label: 'تقديم اقتراح فقرة جديدة', value: '−350', valueColor: 'text-red-600' },
        ],
        note: 'التكلفة تشجعك على اقتراح ما يستحق فعلاً — ومن يُقبَل اقتراحه يكسب أكثر مما خسر.',
      },
      {
        heading: 'عندما يدعم المجتمع اقتراحك',
        color: 'border-blue-100 bg-blue-50',
        headingColor: 'text-blue-700',
        rows: [
          { icon: ArrowUp, iconColor: 'text-blue-500', label: 'كل تصويت مؤيد يحصل عليه اقتراحك', value: '+10', valueColor: 'text-blue-700' },
        ],
        note: 'حين يصوّت الناس لاقتراحك، يؤكدون أنه يُقرّب التوافق. أنت تُكافأ على ذلك.',
      },
      {
        heading: 'عندما يُقبَل الاقتراح ويُدمج في المستند',
        color: 'border-green-100 bg-green-50',
        headingColor: 'text-green-700',
        rows: [
          { icon: CheckCircle2, iconColor: 'text-green-500', label: 'قُبِل اقتراح تعديل / حذف', value: '+300', valueColor: 'text-green-700' },
          { icon: CheckCircle2, iconColor: 'text-green-500', label: 'قُبِل اقتراح فقرة جديدة', value: '+500', valueColor: 'text-green-700' },
        ],
        note: 'اللحظة الأعظم — اقتراحك غيّر المستند بموافقة الجميع.',
      },
    ],
    voteSection: {
      heading: 'ما دور التصويت؟',
      icon: Users,
      color: 'border-indigo-100 bg-indigo-50',
      headingColor: 'text-indigo-700',
      text: 'حين تصوّت على اقتراحات الآخرين، لا تكسب نقاطاً مباشرة — لكنك تساعد المستند على بلوغ التوافق وتكافئ المقترحين الجيدين. هذا إسهام في المجتمع.',
    },
    cta: 'فهمت، هيا!',
  },
  en: {
    title: 'Points — Why & How?',
    philosophy: 'Points reward suggestions that move the document toward real consensus — not just participation.',
    sections: [
      {
        heading: 'When you suggest',
        color: 'border-slate-200 bg-slate-50',
        headingColor: 'text-slate-700',
        rows: [
          { icon: ArrowDown, iconColor: 'text-red-500', label: 'Submit an edit / delete suggestion', value: '−200', valueColor: 'text-red-600' },
          { icon: ArrowDown, iconColor: 'text-red-500', label: 'Submit a new section suggestion', value: '−350', valueColor: 'text-red-600' },
        ],
        note: 'The cost encourages proposing only what\'s truly worthwhile — and those whose suggestions are accepted earn back far more than they spent.',
      },
      {
        heading: 'When the community supports your suggestion',
        color: 'border-blue-100 bg-blue-50',
        headingColor: 'text-blue-700',
        rows: [
          { icon: ArrowUp, iconColor: 'text-blue-500', label: 'Each pro vote your suggestion receives', value: '+10', valueColor: 'text-blue-700' },
        ],
        note: 'When people vote for your suggestion, they\'re saying it advances consensus. You\'re rewarded for that.',
      },
      {
        heading: 'When your suggestion is accepted into the document',
        color: 'border-green-100 bg-green-50',
        headingColor: 'text-green-700',
        rows: [
          { icon: CheckCircle2, iconColor: 'text-green-500', label: 'Edit / delete suggestion accepted', value: '+300', valueColor: 'text-green-700' },
          { icon: CheckCircle2, iconColor: 'text-green-500', label: 'New section suggestion accepted', value: '+500', valueColor: 'text-green-700' },
        ],
        note: 'The biggest moment — your suggestion changed the document with the community\'s agreement.',
      },
    ],
    voteSection: {
      heading: 'What\'s the role of voting?',
      icon: Users,
      color: 'border-indigo-100 bg-indigo-50',
      headingColor: 'text-indigo-700',
      text: 'When you vote on others\' suggestions, you don\'t earn points yourself — but you help the document reach consensus and reward good proposers. That\'s your contribution to the community.',
    },
    cta: 'Got it, let\'s go!',
  },
};

export default function EarnPointsModal({ open, onClose }) {
  const { language, isRTL } = useLanguage();
  const c = CONTENT[language] || CONTENT.en;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Coins className="w-5 h-5 text-amber-500 flex-shrink-0" />
            {c.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Philosophy banner */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-sm font-medium text-amber-900">{c.philosophy}</p>
          </div>

          {/* Sections */}
          {c.sections.map((section, si) => (
            <div key={si} className={`rounded-lg border p-4 space-y-3 ${section.color}`}>
              <h4 className={`text-sm font-bold ${section.headingColor}`}>{section.heading}</h4>
              <div className="space-y-2">
                {section.rows.map((row, ri) => (
                  <div key={ri} className="flex items-center justify-between gap-3 bg-white rounded-md px-3 py-2 shadow-sm">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <row.icon className={`w-4 h-4 flex-shrink-0 ${row.iconColor}`} />
                      <span className="text-sm text-slate-700 truncate">{row.label}</span>
                    </div>
                    <span className={`text-base font-bold flex-shrink-0 ${row.valueColor}`}>{row.value}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{section.note}</p>
            </div>
          ))}

          {/* Vote role */}
          <div className={`rounded-lg border p-4 ${c.voteSection.color}`}>
            <h4 className={`text-sm font-bold mb-2 ${c.voteSection.headingColor}`}>
              <c.voteSection.icon className="w-4 h-4 inline mr-1" />
              {c.voteSection.heading}
            </h4>
            <p className="text-sm text-slate-600 leading-relaxed">{c.voteSection.text}</p>
          </div>

          <Button
            className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold"
            onClick={onClose}
          >
            {c.cta}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}