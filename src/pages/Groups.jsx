import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Lock, Globe, Plus, FileText } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import PageHeader from "@/components/PageHeader";
import { useGroupsData } from "@/components/groups/useGroupsData";

export default function Groups() {
  const { isRTL, language } = useLanguage();
  const { currentUser, visibleGroups, isLoading, getDocCount, getMemberCount, isGroupAdmin } = useGroupsData();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-12 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Skeleton className="h-48" /><Skeleton className="h-48" /><Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  const statusBadge = (status) => {
    if (status === 'private') return { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: { he: 'פרטי', ar: 'خاص', en: 'Private' }, Icon: Lock };
    if (status === 'hidden')  return { cls: 'bg-slate-100 text-slate-700 border-slate-300', label: { he: 'חסוי', ar: 'مخفي', en: 'Hidden' }, Icon: Lock };
    return { cls: 'bg-blue-50 text-blue-700 border-blue-200', label: { he: 'ציבורי', ar: 'عام', en: 'Public' }, Icon: Globe };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <PageHeader
            title={language === 'he' ? 'קבוצות' : language === 'ar' ? 'مجموعات' : 'Groups'}
            backUrl={createPageUrl("Home")}
          />
          {currentUser && (
            <Link to={createPageUrl("CreateGroup")}>
              <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
                <Plus className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {language === 'he' ? 'קבוצה חדשה' : language === 'ar' ? 'مجموعة جديدة' : 'New Group'}
              </Button>
            </Link>
          )}
        </div>

        {visibleGroups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-16 h-16 mx-auto text-slate-400 mb-4" />
              <p className="text-slate-500">
                {language === 'he' ? 'אין עדיין קבוצות' : language === 'ar' ? 'لا توجد مجموعات بعد' : 'No groups yet'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleGroups.map(group => {
              const badge = statusBadge(group.status);
              return (
                <Link key={group.id} to={`${createPageUrl("GroupView")}?id=${group.id}`}>
                  <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-xl truncate">{group.name}</CardTitle>
                          {group.description && (
                            <CardDescription className="line-clamp-2 mt-2">{group.description}</CardDescription>
                          )}
                        </div>
                        <Badge variant="outline" className={badge.cls}>
                          <badge.Icon className="w-3 h-3 mr-1" />
                          {badge.label[language] || badge.label.en}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          <span>{getDocCount(group.id)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{getMemberCount(group.id)} {language === 'he' ? 'חברים' : language === 'ar' ? 'أعضاء' : 'members'}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}