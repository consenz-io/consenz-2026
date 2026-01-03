import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Lock, Globe, Plus, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";
import PageHeader from "@/components/PageHeader";

export default function Groups() {
  const { t, isRTL, language } = useLanguage();

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => base44.entities.Group.list('-created_date'),
    initialData: [],
  });

  const { data: groupMembers, isLoading: membersLoading } = useQuery({
    queryKey: ['groupMembers'],
    queryFn: () => base44.entities.GroupMember.list(),
    initialData: [],
  });

  const { data: documents } = useQuery({
    queryKey: ['documents'],
    queryFn: () => base44.entities.Document.list(),
    initialData: [],
  });

  // Filter groups based on visibility and membership
  const visibleGroups = groups.filter(group => {
    if (group.status === 'public') return true;
    if (!currentUser) return false;
    
    // Check if user is a member
    const isMember = groupMembers.some(
      m => m.groupId === group.id && m.userId === currentUser.id
    );
    
    // For private groups, show to all but require membership to join
    if (group.status === 'private') return true;
    
    // For hidden groups, show only to members, group creator, or system admin
    if (group.status === 'hidden') {
      const isAdmin = currentUser.role === 'admin';
      const isCreator = group.created_by === currentUser.email;
      return isMember || isAdmin || isCreator;
    }
    
    return isMember;
  });

  // Group documents count
  const getGroupDocumentsCount = (groupId) => {
    return documents.filter(doc => doc.groupId === groupId).length;
  };

  // Group members count
  const getGroupMembersCount = (groupId) => {
    return groupMembers.filter(m => m.groupId === groupId).length;
  };

  // Check if user is admin of a group
  const isGroupAdmin = (groupId) => {
    if (!currentUser) return false;
    return groupMembers.some(
      m => m.groupId === groupId && m.userId === currentUser.id && m.role === 'admin'
    );
  };

  if (groupsLoading || membersLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-12 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

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
            {visibleGroups.map((group) => (
              <Link key={group.id} to={`${createPageUrl("GroupView")}?id=${group.id}`}>
                <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-xl truncate">{group.name}</CardTitle>
                        {group.description && (
                          <CardDescription className="line-clamp-2 mt-2">
                            {group.description}
                          </CardDescription>
                        )}
                      </div>
                      <Badge variant="outline" className={
                        group.status === 'private' 
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : group.status === 'hidden'
                          ? 'bg-slate-100 text-slate-700 border-slate-300'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }>
                        {group.status === 'private' ? (
                          <>
                            <Lock className="w-3 h-3 mr-1" />
                            {language === 'he' ? 'פרטי' : language === 'ar' ? 'خاص' : 'Private'}
                          </>
                        ) : group.status === 'hidden' ? (
                          <>
                            <Lock className="w-3 h-3 mr-1" />
                            {language === 'he' ? 'חסוי' : language === 'ar' ? 'مخفي' : 'Hidden'}
                          </>
                        ) : (
                          <>
                            <Globe className="w-3 h-3 mr-1" />
                            {language === 'he' ? 'ציבורי' : language === 'ar' ? 'عام' : 'Public'}
                          </>
                        )}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        <span>{getGroupDocumentsCount(group.id)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{getGroupMembersCount(group.id)}</span>
                      </div>
                      {isGroupAdmin(group.id) && (
                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                          {language === 'he' ? 'מנהל' : language === 'ar' ? 'مدير' : 'Admin'}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}