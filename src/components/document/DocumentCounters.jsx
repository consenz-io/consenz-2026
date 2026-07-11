import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Users, MessageSquare, TrendingUp, Clock, ChevronDown } from "lucide-react";
import CounterTooltip from "./CounterTooltip";

/**
 * Document counter cards — open suggestions nudge + 4 stat cards (contributors,
 * comments, consensus, versions). Pure presentational, extracted from DocumentView.
 */
const DocumentCounters = React.memo(function DocumentCounters({
  pendingSuggestions,
  currentSuggestionIndex,
  language,
  t,
  contributorsCount,
  allCommentsCount,
  sectionCommentsCount,
  consensusPct,
  versionCount,
  documentId,
  onShowContributors,
  onShowSuggestionNav,
}) {
  return (
    <div className="document-counters flex flex-col gap-2 md:gap-3 w-full max-w-full">
      {/* Open suggestions — inline nudge */}
      {pendingSuggestions.length > 0 ? (
        <div className="relative group/tip w-full">
          <button
            type="button"
            onClick={() => { onShowSuggestionNav(); }}
            className="w-full flex items-center justify-center gap-3 px-3 py-2.5 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 hover:border-orange-300 transition-all group cursor-pointer"
            aria-label={`${pendingSuggestions.length} ${language === 'he' ? 'הצעות פתוחות' : 'open suggestions'} — ${language === 'he' ? 'לחץ לניווט' : 'click to navigate'}`}
          >
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-orange-500 text-white text-sm font-bold shrink-0">
              {pendingSuggestions.length}
            </span>
            <span className="text-sm font-medium text-orange-800 text-center">
              {language === 'he' ? 'הצעות ממתינות לאישור' : language === 'ar' ? 'اقتراحات بانتظار الموافقة' : 'Suggestions pending approval'}
            </span>
            <span className="shrink-0 flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full animate-bounce transition-colors">
              {language === 'he' ? 'להצבעה' : language === 'ar' ? 'للتصويت' : 'Vote now'}
              <ChevronDown className="w-3 h-3" />
            </span>
          </button>
          <div className={`absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 bg-slate-800 text-white text-xs rounded-lg px-3 py-2.5 shadow-xl opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity duration-200 text-center leading-relaxed`}>
            {language === 'he'
              ? 'הצעות פתוחות הן שינויים שמשתתפים הציעו למסמך וממתינות להצבעה. ההצבעה שלך קובעת אם השינוי יתקבל — כל קול משפיע!'
              : language === 'ar'
              ? 'الاقتراحات المفتوحة هي تغييرات مقترحة من المشاركين وتنتظر التصويت. صوتك يحدد ما إذا كان التغيير سيُقبل — كل صوت مهم!'
              : 'Open suggestions are changes proposed by participants, waiting for a vote. Your vote determines whether the change is accepted — every vote counts!'}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
          </div>
        </div>
      ) : (
        <div className="w-full flex items-center justify-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 bg-white/60">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 text-slate-500 text-sm font-bold shrink-0">0</span>
          <span className="text-sm text-slate-400 text-center">
            {language === 'he' ? 'אין הצעות פתוחות כרגע' : language === 'ar' ? 'لا توجد اقتراحات مفتوحة' : 'No open suggestions'}
          </span>
        </div>
      )}

      {/* Other counters — 4 columns */}
      <div className="grid grid-cols-4 gap-1.5 md:gap-2 w-full">
        <CounterTooltip
          text={language === 'he'
            ? 'מספר המשתתפים שתרמו למסמך — יצרו הצעות, הצביעו, הגיבו או חתמו על המסמך. לחץ לפרטים.'
            : language === 'ar'
            ? 'عدد المشاركين الذين ساهموا في الوثيقة — اقترحوا، صوّتوا، علّقوا أو وقّعوا. انقر للتفاصيل.'
            : 'Number of participants who contributed — created suggestions, voted, commented, or signed. Click for details.'}
        >
          <button
            type="button"
            className="w-full bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg p-1.5 md:p-2.5 flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
            onClick={onShowContributors}
            aria-label={`${contributorsCount} ${t('contributors')}`}
          >
            <Users className="w-3.5 h-3.5 md:w-5 md:h-5 text-blue-600" aria-hidden="true" />
            <div className="text-sm md:text-lg font-bold text-slate-900">{contributorsCount}</div>
            <div className="text-[8px] md:text-[10px] text-slate-500 text-center leading-tight">{t('contributors')}</div>
          </button>
        </CounterTooltip>

        <CounterTooltip
          text={language === 'he'
            ? 'סה״כ תגובות שנכתבו במסמך — על הסעיפים, ההצעות והדיון הכללי. לחץ לצפייה בכל התגובות.'
            : language === 'ar'
            ? 'إجمالي التعليقات في الوثيقة — على الأقسام والاقتراحات والنقاش العام. انقر لعرض جميع التعليقات.'
            : 'Total comments across the document — on sections, suggestions, and general discussion. Click to view all.'}
        >
          <Link
            to={`${createPageUrl("DocumentComments")}?id=${documentId}`}
            className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg p-1.5 md:p-2.5 flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:border-green-400 hover:shadow-md transition-all"
            aria-label={`${allCommentsCount} ${language === 'he' ? 'תגובות' : language === 'ar' ? 'تعليقات' : 'comments'}`}
          >
            <MessageSquare className="w-3.5 h-3.5 md:w-5 md:h-5 text-green-600" aria-hidden="true" />
            <div className="text-sm md:text-lg font-bold text-slate-900">{allCommentsCount}</div>
            <div className="text-[8px] md:text-[10px] text-slate-500 text-center leading-tight">{language === 'he' ? 'תגובות' : language === 'ar' ? 'تعليقات' : 'Comments'}</div>
          </Link>
        </CounterTooltip>

        <CounterTooltip
          text={language === 'he'
            ? 'מד הקונצנזוס משקף את רמת ההסכמה על גרסת המסמך הנוכחית. מחושב מהממוצע של כל ההצעות שאושרו. לחץ להסבר מפורט.'
            : language === 'ar'
            ? 'مقياس الإجماع يعكس مستوى الاتفاق على النسخة الحالية. يُحسب من متوسط جميع الاقتراحات المقبولة. انقر لشرح مفصل.'
            : 'The consensus meter reflects the level of agreement on the current document version. Calculated from the average of all accepted suggestions. Click for details.'}
        >
          <Link
            to={`${createPageUrl("UnderstandingConsensus")}?id=${documentId}`}
            className="consensus-meter bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg p-1.5 md:p-2.5 flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:border-purple-400 hover:shadow-md transition-all"
            aria-label={t('consensus')}
          >
            <TrendingUp className="w-3.5 h-3.5 md:w-5 md:h-5 text-purple-600" aria-hidden="true" />
            <div className="text-sm md:text-lg font-bold text-slate-900">{consensusPct}%</div>
            <div className="text-[8px] md:text-[10px] text-slate-500 text-center leading-tight">{t('consensus')}</div>
          </Link>
        </CounterTooltip>

        <CounterTooltip
          text={language === 'he'
            ? 'מספר גרסאות שנשמרו בהיסטוריית המסמך — כל אישור הצעה או עריכה יוצרים גרסה חדשה. לחץ לצפייה בגרסאות קודמות.'
            : language === 'ar'
            ? 'عدد الإصدارات المحفوظة في سجل الوثيقة — كل قبول اقتراح أو تعديل ينشئ إصدارًا جديدًا. انقر لعرض الإصدارات السابقة.'
            : 'Number of versions saved in the document history — each accepted suggestion or edit creates a new version. Click to view previous versions.'}
        >
          <Link
            to={`${createPageUrl("DocumentCleanView")}?id=${documentId}`}
            className="versions-tab-button bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg p-1.5 md:p-2.5 flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:border-teal-400 hover:shadow-md transition-all"
            aria-label={`${versionCount} ${language === 'he' ? 'גרסאות' : 'versions'}`}
          >
            <Clock className="w-3.5 h-3.5 md:w-5 md:h-5 text-teal-600" aria-hidden="true" />
            <div className="text-sm md:text-lg font-bold text-slate-900">{versionCount}</div>
            <div className="text-[8px] md:text-[10px] text-slate-500 text-center leading-tight">{language === 'he' ? 'גרסאות' : language === 'ar' ? 'الإصدارات' : 'Versions'}</div>
          </Link>
        </CounterTooltip>
      </div>
    </div>
  );
});

export default DocumentCounters;