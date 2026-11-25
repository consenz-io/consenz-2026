import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Cookie } from "lucide-react";

// The visitor's choice is stored here and reported to Google Consent Mode v2,
// so platform scripts on the page can wait for it before measuring anything.
const STORAGE_KEY = "consenz_cookie_choice_v1";
export const OPEN_COOKIE_SETTINGS_EVENT = "consenz:open-cookie-settings";

const copy = {
  he: {
    title: "קוקיז ומדידה",
    body: "אנחנו משתמשים באחסון מקומי הכרחי כדי שהמערכת תעבוד: התחברות, שפה וההעדפה הזאת. מדידה וניתוח שימוש יופעלו רק אם תאשרו. פרטים במדיניות הפרטיות.",
    privacy: "מדיניות הפרטיות",
    accept: "אישור הכול",
    decline: "דחייה",
    details: "הגדרות",
    save: "שמירה",
    analytics: "מדידה וניתוח שימוש",
    settingsTitle: "בחירה לפי סוג",
  },
  en: {
    title: "Cookies and measurement",
    body: "We use necessary local storage so the service works: sign-in, language and this choice. Measurement and usage analytics start only if you allow them. Details are in the privacy policy.",
    privacy: "Privacy policy",
    accept: "Accept all",
    decline: "Decline",
    details: "Settings",
    save: "Save",
    analytics: "Measurement and usage analytics",
    settingsTitle: "Choose by type",
  },
  ar: {
    title: "الكوكيز والقياس",
    body: "نستخدم تخزيناً محلياً ضرورياً ليعمل النظام: تسجيل الدخول واللغة وهذا الاختيار. أما القياس وتحليل الاستخدام فلا يبدأ إلا بموافقتك. التفاصيل في سياسة الخصوصية.",
    privacy: "سياسة الخصوصية",
    accept: "قبول الكل",
    decline: "رفض",
    details: "الإعدادات",
    save: "حفظ",
    analytics: "القياس وتحليل الاستخدام",
    settingsTitle: "الاختيار حسب النوع",
  },
};

function readLanguage() {
  try {
    return localStorage.getItem("consenz_language") || "en";
  } catch {
    return "en";
  }
}

function applyConsent(choice) {
  window.dataLayer = window.dataLayer || [];
  const gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  gtag("consent", "update", {
    analytics_storage: choice?.analytics ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
}

export default function CookieConsent() {
  const [language, setLanguage] = useState(readLanguage);
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch {
      saved = null;
    }
    if (saved) {
      applyConsent(saved);
      setAnalytics(!!saved.analytics);
    } else {
      setVisible(true);
    }

    const reopen = () => {
      setLanguage(readLanguage());
      setShowDetails(true);
      setVisible(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  const save = (choice) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
    } catch {
      // Storage can be unavailable; the choice still applies to this page view.
    }
    applyConsent(choice);
    setAnalytics(!!choice.analytics);
    setVisible(false);
    setShowDetails(false);
  };

  if (!visible) return null;

  const c = copy[language] || copy.en;
  const dir = language === "he" || language === "ar" ? "rtl" : "ltr";

  return (
    <div className="fixed bottom-0 inset-x-0 z-[9999] p-3 md:p-4" dir={dir} role="dialog" aria-live="polite" aria-label={c.title}>
      <div className="mx-auto max-w-3xl bg-white border border-slate-200 rounded-xl shadow-2xl p-4 md:p-5">
        <div className="flex items-start gap-3">
          <Cookie className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-slate-900">{c.title}</h2>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">
              {c.body}{" "}
              <a href="/PrivacyPolicy" className="text-blue-700 underline">
                {c.privacy}
              </a>
            </p>
          </div>
        </div>

        {showDetails && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{c.settingsTitle}</p>
            <label className="flex items-center gap-3 cursor-pointer py-1">
              <Checkbox
                checked={analytics}
                onCheckedChange={(value) => setAnalytics(value === true)}
                aria-label={c.analytics}
              />
              <span className="text-sm text-slate-700">{c.analytics}</span>
            </label>
          </div>
        )}

        <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setShowDetails((open) => !open)}
          >
            {c.details}
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => save({ analytics: false })}>
            {c.decline}
          </Button>
          <Button
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => save(showDetails ? { analytics } : { analytics: true })}
          >
            {showDetails ? c.save : c.accept}
          </Button>
        </div>
      </div>
    </div>
  );
}