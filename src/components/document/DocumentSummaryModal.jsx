import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/components/LanguageContext";
import { Loader2, Send, Mail, TestTube, RefreshCw, X, CheckCircle, Users, MessageSquare, ThumbsUp, FileText } from "lucide-react";

export default function DocumentSummaryModal({ documentId, document, user, onClose }) {
  const { language, isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState('generating'); // 'generating' | 'chat' | 'sending' | 'done'
  const [summary, setSummary] = useState('');
  const [stats, setStats] = useState(null);
  const [pendingSuggestions, setPendingSuggestions] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [error, setError] = useState(null);
  const chatEndRef = useRef(null);

  const labels = {
    he: {
      title: 'שלח סיכום למשתתפים',
      generating: 'מכין סיכום פעילות...',
      summaryReady: 'הסיכום מוכן לשליחה',
      refineHint: 'רוצה לשנות משהו? כתוב כאן הוראות לשיפור הסיכום...',
      regenerate: 'עדכן סיכום',
      sendAll: 'שלח לכל המשתתפים',
      sendTest: 'שלח מייל בדיקה (לאדמין)',
      sending: 'שולח...',
      doneTitle: 'המיילים נשלחו!',
      doneTest: 'מייל בדיקה נשלח אליך',
      stats: { participants: 'משתתפים', suggestions: 'הצעות', accepted: 'אושרו', pending: 'ממתינות', votes: 'הצבעות', comments: 'תגובות' },
      close: 'סגור',
      error: 'שגיאה',
      retry: 'נסה שוב',
    },
    ar: {
      title: 'إرسال ملخص للمشاركين',
      generating: 'جارٍ إعداد ملخص النشاط...',
      summaryReady: 'الملخص جاهز للإرسال',
      refineHint: 'هل تريد تعديل شيء ما؟ اكتب تعليمات لتحسين الملخص...',
      regenerate: 'تحديث الملخص',
      sendAll: 'إرسال لجميع المشاركين',
      sendTest: 'إرسال بريد اختبار (للمشرف)',
      sending: 'جارٍ الإرسال...',
      doneTitle: 'تم إرسال البريد الإلكتروني!',
      doneTest: 'تم إرسال بريد اختبار إليك',
      stats: { participants: 'مشاركون', suggestions: 'اقتراحات', accepted: 'مقبولة', pending: 'معلقة', votes: 'أصوات', comments: 'تعليقات' },
      close: 'إغلاق',
      error: 'خطأ',
      retry: 'حاول مرة أخرى',
    },
    en: {
      title: 'Send Summary to Participants',
      generating: 'Generating activity summary...',
      summaryReady: 'Summary ready to send',
      refineHint: 'Want to change something? Write instructions to refine the summary...',
      regenerate: 'Update Summary',
      sendAll: 'Send to All Participants',
      sendTest: 'Send Test Email (Admin only)',
      sending: 'Sending...',
      doneTitle: 'Emails sent!',
      doneTest: 'Test email sent to you',
      stats: { participants: 'Participants', suggestions: 'Suggestions', accepted: 'Accepted', pending: 'Pending', votes: 'Votes', comments: 'Comments' },
      close: 'Close',
      error: 'Error',
      retry: 'Try Again',
    },
  };

  const L = labels[language] || labels['en'];
  const dir = isRTL ? 'rtl' : 'ltr';

  useEffect(() => {
    generateSummary();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, summary]);

  const generateSummary = async (instructions = '') => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('generateDocumentSummary', {
        documentId,
        additionalInstructions: instructions,
        language,
        appBaseUrl: window.location.origin,
      });
      setSummary(res.data.summary);
      setStats(res.data.stats);
      if (res.data.pendingSuggestions) setPendingSuggestions(res.data.pendingSuggestions);
      setPhase('chat');
    } catch (err) {
      setError(err.message || 'Failed to generate summary');
      setPhase('chat');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefine = async () => {
    if (!chatInput.trim()) return;
    const instruction = chatInput.trim();
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', text: instruction }]);
    setIsLoading(true);
    try {
      const res = await base44.functions.invoke('generateDocumentSummary', {
        documentId,
        additionalInstructions: instruction,
        language,
        appBaseUrl: window.location.origin,
      });
      setSummary(res.data.summary);
      if (res.data.pendingSuggestions) setPendingSuggestions(res.data.pendingSuggestions);
      setMessages(prev => [...prev, { role: 'assistant', text: isRTL ? 'הסיכום עודכן ✓' : 'Summary updated ✓' }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: `${L.error}: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (isTest) => {
    setPhase('sending');
    try {
      const res = await base44.functions.invoke('sendDocumentSummaryEmail', {
        documentId,
        summaryContent: summary,
        isTestEmail: isTest,
        language,
      });
      setSendResult({ ...res.data, isTest });
      setPhase('done');
      queryClient.invalidateQueries({ queryKey: ['emailLogs', documentId] });
    } catch (err) {
      setError(err.message);
      setPhase('chat');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir={dir}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-white" />
            <h2 className="text-white font-bold text-lg">{L.title}</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className={`flex gap-3 px-5 py-3 bg-blue-50 border-b text-xs font-medium text-blue-700 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{stats.participants} {L.stats.participants}</span>
            <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{stats.totalSuggestions} {L.stats.suggestions}</span>
            <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3.5 h-3.5" />{stats.accepted} {L.stats.accepted}</span>
            <span className="flex items-center gap-1 text-orange-500">⏳ {stats.pending} {L.stats.pending}</span>
            <span className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" />{stats.votes} {L.stats.votes}</span>
            <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" />{stats.comments} {L.stats.comments}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Generating phase */}
          {phase === 'generating' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-500">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
              <p className="font-medium">{L.generating}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-center gap-2">
              <span>{L.error}: {error}</span>
              <button onClick={() => { setError(null); generateSummary(); }} className="ml-auto text-red-600 hover:underline text-xs">{L.retry}</button>
            </div>
          )}

          {/* Summary box */}
          {summary && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">{L.summaryReady}</p>
              <div
                className={`text-sm text-slate-800 leading-relaxed ${isRTL ? 'text-right' : 'text-left'} [&_a]:text-blue-600 [&_a]:underline [&_p]:mb-2 [&_ul]:list-disc [&_ul]:ps-5 [&_li]:mb-1`}
                dangerouslySetInnerHTML={{ __html: summary }}
              />
            </div>
          )}

          {/* Pending suggestions with links */}
          {pendingSuggestions.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <p className={`text-xs font-semibold text-orange-600 uppercase tracking-wide mb-3 ${isRTL ? 'text-right' : ''}`}>
                {isRTL ? `${pendingSuggestions.length} הצעות פתוחות להצבעה` : `${pendingSuggestions.length} open suggestions for voting`}
              </p>
              <div className="space-y-2">
                {pendingSuggestions.map(s => (
                  <a
                    key={s.id}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-between gap-3 bg-white border border-orange-200 rounded-lg px-3 py-2 hover:border-orange-400 hover:shadow-sm transition-all group ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    <span className="text-sm font-medium text-slate-800 flex-1 truncate">{s.title}</span>
                    <span className="text-xs text-slate-400 shrink-0">👍 {s.proVotes} / 👎 {s.conVotes}</span>
                    <span className="text-xs text-blue-500 group-hover:underline shrink-0">
                      {isRTL ? 'להצבעה ←' : '→ Vote'}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? (isRTL ? 'justify-start' : 'justify-end') : (isRTL ? 'justify-end' : 'justify-start')}`}>
              <div className={`max-w-sm px-3 py-2 rounded-xl text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}

          {isLoading && phase === 'chat' && (
            <div className={`flex ${isRTL ? 'justify-end' : 'justify-start'}`}>
              <div className="bg-slate-100 px-4 py-2 rounded-xl flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                {isRTL ? 'מעדכן...' : 'Updating...'}
              </div>
            </div>
          )}

          {/* Done phase */}
          {phase === 'done' && sendResult && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <h3 className="font-bold text-green-900 text-lg">{sendResult.isTest ? L.doneTest : L.doneTitle}</h3>
              {!sendResult.isTest && (
                <p className="text-green-700 text-sm mt-1">
                  {sendResult.sent} / {sendResult.total} {isRTL ? 'מיילים נשלחו בהצלחה' : 'emails sent successfully'}
                  {sendResult.failed > 0 && ` • ${sendResult.failed} ${isRTL ? 'נכשלו' : 'failed'}`}
                </p>
              )}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Bottom area */}
        {(phase === 'chat') && summary && (
          <div className="border-t p-4 space-y-3 bg-white">
            {/* Refine input */}
            <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={L.refineHint}
                className={`resize-none text-sm min-h-[60px] ${isRTL ? 'text-right' : 'text-left'}`}
                dir={dir}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine(); }
                }}
                disabled={isLoading}
              />
              <Button
                onClick={handleRefine}
                disabled={isLoading || !chatInput.trim()}
                size="icon"
                className="h-auto w-10 bg-slate-700 hover:bg-slate-900"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>

            {/* Send buttons */}
            <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Button
                onClick={() => handleSend(false)}
                disabled={isLoading}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-semibold"
              >
                <Mail className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {L.sendAll}
              </Button>
              <Button
                onClick={() => handleSend(true)}
                disabled={isLoading}
                variant="outline"
                className="flex-1"
              >
                <TestTube className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {L.sendTest}
              </Button>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="border-t p-4 bg-white space-y-2">
            {sendResult?.isTest && (
              <Button
                onClick={() => handleSend(false)}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-semibold"
              >
                <Mail className="w-4 h-4 mr-2" />
                {L.sendAll}
              </Button>
            )}
            <Button onClick={onClose} className="w-full" variant="outline">{L.close}</Button>
          </div>
        )}

        {phase === 'sending' && (
          <div className="border-t p-4 bg-white flex items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-medium">{L.sending}</span>
          </div>
        )}
      </div>
    </div>
  );
}