import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, X, ExternalLink } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";

// Storage key to track last visit per document
const getLastVisitKey = (documentId) => `consenz_last_visit_${documentId}`;

export function recordDocumentVisit(documentId) {
  localStorage.setItem(getLastVisitKey(documentId), new Date().toISOString());
}

export function getLastVisitDate(documentId) {
  const stored = localStorage.getItem(getLastVisitKey(documentId));
  return stored ? new Date(stored) : null;
}

const LANG_LABELS = {
  he: { since: (d) => `מאז ${d}`, never: 'מאז הקמתו' },
  ar: { since: (d) => `منذ ${d}`, never: 'منذ إنشائه' },
  en: { since: (d) => `since ${d}`, never: 'since its creation' },
};

export default function ActivitySummaryDialog({ isOpen, onClose, document, suggestions, allComments, allVotes, publicProfiles, documentId, language: rawLanguage }) {
  const { isRTL } = useLanguage();
  const language = rawLanguage || 'he';
  const [step, setStep] = useState('prompt'); // 'prompt' | 'loading' | 'result'
  const [summary, setSummary] = useState('');
  const [error, setError] = useState(null);

  // Reset when dialog opens
  useEffect(() => {
    if (isOpen) {
      setStep('prompt');
      setSummary('');
      setError(null);
    }
  }, [isOpen]);

  const lastVisit = getLastVisitDate(documentId);
  const sinceLabel = (() => {
    if (!lastVisit) return LANG_LABELS[language]?.never || LANG_LABELS.he.never;
    const formatted = lastVisit.toLocaleDateString(
      language === 'he' ? 'he-IL' : language === 'ar' ? 'ar-SA' : 'en-GB',
      { day: '2-digit', month: '2-digit', year: 'numeric' }
    );
    return (LANG_LABELS[language]?.since || LANG_LABELS.he.since)(formatted);
  })();

  const getUserName = (email) => {
    const profile = publicProfiles?.find(p => p.email === email);
    return profile?.fullName || email?.split('@')[0] || 'משתמש';
  };

  const generateSummary = async () => {
    setStep('loading');
    setError(null);

    try {
      // Filter activity since last visit
      const since = lastVisit ? lastVisit.toISOString() : null;

      const recentSuggestions = suggestions.filter(s =>
        !since || new Date(s.created_date) > new Date(since)
      );
      const recentComments = allComments.filter(c =>
        !since || new Date(c.created_date) > new Date(since)
      );
      const recentVotes = allVotes.filter(v =>
        !since || new Date(v.created_date) > new Date(since)
      );

      const pendingSuggestions = recentSuggestions.filter(s => s.status === 'pending');
      const acceptedSuggestions = recentSuggestions.filter(s => s.status === 'accepted');
      const rejectedSuggestions = recentSuggestions.filter(s => s.status === 'rejected');

      const uniqueParticipants = new Set([
        ...recentVotes.map(v => v.created_by).filter(Boolean),
        ...recentComments.map(c => c.created_by).filter(Boolean),
        ...recentSuggestions.map(s => s.created_by).filter(Boolean),
      ]);

      // Build data summary for LLM
      const suggestionDetails = recentSuggestions.map(s => ({
        id: s.id,
        title: s.title,
        status: s.status,
        type: s.type,
        proVotes: s.proVotes || 0,
        conVotes: s.conVotes || 0,
        createdBy: getUserName(s.created_by),
        explanation: s.explanation || '',
      }));

      const commentDetails = recentComments.slice(0, 30).map(c => ({
        content: c.content?.substring(0, 200),
        createdBy: getUserName(c.created_by),
        entityType: c.rootEntityType,
      }));

      const langInstructions = {
        he: 'כתוב את הסיכום בעברית. השתמש בשפה נייטרלית מגדרית (לדוגמה: "משתמש" ולא "משתמש/ת"). כתוב בצורה נרטיבית, לא כרשימה. בסוף כל הצעה שציינת, הוסף את מזהה ההצעה בפורמט [suggestion:ID] כדי שנוכל להוסיף קישור.',
        ar: 'اكتب الملخص باللغة العربية. استخدم لغة محايدة جنسيًا. اكتب بأسلوب سردي. بعد كل اقتراح، أضف [suggestion:ID] للربط.',
        en: 'Write the summary in English. Use gender-neutral language. Write in a narrative style, not a list. After each suggestion mentioned, include [suggestion:ID] so we can add a link.',
      };

      const prompt = `You are summarizing activity in a collaborative document platform called Consenz.

Document: "${document?.title}"
Period: ${sinceLabel}

Activity data:
- New suggestions: ${recentSuggestions.length} (${pendingSuggestions.length} pending, ${acceptedSuggestions.length} accepted, ${rejectedSuggestions.length} rejected)
- New comments: ${recentComments.length}
- New votes: ${recentVotes.length}
- Unique participants: ${uniqueParticipants.size}

Suggestions details:
${JSON.stringify(suggestionDetails, null, 2)}

Sample comments:
${JSON.stringify(commentDetails, null, 2)}

Instructions:
${langInstructions[language] || langInstructions.en}

Write a 2-4 paragraph narrative summary of what happened. Be specific about suggestions, who participated, and what positions people took. End with a call to action encouraging readers to vote, comment, or add their own suggestions based on their views. Keep it warm and engaging.`;

      const result = await base44.integrations.Core.InvokeLLM({ prompt });
      const rawText = typeof result === 'string' ? result : result?.content || result?.text || JSON.stringify(result);

      setSummary(rawText);
      setStep('result');
    } catch (err) {
      setError(language === 'he' ? 'אירעה שגיאה ביצירת הסיכום. נסו שוב.' : language === 'ar' ? 'حدث خطأ. حاول مرة أخرى.' : 'An error occurred. Please try again.');
      setStep('prompt');
    }
  };

  // Parse [suggestion:ID] tokens into links
  const renderSummaryWithLinks = (text) => {
    if (!text) return null;
    const parts = text.split(/(\[suggestion:[^\]]+\])/g);
    return parts.map((part, i) => {
      const match = part.match(/\[suggestion:([^\]]+)\]/);
      if (match) {
        const suggId = match[1].trim();
        const sugg = suggestions.find(s => s.id === suggId);
        const label = sugg?.title
          ? (language === 'he' ? `לצפייה בהצעה: ${sugg.title}` : language === 'ar' ? `عرض الاقتراح: ${sugg.title}` : `View: ${sugg.title}`)
          : (language === 'he' ? 'לצפייה בהצעה' : language === 'ar' ? 'عرض الاقتراح' : 'View suggestion');
        return (
          <Link
            key={i}
            to={`${createPageUrl("suggestiondetail")}?id=${suggId}`}
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline font-medium text-sm"
            onClick={onClose}
          >
            <ExternalLink className="w-3 h-3" />
            {label}
          </Link>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const titles = {
    he: { prompt: 'סיכום פעילות', subtitle: `מה קרה במסמך "${document?.title}" ${sinceLabel}?`, btnGenerate: 'צור סיכום עם AI', btnClose: 'סגירה' },
    ar: { prompt: 'ملخص النشاط', subtitle: `ما الذي حدث في "${document?.title}" ${sinceLabel}؟`, btnGenerate: 'إنشاء ملخص بالذكاء الاصطناعي', btnClose: 'إغلاق' },
    en: { prompt: 'Activity Summary', subtitle: `What happened in "${document?.title}" ${sinceLabel}?`, btnGenerate: 'Generate AI Summary', btnClose: 'Close' },
  };
  const T = titles[language] || titles.he;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className={`max-w-lg w-full ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            {T.prompt}
          </DialogTitle>
        </DialogHeader>

        {step === 'prompt' && (
          <div className="space-y-4 py-2">
            <p className="text-slate-600 text-sm leading-relaxed">{T.subtitle}</p>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={onClose}>{T.btnClose}</Button>
              <Button
                onClick={generateSummary}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
              >
                <Sparkles className="w-4 h-4 mr-1" />
                {T.btnGenerate}
              </Button>
            </div>
          </div>
        )}

        {step === 'loading' && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-slate-500 text-sm">
              {language === 'he' ? 'מנתח את הפעילות...' : language === 'ar' ? 'جاري تحليل النشاط...' : 'Analyzing activity...'}
            </p>
          </div>
        )}

        {step === 'result' && (
          <div className="space-y-4 py-2">
            <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed bg-slate-50 rounded-lg p-4 max-h-[55vh] overflow-y-auto">
              {renderSummaryWithLinks(summary)}
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={onClose}>{T.btnClose}</Button>
              <Button
                variant="ghost"
                onClick={() => { setStep('prompt'); setSummary(''); }}
                className="text-slate-500"
              >
                {language === 'he' ? 'סיכום חדש' : language === 'ar' ? 'ملخص جديد' : 'New summary'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}