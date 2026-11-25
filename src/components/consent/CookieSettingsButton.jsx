import { Cookie } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { OPEN_COOKIE_SETTINGS_EVENT } from "@/components/consent/CookieConsent";

const labels = {
  he: "הגדרות קוקיז",
  en: "Cookie settings",
  ar: "إعدادات الكوكيز",
};

export default function CookieSettingsButton() {
  const { language } = useLanguage();
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}
      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors min-h-[44px] w-full"
    >
      <Cookie className="w-4 h-4" aria-hidden="true" />
      {labels[language] || labels.en}
    </button>
  );
}