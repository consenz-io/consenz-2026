import React from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { formatLocalDate } from "@/components/utils/dateFormatter";

const actionLabels = {
  suggestion_created: { he: 'הצעה נוצרה', ar: 'تم إنشاء مقترح', en: 'Suggestion created' },
  vote_received: { he: 'התקבלה הצבעה', ar: 'تم استلام تصويت', en: 'Vote received' },
  vote_canceled: { he: 'הצבעה בוטלה', ar: 'تم إلغاء تصويت', en: 'Vote canceled' },
  suggestion_accepted: { he: 'הצעה התקבלה', ar: 'تم قبول مقترح', en: 'Suggestion accepted' },
  vote_influenced_acceptance: { he: 'הצבעה השפיעה על קבלה', ar: 'أثر التصويت على القبول', en: 'Vote influenced acceptance' },
  comment_like_received: { he: 'קיבלת לייק על תגובה', ar: 'حصلت على إعجاب على تعليق', en: 'Comment like received' },
  comment_like_removed: { he: 'בוטל לייק על תגובה', ar: 'تم إلغاء إعجاب على تعليق', en: 'Comment like removed' },
};

export default function PointsHistoryList({ transactions = [] }) {
  const { language } = useLanguage();
  const navigate = useNavigate();

  if (transactions.length === 0) {
    return (
      <p className="text-slate-500 text-sm text-center py-8">
        {language === 'he' ? 'אין היסטוריית נקודות עדיין' : language === 'ar' ? 'لا يوجد تاريخ نقاط بعد' : 'No points history yet'}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx) => {
        const isPositive = (tx.amount || 0) > 0;
        const label = actionLabels[tx.action]?.[language] || actionLabels[tx.action]?.en || tx.action;
        const clickable = !!tx.actionUrl;
        return (
          <div
            key={tx.id}
            onClick={clickable ? () => navigate(tx.actionUrl) : undefined}
            className={`flex items-center justify-between gap-3 p-3 rounded-lg border bg-white hover:shadow-sm transition-all ${clickable ? 'cursor-pointer hover:border-blue-300' : ''}`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${
                isPositive ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {isPositive
                  ? <TrendingUp className="w-4 h-4 text-green-600" />
                  : <TrendingDown className="w-4 h-4 text-red-600" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant="outline" className="text-xs font-semibold">
                    {label}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {formatLocalDate(tx.created_date, 'DD/MM/YYYY')}
                  </span>
                </div>
                {tx.description && (
                  <p className="text-sm text-slate-700 truncate">{tx.description}</p>
                )}
              </div>
            </div>
            <span className={`text-sm font-bold flex-shrink-0 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? '+' : ''}{tx.amount}
            </span>
          </div>
        );
      })}
    </div>
  );
}