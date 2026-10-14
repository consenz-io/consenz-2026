import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import GroupCard from "./GroupCard";

export default function GroupsSection({ groups, groupsLoading, groupMembers, documents, user, groupParticipantCounts }) {
  const { language } = useLanguage();

  // Pre-build O(1) lookup maps — replaces O(groups × members) filter/some per render.
  const membersByGroupId = React.useMemo(() => {
    const map = new Map();
    for (const m of groupMembers) {
      if (!map.has(m.groupId)) map.set(m.groupId, []);
      map.get(m.groupId).push(m);
    }
    return map;
  }, [groupMembers]);

  const docsByGroupId = React.useMemo(() => {
    const map = new Map();
    for (const d of documents) {
      if (!map.has(d.groupId)) map.set(d.groupId, []);
      map.get(d.groupId).push(d);
    }
    return map;
  }, [documents]);

  const userMembershipGroupIds = React.useMemo(() => {
    if (!user?.id) return new Set();
    return new Set(groupMembers.filter(m => m.userId === user.id).map(m => m.groupId));
  }, [groupMembers, user?.id]);

  const userAdminGroupIds = React.useMemo(() => {
    if (!user?.id) return new Set();
    return new Set(groupMembers.filter(m => m.userId === user.id && m.role === 'admin').map(m => m.groupId));
  }, [groupMembers, user?.id]);

  const visibleGroups = React.useMemo(() => {
    if (!user) return groups.filter(g => g.status !== 'hidden');
    const isSystemAdmin = user.role === 'admin';
    return groups.filter(group => {
      if (group.status !== 'hidden') return true;
      const isMember  = userMembershipGroupIds.has(group.id);
      const isCreator = group.created_by === user.email;
      return isMember || isCreator || isSystemAdmin;
    });
  }, [groups, user, userMembershipGroupIds]);

  const headingText   = { he: 'קבוצות פעילות', ar: 'مجموعات نشطة', en: 'Active Groups' };
  const subText       = { he: 'הצטרפו לקבוצות ושתפו פעולה על מסמכים משותפים', ar: 'انضموا إلى المجموعات وتعاونوا على وثائق مشتركة', en: 'Join groups and collaborate on shared documents' };
  const noGroupsTitle = { he: 'אין קבוצות עדיין', ar: 'لا توجد مجموعات بعد', en: 'No groups yet' };
  const noGroupsSub   = { he: 'היו הראשונים ליצור קבוצה', ar: 'كن أول من ينشئ مجموعة', en: 'Be the first to create a group' };
  const createLabel   = { he: 'צור קבוצה', ar: 'إنشاء مجموعة', en: 'Create Group' };
  const createNewLabel = { he: 'יצירת קבוצה חדשה', ar: 'إنشاء مجموعة جديدة', en: 'Create New Group' };

  return (
    <section id="recent-documents-section" className="max-w-7xl mx-auto px-6 py-16" aria-labelledby="groups-heading">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 id="groups-heading" className="text-3xl font-bold text-slate-900">
            {headingText[language] || headingText.en}
          </h2>
          <p className="text-slate-600 mt-2">{subText[language] || subText.en}</p>
        </div>
      </div>

      {groupsLoading ? (
        <div className="groups-list grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="bg-white border-slate-200">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : visibleGroups.length === 0 ? (
        <Card className="bg-white border-slate-200">
          <CardContent className="p-12 text-center">
            <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">{noGroupsTitle[language] || noGroupsTitle.en}</h3>
            <p className="text-slate-600 mb-4">{noGroupsSub[language] || noGroupsSub.en}</p>
            {user && (
              <Link to={createPageUrl("CreateGroup")}>
                <Button>{createLabel[language] || createLabel.en}</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="groups-list grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleGroups.map(group => {
            const groupDocs   = docsByGroupId.get(group.id) || [];
            const participants = groupParticipantCounts[group.id] ?? 1;

            return (
              <GroupCard
                key={group.id}
                group={group}
                docCount={groupDocs.length}
                participantsCount={participants}
                isAdmin={userAdminGroupIds.has(group.id)}
              />
            );
          })}
        </div>
      )}

      {user && visibleGroups.length > 0 && (
        <div className="flex justify-center mt-12">
          <Link to={createPageUrl("CreateGroup")}>
            <Button variant="outline" size="lg" className="border-blue-300 text-blue-700 hover:bg-blue-50">
              {createNewLabel[language] || createNewLabel.en}
            </Button>
          </Link>
        </div>
      )}
    </section>
  );
}