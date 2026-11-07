import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Clock, CalendarX } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { parseUserDate } from "@/components/utils/dateFormatter";
import RejectedSuggestionComments from "./RejectedSuggestionComments";
import RejectedSuggestionThreshold from "./RejectedSuggestionThreshold";

const LABELS = {
  he: {
    proposed: "נוסח ההצעה",
    created: "נוצרה ב",
    rejected: "נדחתה ב",
    votingEnded: "ההצבעה הסתיימה ב",
    viewDetails: "לפרטי ההצעה",
    newSection: "סעיף חדש",
    editSection: "עריכת סעיף",
    deleteSection: "מחיקת סעיף",
    editSuggestion: "עריכת הצעה",
    by: "על ידי",
  },
  ar: {
    proposed: "نص الاقتراح",
    created: "أُنشئ في",
    rejected: "رُفض في",
    votingEnded: "انتهى التصويت في",
    viewDetails: "تفاصيل الاقتراح",
    newSection: "قسم جديد",
    editSection: "تعديل قسم",
    deleteSection: "حذف قسم",
    editSuggestion: "تعديل اقتراح",
    by: "بواسطة",
  },
  en: {
    proposed: "Proposed wording",
    created: "Created",
    rejected: "Rejected",
    votingEnded: "Voting ended",
    viewDetails: "View proposal details",
    newSection: "New section",
    editSection: "Edit section",
    deleteSection: "Delete section",
    editSuggestion: "Edit proposal",
    by: "by",
  },
};

const LOCALES = { he: "he-IL", ar: "ar-SA", en: "en-US" };

export default function RejectedSuggestionCard({ suggestion, documentId, document, language, creatorName, comments }) {
  const labels = LABELS[language] || LABELS.en;
  const isRTL = language === 'he' || language === 'ar';
  const ForwardArrow = isRTL ? ArrowLeft : ArrowRight;
  const formatDate = (value) => (value ? parseUserDate(value).toLocaleDateString(LOCALES[language] || "en-US") : "");
  const typeLabel = labels[suggestion.type] || suggestion.type;
  const detailUrl = `${createPageUrl("SuggestionDetail")}?id=${suggestion.id}&documentId=${documentId}`;

  return (
    <Link to={detailUrl}>
      <Card className="bg-white border-slate-200 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer">
        <CardHeader>
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                  {language === "he" ? "נדחה" : language === "ar" ? "مرفوض" : "Rejected"}
                </Badge>
                <Badge variant="outline">{typeLabel}</Badge>
              </div>
              <CardTitle className="text-lg">{suggestion.title}</CardTitle>
            </div>
            <ForwardArrow className="w-5 h-5 text-slate-400 flex-shrink-0" />
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-3">
            {suggestion.newContent && (
              <div className="bg-slate-50 p-3 rounded border border-slate-200">
                <p className="text-xs font-medium text-slate-500 mb-1">{labels.proposed}</p>
                <div
                  className="text-sm text-slate-700 line-clamp-3 [&_p]:m-0 [&_p+p]:mt-2"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(suggestion.newContent) }}
                />
              </div>
            )}

            {suggestion.explanation && (
              <p className="text-sm text-slate-600 line-clamp-2">{suggestion.explanation}</p>
            )}

            <RejectedSuggestionThreshold
              suggestion={suggestion}
              document={document}
              language={language}
            />

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {labels.created} {formatDate(suggestion.created_date)}
              </span>
              {suggestion.updated_date && (
                <span className="flex items-center gap-1">
                  <CalendarX className="w-3.5 h-3.5" />
                  {labels.rejected} {formatDate(suggestion.updated_date)}
                </span>
              )}
              {suggestion.timerEndsAt && (
                <span>{labels.votingEnded} {formatDate(suggestion.timerEndsAt)}</span>
              )}
              <span>
                {labels.by} {creatorName}
              </span>
            </div>

            <RejectedSuggestionComments comments={comments} language={language} />

            <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-600">
              {labels.viewDetails}
              <ForwardArrow className="w-4 h-4" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}