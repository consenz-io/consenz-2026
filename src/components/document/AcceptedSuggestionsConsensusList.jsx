import React from "react";
import { Link } from "react-router-dom";
import { ThumbsUp, ThumbsDown, TrendingUp, FilePlus, FileEdit, Trash2, ExternalLink } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { createPageUrl } from "@/utils";

/**
 * Lists all accepted suggestions (excluding admin overrides) with their vote
 * counts, individual consensus value, and how each contributed to the running
 * consensus meter average.
 */
export default function AcceptedSuggestionsConsensusList({ suggestions, currentMeter }) {
  const { language, isRTL } = useLanguage();

  // Only community-accepted suggestions (not admin overrides) contribute to
  // the consensus meter — exclude approvedByAdmin per the schema.
  const accepted = (suggestions || [])
    .filter(s => s.status === 'accepted' && !s.approvedByAdmin)
    .sort((a, b) => new Date(a.updated_date) - new Date(b.updated_date));

  if (accepted.length === 0) {
    return (
      <div className={`text-center py-8 text-slate-400 ${isRTL ? 'text-right' : 'text-left'}`}>
        {language === 'he' ? 'עדיין לא אושרו הצעות במסמך זה' : language === 'ar' ? 'لم يتم قبول أي اقتراحات بعد' : 'No suggestions have been accepted yet'}
      </div>
    );
  }

  // Compute running average using the stored suggestionConsensus values,
  // matching the document's consensuses array calculation:
  //   meter = average of min(1, suggestionConsensus) across all accepted
  //
  // The threshold used to accept suggestion N is derived from the meter
  // computed from all PREVIOUSLY accepted suggestions (1..N-1), multiplied
  // by the participant count at the moment of acceptance. For the first
  // suggestion the meter is 0 so the default threshold (2) applies.
  let runningSum = 0;
  const rows = accepted.map((s, i) => {
    const pro = s.proVotes || 0;
    const con = s.conVotes || 0;
    // Use the stored consensus value (what the system actually used), not a
    // naive pro/(pro+con) which can differ from the stored calculation.
    const consensus = Math.min(1, s.suggestionConsensus ?? 0);
    // Meter BEFORE this suggestion was accepted (average of all prior ones)
    const prevRunningAvg = i === 0 ? 0 : runningSum / i;
    runningSum += consensus;
    const runningAvg = runningSum / (i + 1);
    // Threshold required at the moment this suggestion was accepted
    const participants = s.participantsAtAcceptance || 0;
    const thresholdUsed = Math.max(2, Math.round(prevRunningAvg * participants));
    return { ...s, pro, con, consensus, runningAvg, prevRunningAvg, participants, thresholdUsed, index: i + 1 };
  });

  const typeLabel = (s) => {
    if (language === 'he') {
      if (s.type === 'new_section') return 'סעיף חדש';
      if (s.type === 'edit_section') return 'עריכת סעיף';
      if (s.type === 'delete_section') return 'מחיקת סעיף';
      return 'הצעה';
    }
    if (language === 'ar') {
      if (s.type === 'new_section') return 'قسم جديد';
      if (s.type === 'edit_section') return 'تعديل قسم';
      if (s.type === 'delete_section') return 'حذف قسم';
      return 'اقتراح';
    }
    if (s.type === 'new_section') return 'New section';
    if (s.type === 'edit_section') return 'Edited section';
    if (s.type === 'delete_section') return 'Deleted section';
    return 'Suggestion';
  };

  const TypeIcon = (s) => {
    if (s.type === 'new_section') return FilePlus;
    if (s.type === 'delete_section') return Trash2;
    return FileEdit;
  };

  const colTitle = language === 'he' ? 'הצעה' : language === 'ar' ? 'الاقتراح' : 'Suggestion';
  const colPro = language === 'he' ? 'בעד' : language === 'ar' ? 'مع' : 'Pro';
  const colCon = language === 'he' ? 'נגד' : language === 'ar' ? 'ضد' : 'Con';
  const colConsensus = language === 'he' ? 'קונצנזוס' : language === 'ar' ? 'إجماع' : 'Consensus';
  const colRunning = language === 'he' ? 'ממוצע מצטבר' : language === 'ar' ? 'المتوسط التراكمي' : 'Running Avg';
  const colThreshold = language === 'he' ? 'רף תומכים דרוש' : language === 'ar' ? 'عتبة المؤيدين المطلوبة' : 'Required Threshold';

  return (
    <div className="space-y-3">
      <p className={`text-sm text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
        {language === 'he'
          ? `כל הצעה שמתקבלת מוסיפה את ערך הקונצנזוס שלה לממוצע. כיום עומד מד הקונצנזוס על ${(currentMeter * 100).toFixed(0)}%.`
          : language === 'ar'
          ? `كل اقتراح مقبول يضيف قيمة إجماعه إلى المتوسط. يبلغ مقياس الإجماع الحالي ${(currentMeter * 100).toFixed(0)}%.`
          : `Each accepted suggestion adds its consensus value to the average. The current consensus meter is ${(currentMeter * 100).toFixed(0)}%.`}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-200 text-slate-600">
              <th className={`py-2 px-3 font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>#</th>
              <th className={`py-2 px-3 font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>{colTitle}</th>
              <th className="py-2 px-3 font-semibold text-center">{colPro}</th>
              <th className="py-2 px-3 font-semibold text-center">{colCon}</th>
              <th className="py-2 px-3 font-semibold text-center">{colConsensus}</th>
              <th className="py-2 px-3 font-semibold text-center">{colThreshold}</th>
              <th className="py-2 px-3 font-semibold text-center">{colRunning}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const suggestionTitle = s.title || '';
              const contentSnippet = s.newContent
                ? s.newContent.replace(/<[^>]*>/g, '').trim().slice(0, 80)
                : '';
              const Icon = TypeIcon(s);
              return (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className={`py-3 px-3 text-slate-400 font-medium ${isRTL ? 'text-right' : 'text-left'}`}>{s.index}</td>
                  <td className={`py-3 px-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.type === 'new_section' ? 'bg-green-50 text-green-700' :
                          s.type === 'delete_section' ? 'bg-red-50 text-red-700' :
                          'bg-blue-50 text-blue-700'
                        }`}>
                          <Icon className="w-3 h-3" />
                          {typeLabel(s)}
                        </span>
                        <Link
                          to={`${createPageUrl("suggestiondetail")}?id=${s.id}`}
                          className="text-slate-700 hover:text-indigo-600 hover:underline font-medium text-sm truncate max-w-xs inline-flex items-center gap-1"
                        >
                          {suggestionTitle}
                          <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                        </Link>
                      </div>
                      {contentSnippet && (
                        <p className="text-xs text-slate-400 truncate max-w-md">{contentSnippet}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                      <ThumbsUp className="w-3.5 h-3.5" />
                      {s.pro}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-flex items-center gap-1 text-red-500 font-medium">
                      <ThumbsDown className="w-3.5 h-3.5" />
                      {s.con}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-block px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs">
                      {(s.consensus * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-bold text-amber-700 text-sm">{s.thresholdUsed}</span>
                      <span className="text-[10px] text-slate-400">
                        {language === 'he' ? `${(s.prevRunningAvg * 100).toFixed(0)}% × ${s.participants}` : language === 'ar' ? `${(s.prevRunningAvg * 100).toFixed(0)}% × ${s.participants}` : `${(s.prevRunningAvg * 100).toFixed(0)}% × ${s.participants}`}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-purple-500" />
                      <span className="font-bold text-purple-700">{(s.runningAvg * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}