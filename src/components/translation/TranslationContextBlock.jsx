import React from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";

const labels = {
  he: {
    context: "הקשר",
    commentOnSuggestion: "תגובה על הצעת עריכה",
    commentOnArgument: "תגובה על טיעון בהצעת עריכה",
    commentOnSection: "תגובה על סעיף",
    commentOnDocument: "תגובה על המסמך",
    suggestion: "הצעת עריכה",
    section: "סעיף",
    version: "גרסת סעיף",
    topic: "נושא",
    document: "מסמך",
    inTopic: "בנושא",
    inDocument: "במסמך",
    quote: "הנוסח המקושר",
    open: "מעבר לפריט המקושר",
    deleted: "התוכן המקושר כבר לא קיים",
  },
  ar: {
    context: "السياق",
    commentOnSuggestion: "تعليق على اقتراح تعديل",
    commentOnArgument: "تعليق على حجة في اقتراح تعديل",
    commentOnSection: "تعليق على بند",
    commentOnDocument: "تعليق على الوثيقة",
    suggestion: "اقتراح تعديل",
    section: "بند",
    version: "إصدار بند",
    topic: "موضوع",
    document: "وثيقة",
    inTopic: "في موضوع",
    inDocument: "في وثيقة",
    quote: "الصياغة المرتبطة",
    open: "الانتقال إلى العنصر المرتبط",
    deleted: "المحتوى المرتبط لم يعد موجوداً",
  },
  en: {
    context: "Context",
    commentOnSuggestion: "Comment on an edit proposal",
    commentOnArgument: "Comment on an argument in an edit proposal",
    commentOnSection: "Comment on a section",
    commentOnDocument: "Comment on the document",
    suggestion: "Edit proposal",
    section: "Section",
    version: "Section version",
    topic: "Topic",
    document: "Document",
    inTopic: "in topic",
    inDocument: "in document",
    quote: "Linked wording",
    open: "Go to linked item",
    deleted: "The linked content no longer exists",
  },
};

function headline(context, text) {
  const { source, targetKind } = context;
  if (source === "comment") {
    if (targetKind === "suggestion") return text.commentOnSuggestion;
    if (targetKind === "argument") return text.commentOnArgument;
    if (targetKind === "section") return text.commentOnSection;
    return text.commentOnDocument;
  }
  return text[targetKind] || text.context;
}

export default function TranslationContextBlock({ context, language }) {
  const text = labels[language] || labels.en;
  if (!context) return null;

  const { title, subtitle, quote, url } = context;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-1">
      <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">
        {text.context}
      </p>
      <p className="text-sm text-slate-800">
        <span>{headline(context, text)}</span>
        {title && (
          <span>
            {context.titleKind === "topic" ? ` · ${text.inTopic} ` : " — "}
            <span className="font-semibold">{title}</span>
          </span>
        )}
      </p>
      {subtitle && (
        <p className="text-xs text-slate-600">
          {text.inDocument}: <span className="font-medium">{subtitle}</span>
        </p>
      )}
      {quote && (
        <div className="pt-1">
          <p className="text-[11px] text-slate-500">{text.quote}:</p>
          <p className="text-xs text-slate-700 bg-white/80 border border-blue-100 rounded-md p-2 leading-relaxed">
            {quote}
          </p>
        </div>
      )}
      {url && (
        <Link
          to={url}
          className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 hover:underline pt-1"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          {text.open}
        </Link>
      )}
    </div>
  );
}