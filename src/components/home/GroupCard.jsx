import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Users, Lock, Globe } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import TranslatableText from "@/components/utils/TranslatableText";

export default function GroupCard({ group, docCount, participantsCount, isAdmin }) {
  const { language } = useLanguage();

  const statusLabel = {
    private: { he: 'פרטי', ar: 'خاص', en: 'Private' },
    hidden:  { he: 'חסוי', ar: 'مخفي', en: 'Hidden' },
    public:  { he: 'ציבורי', ar: 'عام', en: 'Public' },
  };

  const docsLabel    = { he: 'מסמכים', ar: 'مستندات', en: 'documents' };
  const membersLabel = { he: 'משתתפים', ar: 'مشاركون', en: 'participants' };
  const adminLabel   = { he: 'מנהל', ar: 'مدير', en: 'Admin' };

  const privacyVisual = {
    private: { cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Lock },
    hidden:  { cls: 'bg-slate-100 text-slate-700 border-slate-300', Icon: Lock },
    public:  { cls: 'bg-green-50 text-green-700 border-green-200', Icon: Globe },
  };
  const visual = privacyVisual[group.status] || privacyVisual.public;

  return (
    <Link
      to={`${createPageUrl("GroupView")}?id=${group.id}`}
      aria-label={`${group.name}. ${statusLabel[group.status]?.[language] || ''}. ${docCount} ${docsLabel[language]}, ${participantsCount} ${membersLabel[language]}`}
    >
      <Card className="bg-white border-slate-200 hover:shadow-lg hover:border-blue-300 transition-all duration-200 h-full">
        <CardHeader>
          <div className="flex flex-col gap-2">
            <CardTitle className="text-lg">
              <TranslatableText text={group.name} className="font-bold break-words" />
            </CardTitle>
            <div className="flex flex-wrap items-center gap-1">
              <Badge variant="outline" className={visual.cls}>
                <visual.Icon className="w-3 h-3 mr-1" />
                {statusLabel[group.status]?.[language] || statusLabel.public[language]}
              </Badge>
              {isAdmin && (
                <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                  {adminLabel[language] || adminLabel.en}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {group.description && (
            <div className="mb-3">
              <TranslatableText text={group.description} className="text-sm text-slate-600 line-clamp-2" />
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <FileText className="w-4 h-4" aria-hidden="true" />
              <span>{docCount} {docsLabel[language] || docsLabel.en}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Users className="w-4 h-4" aria-hidden="true" />
              <span>{participantsCount} {membersLabel[language] || membersLabel.en}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}