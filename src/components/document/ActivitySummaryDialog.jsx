import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { PAGE_NAMES } from "@/components/pageNames";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Sparkles, X, Clock } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

const STORAGE_KEY_PREFIX = "consenz_last_visit_";

function getLastVisitKey(documentId) {
  return `${STORAGE_KEY_PREFIX}${documentId}`;
}

function getLastVisit(documentId) {
  const val = localStorage.getItem(getLastVisitKey(documentId));
  return val ? new Date(val) : null;
}

function saveCurrentVisit(documentId) {
  localStorage.setItem(getLastVisitKey(documentId), new Date().toISOString());
}

export function useActivitySummaryTrigger(documentId, suggestions, allComments, allVotes, publicProfiles) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [lastVisit, setLastVisit] = useState(null);
  const [newActivity, setNewActivity] = useState({ suggestions: [], comments: [], votes: 0, users: new Set() });

  useEffect(() => {
    if (!documentId || !suggestions || !allComments || !allVotes) return;

    const prev = getLastVisit(documentId);
    // Save current visit timestamp now (so next visit will use this)
    saveCurrentVisit(documentId);

    if (!prev) return; // First visit — no comparison possible

    setLastVisit(prev);

    const newSuggestions = suggestions.filter(
      s => s.documentId === documentId && new Date(s.created_date) > prev
    );
    const newComments = allComments.filter(
      c => new Date(c.created_date) > prev
    );
    const newVoteCount = allVotes.filter(
      v => new Date(v.created_date) > prev
    ).length;

    const newUserEmails = new Set();
    newSuggestions.forEach(s => s.created_by && newUserEmails.add(s.created_by));
    newComments.forEach(c => c.created_by && newUserEmails.add(c.created_by));

    const hasActivity =
      newSuggestions.length > 0 || newComments.length > 0 || newVoteCount > 0;

    if (hasActivity) {
      setNewActivity({
        suggestions: newSuggestions,
        comments: newComments,
        votes: newVoteCount,
        users: newUserEmails,
      });
      setShowPrompt(true);
    }
  }, [documentId, suggestions?.length, allComments?.length, allVotes?.length]);

  return { showPrompt, setShowPrompt, lastVisit, newActivity };
}

export default function ActivitySummaryDialog({
  isOpen,
  onClose,
  lastVisit,
  newActivity,
  documentId,
  document,
  publicProfiles,
}) {
  const { language, isRTL } = useLanguage();
  const [view, setView] = useState("prompt"); // "prompt" | "loading" | "summary"
  const [summary, setSummary] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setView("prompt");
      setSummary("");
    }
  }, [isOpen]);

  const getUserName = (email) => {
    const p = (publicProfiles || []).find(p => p.email === email);
    return p?.fullName || email?.split("@")[0] || "משתמש";
  };

  const formatDate = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleString(
      language === "he" ? "he-IL" : language === "ar" ? "ar-SA" : "en-GB",
      { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }
    );
  };

  const generateSummary = async () => {
    setView("loading");

    const { suggestions, comments, votes, users } = newActivity;

    const suggestionsText = suggestions
      .map(
        s =>
          `- הצעה בשם "${s.title}" (מאת ${getUserName(s.created_by)}, סטטוס: ${s.status === "accepted" ? "התקבלה" : s.status === "rejected" ? "נדחתה" : "ממתינה"}, ID: ${s.id})`
      )
      .join("\n");

    const commentsText = comments
      .slice(0, 20)
      .map(c => `- תגובה מאת ${getUserName(c.created_by)}: "${c.content?.substring(0, 100) || "..."}..."`)
      .join("\n");

    const usersList = [...users].map(getUserName).join(", ");

    const docTitle = document?.title || "מסמך";
    const sinceText = formatDate(lastVisit);

    const langInstruction =
      language === "he"
        ? "כתוב בעברית בלבד."
        : language === "ar"
        ? "اكتب باللغة العربية فقط."
        : "Write in English only.";

    const prompt = `
${langInstruction}
אתה עוזר לסיכום פעילות קהילתית במסמך שיתופי בשם "${docTitle}".
מאז הביקור האחרון של המשתמש ב-${sinceText} התרחשה הפעילות הבאה:

הצעות חדשות (${suggestions.length}):
${suggestionsText || "אין הצעות חדשות"}

תגובות חדשות (${comments.length}):
${commentsText || "אין תגובות חדשות"}

הצבעות חדשות: ${votes}

משתתפים פעילים: ${usersList || "אין"}

כתוב סיכום נרטיבי, קצר ומעניין (3-5 משפטים) של הפעילות האחרונה. 
הקפד על שפה נייטרלית מבחינה מגדרית (אל תשתמש ב"ניסח/ה" - השתמש ב"הוגשה הצעה" וכו').
לקראת הסוף, עודד את הקורא לבצע אינטראקציה — לתמוך, להתנגד, או לשאול שאלות בהתאם לדעתם.
אל תכלול קישורים בטקסט — הם יוצגו בנפרד.
ענה רק עם הסיכום עצמו, ללא כותרת.
    `.trim();

    try {
      const result = await base44.integrations.Core.InvokeLLM({ prompt });
      const text = typeof result === "string" ? result : result?.content || result?.text || JSON.stringify(result);
      setSummary(text.trim());
      setView("summary");
    } catch (e) {
      setSummary(
        language === "he"
          ? "לא ניתן היה לייצר סיכום כרגע. נסה שוב מאוחר יותר."
          : language === "ar"
          ? "تعذر إنشاء الملخص الآن. حاول مرة أخرى لاحقًا."
          : "Could not generate a summary right now. Please try again later."
      );
      setView("summary");
    }
  };

  const texts = {
    he: {
      title: "ברוך שובך! 👋",
      subtitle: `מאז הביקור האחרון שלך ב-${formatDate(lastVisit)} הייתה פעילות חדשה:`,
      activity: [
        newActivity.suggestions.length > 0 && `${newActivity.suggestions.length} הצעות חדשות`,
        newActivity.comments.length > 0 && `${newActivity.comments.length} תגובות חדשות`,
        newActivity.votes > 0 && `${newActivity.votes} הצבעות חדשות`,
      ]
        .filter(Boolean)
        .join(", "),
      askSummary: "רצית לראות סיכום של מה שהפסדת?",
      yes: "כן, הצג סיכום",
      no: "לא תודה",
      generating: "מייצר סיכום...",
      summaryTitle: "סיכום הפעילות האחרונה",
      relatedSuggestions: "הצעות רלוונטיות לבחינה:",
      close: "סגור",
    },
    ar: {
      title: "مرحبًا بعودتك! 👋",
      subtitle: `منذ زيارتك الأخيرة في ${formatDate(lastVisit)} كان هناك نشاط جديد:`,
      activity: [
        newActivity.suggestions.length > 0 && `${newActivity.suggestions.length} مقترحات جديدة`,
        newActivity.comments.length > 0 && `${newActivity.comments.length} تعليقات جديدة`,
        newActivity.votes > 0 && `${newActivity.votes} تصويتات جديدة`,
      ]
        .filter(Boolean)
        .join("، "),
      askSummary: "هل تريد رؤية ملخص لما فاتك؟",
      yes: "نعم، أرني الملخص",
      no: "لا شكرًا",
      generating: "جارٍ إنشاء الملخص...",
      summaryTitle: "ملخص النشاط الأخير",
      relatedSuggestions: "المقترحات ذات الصلة للمراجعة:",
      close: "إغلاق",
    },
    en: {
      title: "Welcome back! 👋",
      subtitle: `Since your last visit on ${formatDate(lastVisit)}, there has been new activity:`,
      activity: [
        newActivity.suggestions.length > 0 && `${newActivity.suggestions.length} new suggestions`,
        newActivity.comments.length > 0 && `${newActivity.comments.length} new comments`,
        newActivity.votes > 0 && `${newActivity.votes} new votes`,
      ]
        .filter(Boolean)
        .join(", "),
      askSummary: "Would you like to see a summary of what you missed?",
      yes: "Yes, show summary",
      no: "No thanks",
      generating: "Generating summary...",
      summaryTitle: "Recent Activity Summary",
      relatedSuggestions: "Relevant suggestions to review:",
      close: "Close",
    },
  };

  const T = texts[language] || texts.he;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={`max-w-lg w-full ${isRTL ? "text-right" : "text-left"}`}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500 shrink-0" />
            {T.title}
          </DialogTitle>
        </DialogHeader>

        {view === "prompt" && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-1">
              <p className="text-sm text-slate-700 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                {T.subtitle}
              </p>
              <p className="text-sm font-semibold text-blue-800">{T.activity}</p>
            </div>
            <p className="text-sm text-slate-600">{T.askSummary}</p>
            <div className={`flex gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
              <Button
                onClick={generateSummary}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 flex-1"
              >
                <Sparkles className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                {T.yes}
              </Button>
              <Button variant="outline" onClick={onClose}>
                {T.no}
              </Button>
            </div>
          </div>
        )}

        {view === "loading" && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm text-slate-500">{T.generating}</p>
          </div>
        )}

        {view === "summary" && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{summary}</p>
            </div>

            {newActivity.suggestions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  {T.relatedSuggestions}
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {newActivity.suggestions.map((s) => (
                    <Link
                      key={s.id}
                      to={`${createPageUrl(PAGE_NAMES.SUGGESTION_DETAIL)}?id=${s.id}`}
                      onClick={onClose}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all group"
                    >
                      <span className="text-sm text-slate-800 group-hover:text-blue-700 truncate flex-1">
                        {s.title}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${
                          s.status === "accepted"
                            ? "bg-green-100 text-green-700"
                            : s.status === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {s.status === "accepted"
                          ? language === "he" ? "התקבלה" : language === "ar" ? "مقبول" : "Accepted"
                          : s.status === "rejected"
                          ? language === "he" ? "נדחתה" : language === "ar" ? "مرفوض" : "Rejected"
                          : language === "he" ? "ממתינה" : language === "ar" ? "معلق" : "Pending"}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <Button variant="outline" onClick={onClose} className="w-full">
              {T.close}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}