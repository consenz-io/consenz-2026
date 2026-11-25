import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, MailX } from "lucide-react";

// Public page reached from the opt-out link in activity emails. It stands
// outside the app navigation and never asks the visitor to sign in: the token
// in the URL fragment identifies the account the email was sent to.
const copy = {
  he: {
    title: "כיבוי מיילים",
    body: "אם תכבו, לא יישלחו אליכם מיילים על פעילות במסמכים ובקבוצות. מיילים תפעוליים, כמו איפוס סיסמה, ימשיכו להישלח.",
    button: "לכבות קבלת מיילים",
    working: "מכבים…",
    doneTitle: "כבינו את המיילים",
    doneBody: "מכאן והלאה לא יישלחו אליכם מיילים על פעילות. אפשר להפעיל מחדש בכל רגע דרך מתג המיילים בפרופיל.",
    invalidTitle: "הקישור אינו תקין",
    invalidBody: "ייתכן שהקישור נחתך או שאינו שייך לחשבון הזה. אפשר לכבות מיילים גם בפרופיל.",
    errorTitle: "הכיבוי לא הצליח",
    errorBody: "נסו שוב בעוד רגע, או כבו מיילים דרך הפרופיל.",
    retry: "ניסיון נוסף",
    profile: "לפרופיל",
    direction: "rtl",
  },
  en: {
    title: "Turn off emails",
    body: "If you turn them off, you will not receive emails about activity in documents and groups. Transactional emails, like password resets, still arrive.",
    button: "Turn off email updates",
    working: "Turning off…",
    doneTitle: "Email updates are off",
    doneBody: "From now on you will not receive activity emails. You can turn them back on at any time with the email switch in your profile.",
    invalidTitle: "This link is not valid",
    invalidBody: "The link may have been cut short or belongs to another account. You can also turn emails off from your profile.",
    errorTitle: "That did not work",
    errorBody: "Please try again in a moment, or turn emails off from your profile.",
    retry: "Try again",
    profile: "Go to profile",
    direction: "ltr",
  },
  ar: {
    title: "إيقاف الرسائل",
    body: "إذا أوقفتها فلن تصلك رسائل عن النشاط في الوثائق والمجموعات. الرسائل التشغيلية، مثل إعادة تعيين كلمة المرور، ستظل تصل.",
    button: "إيقاف رسائل البريد",
    working: "جارٍ الإيقاف…",
    doneTitle: "تم إيقاف الرسائل",
    doneBody: "من الآن لن تصلك رسائل عن النشاط. يمكنك إعادة تشغيلها في أي وقت من مفتاح البريد في ملفك.",
    invalidTitle: "الرابط غير صالح",
    invalidBody: "قد يكون الرابط مقطوعاً أو لا يخص هذا الحساب. يمكنك إيقاف الرسائل أيضاً من ملفك.",
    errorTitle: "لم ينجح الإيقاف",
    errorBody: "حاول مرة أخرى بعد قليل، أو أوقف الرسائل من ملفك.",
    retry: "إعادة المحاولة",
    profile: "إلى الملف",
    direction: "rtl",
  },
};

function readLanguage() {
  try {
    return localStorage.getItem("consenz_language") || "en";
  } catch {
    return "en";
  }
}

export default function Unsubscribe() {
  const [token] = useState(() => {
    try {
      return new URLSearchParams(window.location.hash.slice(1)).get("token");
    } catch {
      return null;
    }
  });
  const [status, setStatus] = useState("ready");
  const language = readLanguage();
  const c = copy[language] || copy.en;

  useEffect(() => {
    if (!token) setStatus("invalid");
  }, [token]);

  const unsubscribe = async () => {
    setStatus("working");
    try {
      await base44.functions.invoke("unsubscribeEmail", { token });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div
      dir={c.direction}
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 md:p-8">
        {status === "done" && (
          <>
            <CheckCircle2 className="w-10 h-10 text-green-600 mb-3" aria-hidden="true" />
            <h1 className="text-xl font-bold text-slate-900">{c.doneTitle}</h1>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{c.doneBody}</p>
          </>
        )}

        {status === "invalid" && (
          <>
            <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" aria-hidden="true" />
            <h1 className="text-xl font-bold text-slate-900">{c.invalidTitle}</h1>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{c.invalidBody}</p>
            <Button asChild className="mt-5 w-full bg-blue-600 hover:bg-blue-700 text-white">
              <a href="/Profile">{c.profile}</a>
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <AlertTriangle className="w-10 h-10 text-red-500 mb-3" aria-hidden="true" />
            <h1 className="text-xl font-bold text-slate-900">{c.errorTitle}</h1>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{c.errorBody}</p>
            <Button className="mt-5 w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={unsubscribe}>
              {c.retry}
            </Button>
          </>
        )}

        {(status === "ready" || status === "working") && (
          <>
            <MailX className="w-10 h-10 text-blue-600 mb-3" aria-hidden="true" />
            <h1 className="text-xl font-bold text-slate-900">{c.title}</h1>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{c.body}</p>
            <Button
              className="mt-5 w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={unsubscribe}
              disabled={status === "working"}
            >
              {status === "working" ? c.working : c.button}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}