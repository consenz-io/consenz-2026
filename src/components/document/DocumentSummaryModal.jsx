import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Send, Mail, TestTube, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function DocumentSummaryModal({ isOpen, onClose, documentId, adminEmail }) {
  const { language, isRTL } = useLanguage();
  const [step, setStep] = useState('idle'); // idle | generating | review | sending | done
  const [summary, setSummary] = useState('');
  const [participantCount, setParticipantCount] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const [error, setError] = useState(null);
  const [sendResult, setSendResult] = useState(null);

  const labels = {
    title: language === 'he' ? 'סיכום פעילות המסמך' : language === 'ar' ? 'ملخص نشاط المستند' : 'Document Activity Summary',
    generating: language === 'he' ? 'מייצר סיכום...' : language === 'ar' ? 'جاري إنشاء الملخص...' : 'Generating summary...',
    generatingNote: language === 'he' ? 'זה עשוי לקחת כ-15 שניות' : language === 'ar' ? 'قد يستغرق ذلك حوالي 15 ثانية' : 'This may take about 15 seconds',
    improvePlaceholder: language === 'he' ? 'בקש שיפורים... (לדוגמה: "תמצת יותר", "הוסף קריאה לפעולה")' : language === 'ar' ? 'اطلب تحسينات...' : 'Request improvements... (e.g. "Make it shorter", "Add a call to action")',
    regenerate: language === 'he' ? 'עדכן סיכום' : language === 'ar' ? 'تحديث الملخص' : 'Update Summary',
    sendAll: language === 'he' ? `שלח לכל המשתתפים (${participantCount})` : language === 'ar' ? `أرسل لجميع المشاركين (${participantCount})` : `Send to all participants (${participantCount})`,
    sendTest: language === 'he' ? 'שלח מייל בדיקה (לי בלבד)' : language === 'ar' ? 'إرسال بريد اختبار (لي فقط)' : 'Send test email (only to me)',
    sending: language === 'he' ? 'שולח...' : language === 'ar' ? 'جاري الإرسال...' : 'Sending...',
    generateBtn: language === 'he' ? 'ייצר סיכום' : language === 'ar' ? 'إنشاء ملخص' : 'Generate Summary',
    previewLabel: language === 'he' ? 'תצוגה מקדימה של הסיכום:' : language === 'ar' ? 'معاينة الملخص:' : 'Summary Preview:',
    close: language === 'he' ? 'סגור' : language === 'ar' ? 'إغلاق' : 'Close',
  };

  const handleGenerate = async (instructions = '') => {
    setStep('generating');
    setError(null);
    try {
      const res = await base44.functions.invoke('generateDocumentSummary', {
        documentId,
        additionalInstructions: instructions,
      });
      setSummary(res.data.summary);
      setParticipantCount(res.data.participantCount || 0);
      setStep('review');
    } catch (err) {
      setError(err.message || 'Failed to generate summary');
      setStep('idle');
    }
  };

  const handleRegenerate = () => {
    if (chatInput.trim()) {
      handleGenerate(chatInput.trim());
      setChatInput('');
    }
  };

  const handleSend = async (isTestEmail) => {
    setStep('sending');
    setError(null);
    try {
      const res = await base44.functions.invoke('sendDocumentSummaryEmail', {
        documentId,
        summaryContent: summary,
        isTestEmail,
      });
      setSendResult({ ...res.data, isTestEmail });
      setStep('done');
    } catch (err) {
      setError(err.message || 'Failed to send email');
      setStep('review');
    }
  };

  const handleClose = () => {
    setStep('idle');
    setSummary('');
    setChatInput('');
    setError(null);
    setSendResult(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Mail className="w-5 h-5 text-blue-600" />
            {labels.title}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Step: idle */}
        {step === 'idle' && (
          <div className="space-y-4 py-4">
            <p className="text-slate-600 text-sm leading-relaxed">
              {language === 'he'
                ? 'מערכת ה-AI תנתח את פעילות המסמך (הצעות, הצבעות, תגובות) ותייצר סיכום מקצועי לשליחה במייל לכל המשתתפים.'
                : language === 'ar'
                ? 'سيقوم الذكاء الاصطناعي بتحليل نشاط المستند وإنشاء ملخص احترافي.'
                : 'The AI will analyze document activity (suggestions, votes, comments) and generate a professional summary email for all participants.'}
            </p>
            <Button onClick={() => handleGenerate()} className="w-full bg-blue-600 hover:bg-blue-700 gap-2">
              <RefreshCw className="w-4 h-4" />
              {labels.generateBtn}
            </Button>
          </div>
        )}

        {/* Step: generating */}
        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            <p className="font-medium text-slate-800">{labels.generating}</p>
            <p className="text-sm text-slate-500">{labels.generatingNote}</p>
          </div>
        )}

        {/* Step: review */}
        {step === 'review' && (
          <div className="space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{labels.previewLabel}</p>

            {/* Summary preview */}
            <div
              className="border border-slate-200 rounded-xl p-4 bg-slate-50 prose prose-sm max-w-none text-slate-800 max-h-64 overflow-y-auto text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: summary }}
            />

            {/* Chat-style refinement */}
            <div className="flex gap-2">
              <Textarea
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder={labels.improvePlaceholder}
                className="resize-none text-sm"
                rows={2}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey && chatInput.trim()) {
                    e.preventDefault();
                    handleRegenerate();
                  }
                }}
              />
              <Button
                onClick={handleRegenerate}
                disabled={!chatInput.trim()}
                variant="outline"
                className="self-end gap-1"
              >
                <RefreshCw className="w-4 h-4" />
                {labels.regenerate}
              </Button>
            </div>

            {/* Send buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-200">
              <Button
                onClick={() => handleSend(false)}
                className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
              >
                <Send className="w-4 h-4" />
                {labels.sendAll}
              </Button>
              <Button
                onClick={() => handleSend(true)}
                variant="outline"
                className="flex-1 gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                <TestTube className="w-4 h-4" />
                {labels.sendTest}
              </Button>
            </div>
          </div>
        )}

        {/* Step: sending */}
        {step === 'sending' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-green-600" />
            <p className="font-medium text-slate-800">{labels.sending}</p>
          </div>
        )}

        {/* Step: done */}
        {step === 'done' && sendResult && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle className="w-14 h-14 text-green-500" />
              <p className="text-lg font-bold text-slate-800">
                {language === 'he'
                  ? sendResult.isTestEmail ? 'מייל הבדיקה נשלח!' : 'המיילים נשלחו בהצלחה!'
                  : sendResult.isTestEmail ? 'Test email sent!' : 'Emails sent successfully!'}
              </p>
              <p className="text-slate-500 text-sm text-center">
                {language === 'he'
                  ? `נשלח ל-${sendResult.sent} נמענים${sendResult.failed > 0 ? ` • ${sendResult.failed} נכשלו` : ''}`
                  : `Sent to ${sendResult.sent} recipients${sendResult.failed > 0 ? ` • ${sendResult.failed} failed` : ''}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => { setStep('review'); setSendResult(null); }} variant="outline" className="flex-1">
                {language === 'he' ? 'חזור לסיכום' : 'Back to summary'}
              </Button>
              <Button onClick={handleClose} className="flex-1 bg-slate-800 hover:bg-slate-900">
                {labels.close}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}