import React from "react";
import { Languages, Check } from "lucide-react";
import { useTranslationAssist } from "./TranslationAssistContext";

const labels = {
  he: {
    title: "עזרו לנו לתרגם",
    on: "מצב סיוע בתרגום פעיל — ליד כל טקסט מתורגם יופיעו כפתורי הצעה",
    off: "הפעילו כדי להציע ניסוח טוב יותר לטקסטים מתורגמים",
  },
  ar: {
    title: "ساعدونا في الترجمة",
    on: "وضع المساعدة في الترجمة مُفعّل — تظهر أزرار الاقتراح بجانب النصوص المترجمة",
    off: "فعّل الوضع لاقتراح صياغة أفضل للنصوص المترجمة",
  },
  en: {
    title: "Help improve translations",
    on: "Translation help mode is on — a suggest button appears next to translated texts",
    off: "Turn on to suggest better wording for translated texts",
  },
};

/** Sidebar control that turns the two-step translation help mode on and off. */
export default function TranslationAssistToggle({ language }) {
  const { assistEnabled, setAssistEnabled } = useTranslationAssist();
  const text = labels[language] || labels.en;

  return (
    <button
      type="button"
      onClick={() => setAssistEnabled(!assistEnabled)}
      aria-pressed={assistEnabled}
      className={`w-full text-start rounded-lg border p-2.5 transition-colors ${
        assistEnabled
          ? "border-blue-400 bg-blue-50 hover:bg-blue-100"
          : "border-slate-300 bg-white hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-2">
        <Languages className={`w-4 h-4 flex-shrink-0 ${assistEnabled ? "text-blue-600" : "text-slate-500"}`} />
        <span className={`text-sm font-medium flex-1 ${assistEnabled ? "text-blue-800" : "text-slate-700"}`}>
          {text.title}
        </span>
        {assistEnabled && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
      </div>
      <p className={`text-[11px] leading-snug mt-1 ${assistEnabled ? "text-blue-700" : "text-slate-500"}`}>
        {assistEnabled ? text.on : text.off}
      </p>
    </button>
  );
}