import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Bell } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import TranslatableContent from "@/components/document/TranslatableContent";
import TranslatableText from "@/components/utils/TranslatableText";

export default function GroupDocumentRow({ doc, unvotedCount, participantCount }) {
  const { language } = useLanguage();

  const unvotedLabel = {
    he: `${unvotedCount} ${unvotedCount === 1 ? 'הצעה' : 'הצעות'} ממתינות להצבעתך`,
    ar: `${unvotedCount} اقتراح بانتظار تصويتك`,
    en: `${unvotedCount} awaiting vote`,
  };

  const handleClick = () => {
    window.dispatchEvent(new Event('document:entered'));
  };

  return (
    <Link
      to={`${createPageUrl("DocumentView")}?id=${doc.id}`}
      className={`block overflow-hidden border rounded-lg hover:bg-slate-50 transition-colors ${unvotedCount > 0 ? 'ring-2 ring-orange-400' : ''}`}
      onClick={handleClick}
    >
      {unvotedCount > 0 && (
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-3 py-1.5 text-xs font-medium flex items-center gap-2">
          <Bell className="w-3 h-3 animate-pulse" />
          <span>{unvotedLabel[language] || unvotedLabel.en}</span>
        </div>
      )}
      <div className="p-4">
        <TranslatableContent
          content={doc.title}
          entity={doc}
          entityType="Document"
          fieldName="title"
          renderContent={(text) => <h3 className="font-semibold text-slate-900">{text}</h3>}
        />
        {doc.description && (
          <TranslatableContent
            content={doc.description}
            entity={doc}
            entityType="Document"
            fieldName="description"
            className="text-sm text-slate-500 mt-1"
          />
        )}
      </div>
    </Link>
  );
}