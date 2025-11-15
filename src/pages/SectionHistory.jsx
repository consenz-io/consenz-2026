import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, History, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";
import SectionDiff from "../components/document/SectionDiff";
import CommentsSection from "../components/document/CommentsSection";

export default function SectionHistory() {
  const { t, isRTL } = useLanguage();
  const [searchParams] = useSearchParams();
  const sectionId = searchParams.get('id');
  const [showComments, setShowComments] = useState({});

  const { data: section, isLoading: sectionLoading } = useQuery({
    queryKey: ['section', sectionId],
    queryFn: () => base44.entities.Section.filter({ id: sectionId }).then(s => s[0]),
    enabled: !!sectionId,
  });

  const { data: document } = useQuery({
    queryKey: ['document', section?.documentId],
    queryFn: () => base44.entities.Document.filter({ id: section.documentId }).then(d => d[0]),
    enabled: !!section?.documentId,
  });

  const { data: topic } = useQuery({
    queryKey: ['topic', section?.topicId],
    queryFn: () => base44.entities.Topic.filter({ id: section.topicId }).then(t => t[0]),
    enabled: !!section?.topicId,
  });

  const { data: versions, isLoading: versionsLoading } = useQuery({
    queryKey: ['versions', sectionId],
    queryFn: () => base44.entities.DocumentVersion.filter({ sectionId }, '-version'),
    initialData: [],
    enabled: !!sectionId,
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const getUserName = (email) => {
    const foundUser = users.find(u => u.email === email);
    return foundUser?.full_name || email;
  };

  const toggleComments = (suggestionId) => {
    setShowComments(prev => ({
      ...prev,
      [suggestionId]: !prev[suggestionId]
    }));
  };

  if (sectionLoading || versionsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!section) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-5xl mx-auto text-center py-20">
          <h1 className="text-2xl font-bold text-slate-900">סעיף לא נמצא</h1>
          <Link to={createPageUrl("Home")}>
            <Button className="mt-4">{t('goHome')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Group versions by suggestion to show related versions together
  const versionGroups = [];
  versions.forEach(version => {
    if (version.changeType === 'suggestion_accepted' && version.suggestionId) {
      const existingGroup = versionGroups.find(g => g.suggestionId === version.suggestionId);
      if (existingGroup) {
        existingGroup.versions.push(version);
      } else {
        versionGroups.push({
          suggestionId: version.suggestionId,
          versions: [version],
          changeDescription: version.changeDescription
        });
      }
    } else {
      versionGroups.push({
        suggestionId: null,
        versions: [version],
        changeDescription: version.changeDescription
      });
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse justify-start' : 'justify-start'}`}>
          <Link to={`${createPageUrl("DocumentView")}?id=${document?.id}&scrollTo=${sectionId}`}>
            <Button variant="outline" size="icon">
              {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <History className="w-8 h-8" />
              {t('sectionHistory')}
            </h1>
            {document && topic && (
              <p className="text-slate-600 mt-1">
                <Link to={`${createPageUrl("DocumentView")}?id=${document.id}`} className="hover:underline">
                  {document.title}
                </Link>
                {' > '}
                {topic.title}
              </p>
            )}
          </div>
        </div>

        {/* Current Version */}
        <Card className="bg-white border-2 border-blue-500">
          <CardHeader className="bg-blue-50">
            <CardTitle className="flex items-center justify-between">
              <span>גרסה נוכחית</span>
              <Badge className="bg-blue-600">עדכני</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div 
              className="prose prose-sm max-w-none text-slate-700"
              dangerouslySetInnerHTML={{ __html: section.content }}
            />
            <div className="text-xs text-slate-500 mt-4 pt-4 border-t">
              עדכון אחרון: {new Date(section.updated_date).toLocaleString('he-IL')}
            </div>
          </CardContent>
        </Card>

        {/* Version History */}
        {versionGroups.length > 0 ? (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">גרסאות קודמות</h2>
            {versionGroups.map((group, groupIndex) => {
              const latestVersion = group.versions[0];
              const previousVersion = group.versions[1];
              
              return (
                <Card key={groupIndex} className="bg-white border-slate-200">
                  <CardHeader className="border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          גרסה {latestVersion.version}
                        </CardTitle>
                        <p className="text-sm text-slate-600 mt-1">
                          {latestVersion.changeDescription || 'ללא תיאור'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {latestVersion.changeType === 'suggestion_accepted' ? 'הצעה התקבלה' :
                           latestVersion.changeType === 'section_created' ? 'סעיף נוצר' :
                           'עריכה ישירה'}
                        </Badge>
                        {group.suggestionId && (
                          <Link to={`${createPageUrl("SuggestionDetail")}?id=${group.suggestionId}`}>
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                              <MessageSquare className="w-4 h-4 mr-1" />
                              צפה בדיון המלא
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    {/* Show diff between this version and the previous one */}
                    {previousVersion && latestVersion.changeType === 'suggestion_accepted' && (
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">שינויים בגרסה זו:</h3>
                        <SectionDiff
                          originalContent={previousVersion.content}
                          newContent={latestVersion.content}
                        />
                      </div>
                    )}

                    {/* Show suggestion details if available */}
                    {group.suggestionId && (
                      <SuggestionDetails 
                        suggestionId={group.suggestionId}
                        user={user}
                        getUserName={getUserName}
                        showComments={showComments}
                        toggleComments={toggleComments}
                      />
                    )}

                    <div className="text-xs text-slate-500 pt-4 border-t">
                      נוצר ב-{new Date(latestVersion.created_date).toLocaleString('he-IL')}
                      {latestVersion.created_by && ` על ידי ${getUserName(latestVersion.created_by)}`}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-white border-slate-200">
            <CardContent className="p-12 text-center">
              <History className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">אין גרסאות קודמות</p>
              <p className="text-sm text-slate-400 mt-2">שינויים בסעיף זה יישמרו כאן אוטומטית</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Component to display suggestion details
function SuggestionDetails({ suggestionId, user, getUserName, showComments, toggleComments }) {
  const { data: suggestion } = useQuery({
    queryKey: ['suggestion', suggestionId],
    queryFn: () => base44.entities.Suggestion.filter({ id: suggestionId }).then(s => s[0]),
    enabled: !!suggestionId,
  });

  const { data: comments } = useQuery({
    queryKey: ['suggestionComments', suggestionId],
    queryFn: () => base44.entities.Comment.filter({ 
      rootEntityType: 'suggestion',
      rootEntityId: suggestionId 
    }),
    initialData: [],
    enabled: !!suggestionId,
  });

  if (!suggestion) {
    return null;
  }

  return (
    <div className="space-y-4 bg-blue-50/50 p-4 rounded-lg border border-blue-200">
      {suggestion.explanation && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">הסבר להצעה:</h3>
          <p className="text-sm text-slate-600">{suggestion.explanation}</p>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="text-green-600 font-semibold">{suggestion.proVotes || 0}</span>
            <span className="text-slate-500">בעד</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-red-600 font-semibold">{suggestion.conVotes || 0}</span>
            <span className="text-slate-500">נגד</span>
          </div>
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
            {suggestion.status === 'accepted' ? 'התקבלה' : suggestion.status}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleComments(suggestionId)}
          className="text-slate-600 hover:text-blue-600"
        >
          <MessageSquare className="w-4 h-4 mr-1" />
          תגובות ({comments.length})
        </Button>
      </div>

      {showComments[suggestionId] && (
        <div className="mt-4 pt-4 border-t border-blue-300">
          <CommentsSection
            entityType="suggestion"
            entityId={suggestionId}
            user={user}
          />
        </div>
      )}

      <div className="space-y-1">
        <div className="text-xs text-slate-500">
          פורסמה על ידי {getUserName(suggestion.created_by)} ב-{new Date(suggestion.created_date).toLocaleString('he-IL')}
        </div>
        {suggestion.status === 'accepted' && suggestion.updated_date && (
          <div className="text-xs text-green-600 font-medium">
            התקבלה ב-{new Date(suggestion.updated_date).toLocaleString('he-IL')}
          </div>
        )}
      </div>
    </div>
  );
}