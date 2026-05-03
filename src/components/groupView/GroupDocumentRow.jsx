import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Users, Bell, Languages, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function GroupDocumentRow({ doc, unvotedCount, participantCount, translations, translating, onTranslate }) {
  const { language } = useLanguage();

  const unvotedLabel = {
    he: `${unvotedCount} ${unvotedCount === 1 ? 'הצעה' : 'הצעות'} ממתינות להצבעתך`,
    ar: `${unvotedCount} اقتراح بانتظار تصويتك`,
    en: `${unvotedCount} awaiting vote`,
  };

  return (
    <Link
      to={`${createPageUrl("DocumentView")}?id=${doc.id}`}
      className={`block overflow-hidden border rounded-lg hover:bg-slate-50 transition-colors ${unvotedCount > 0 ? 'ring-2 ring-orange-400' : ''}`}
    >
      {unvotedCount > 0 && (
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-3 py-1.5 text-xs font-medium flex items-center gap-2">
          <Bell className="w-3 h-3 animate-pulse" />
          <span>{unvotedLabel[language] || unvotedLabel.en}</span>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900">{translations[`doc-title-${doc.id}`] || doc.title}</h3>
              <button
                onClick={(e) => { e.preventDefault(); onTranslate(`doc-title-${doc.id}`, doc.title); }}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 hover:bg-blue-50 transition-colors shrink-0"
              >
                {translating[`doc-title-${doc.id}`] ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Languages className="w-2.5 h-2.5" />}
              </button>
            </div>
            {doc.description && (
              <div className="flex items-start gap-2 mt-1">
                <p
                  className="text-sm text-slate-500 line-clamp-2 flex-1"
                  dangerouslySetInnerHTML={{ __html: translations[`doc-desc-${doc.id}`] || doc.description }}
                />
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    const tmp = window.document.createElement('div');
                    tmp.innerHTML = doc.description;
                    onTranslate(`doc-desc-${doc.id}`, tmp.textContent || tmp.innerText || doc.description);
                  }}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 hover:bg-blue-50 transition-colors shrink-0 mt-0.5"
                >
                  {translating[`doc-desc-${doc.id}`] ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Languages className="w-2.5 h-2.5" />}
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </Link>
  );
}