import React from "react";
import { CheckCircle, ThumbsUp, ThumbsDown, TrendingUp } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

/**
 * Lists all accepted suggestions with their vote counts, individual consensus
 * calculation, and how each contributed to the running consensus meter average.
 */
export default function AcceptedSuggestionsConsensusList({ suggestions, currentMeter }) {
  const { language, isRTL } = useLanguage();

  const accepted = (suggestions || [])
    .filter(s => s.status === 'accepted')
    .sort((a, b) => new Date(a.updated_date) - new Date(b.updated_date));

  if (accepted.length === 0) {
    return (
      <div className={`text-center py-8 text-slate-400 ${isRTL ? 'text-right' : 'text-left'}`}>
        {language === 'he' ? 'עדיין לא אושרו הצעות במסמך זה' : language === 'ar' ? 'لم يتم قبول أي اقتراحات بعد' : 'No suggestions have been accepted yet'}
      </div>
    );
  }

  // Compute running average
  let runningSum = 0;
  const rows = accepted.map((s, i) => {
    const pro = s.proVotes || 0;
    const con = s.conVotes || 0;
    const total = pro + con;
    const consensus = total > 0 ? pro / total : (s.suggestionConsensus || 0);
    runningSum += Math.min(1, consensus);
    const runningAvg = runningSum / (i + 1);
    return { ...s, pro, con, total, consensus, runningAvg, index: i + 1 };
  });

  const title = language === 'he' ? 'היסטוריית הצעות שהתקבלו וחישוב הקונצנזוס' : language === 'ar' ? 'سجل الاقتراحات المقبولة وحساب الإجماع' : 'Accepted Suggestions History & Consensus Calculation';
  const colTitle = language === 'he' ? 'הצעה' : language === 'ar' ? 'الاقتراح' : 'Suggestion';
  const colPro = language === 'he' ? 'בעד' : language === 'ar' ? 'مع' : 'Pro';
  const colCon = language === 'he' ? 'נגד' : language === 'ar' ? 'ضد' : 'Con';
  const colConsensus = language === 'he' ? 'קונצנזוס הצעה' : language === 'ar' ? 'إجماع الاقتراح' : 'Suggestion Consensus';
  const colRunning = language === 'he' ? 'ממוצע מצטבר' : language === 'ar' ? 'المتوسط التراكمي' : 'Running Average';

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
              <th className="py-2 px-3 font-semibold text-center">{colRunning}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const title = s.title || (s.newContent ? s.newContent.replace(/<[^>]*>/g, '').slice(0, 60) : '');
              return (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className={`py-3 px-3 text-slate-400 font-medium ${isRTL ? 'text-right' : 'text-left'}`}>{s.index}</td>
                  <td className={`py-3 px-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 line-clamp-2 max-w-xs">{title}</span>
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