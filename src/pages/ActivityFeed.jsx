import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { 
  MessageSquare, ThumbsUp, FileEdit, FileText, 
  Clock, Users, Filter, Check
} from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import PageHeader from "@/components/PageHeader";
import { formatDistanceToNow } from "date-fns";
import { he, ar, enUS } from "date-fns/locale";

export default function ActivityFeed() {
  const { t, isRTL, language } = useLanguage();
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState('all'); // all, suggestions, comments, votes, edits

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  // Get user's groups
  const { data: userGroupMemberships = [] } = useQuery({
    queryKey: ['userGroupMemberships', currentUser?.id],
    queryFn: () => base44.entities.GroupMember.filter({ userId: currentUser.id }),
    enabled: !!currentUser?.id,
    initialData: [],
  });

  const userGroupIds = userGroupMemberships.map(m => m.groupId);

  // Get documents from user's groups
  const { data: allDocuments = [] } = useQuery({
    queryKey: ['allDocuments'],
    queryFn: () => base44.entities.Document.list(),
    initialData: [],
  });

  const relevantDocs = allDocuments.filter(doc => 
    doc.groupId && userGroupIds.includes(doc.groupId)
  );
  const relevantDocIds = relevantDocs.map(d => d.id);

  // Fetch activity data
  const { data: suggestions = [], isLoading: suggestionsLoading } = useQuery({
    queryKey: ['activitySuggestions'],
    queryFn: () => base44.entities.Suggestion.list('-created_date', 100),
    initialData: [],
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ['activityComments'],
    queryFn: () => base44.entities.Comment.list('-created_date', 100),
    initialData: [],
  });

  const { data: votes = [], isLoading: votesLoading } = useQuery({
    queryKey: ['activityVotes'],
    queryFn: () => base44.entities.Vote.list('-created_date', 100),
    initialData: [],
  });

  const { data: versions = [], isLoading: versionsLoading } = useQuery({
    queryKey: ['activityVersions'],
    queryFn: () => base44.entities.DocumentVersion.list('-created_date', 100),
    initialData: [],
  });

  const { data: publicProfiles = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    initialData: [],
  });

  // Mark as visited mutation
  const markAsVisitedMutation = useMutation({
    mutationFn: async () => {
      await base44.auth.updateMe({
        lastActivityFeedVisit: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });

  // Mark as visited when component mounts
  useEffect(() => {
    if (currentUser) {
      markAsVisitedMutation.mutate();
    }
  }, [currentUser?.id]);

  const getUserName = (email, userId) => {
    const profile = publicProfiles.find(p => p.email === email || p.userId === userId);
    return profile?.fullName || email || 'Unknown';
  };

  const getDocumentTitle = (docId) => {
    const doc = allDocuments.find(d => d.id === docId);
    return doc?.title || '';
  };

  // Build unified activity feed
  const activityItems = React.useMemo(() => {
    const items = [];

    // Add suggestions
    if (filterType === 'all' || filterType === 'suggestions') {
      suggestions
        .filter(s => relevantDocIds.includes(s.documentId))
        .forEach(suggestion => {
          items.push({
            id: `suggestion-${suggestion.id}`,
            type: 'suggestion',
            timestamp: suggestion.created_date,
            data: suggestion,
            userName: getUserName(suggestion.created_by),
            documentTitle: getDocumentTitle(suggestion.documentId),
            link: `${createPageUrl("SuggestionDetail")}?id=${suggestion.id}`,
          });
        });
    }

    // Add comments
    if (filterType === 'all' || filterType === 'comments') {
      comments.forEach(comment => {
        // Find related suggestion or section to check if it's in relevant docs
        if (comment.rootEntityType === 'suggestion') {
          const relatedSuggestion = suggestions.find(s => s.id === comment.rootEntityId);
          if (relatedSuggestion && relevantDocIds.includes(relatedSuggestion.documentId)) {
            items.push({
              id: `comment-${comment.id}`,
              type: 'comment',
              timestamp: comment.created_date,
              data: comment,
              userName: getUserName(comment.created_by),
              documentTitle: getDocumentTitle(relatedSuggestion.documentId),
              link: `${createPageUrl("SuggestionDetail")}?id=${comment.rootEntityId}&commentId=${comment.id}`,
            });
          }
        }
      });
    }

    // Add votes
    if (filterType === 'all' || filterType === 'votes') {
      votes.forEach(vote => {
        const relatedSuggestion = suggestions.find(s => s.id === vote.suggestionId);
        if (relatedSuggestion && relevantDocIds.includes(relatedSuggestion.documentId)) {
          items.push({
            id: `vote-${vote.id}`,
            type: 'vote',
            timestamp: vote.created_date,
            data: vote,
            userName: getUserName(vote.created_by, vote.userId),
            documentTitle: getDocumentTitle(relatedSuggestion.documentId),
            suggestionTitle: relatedSuggestion.title,
            link: `${createPageUrl("SuggestionDetail")}?id=${vote.suggestionId}`,
          });
        }
      });
    }

    // Add document versions (edits)
    if (filterType === 'all' || filterType === 'edits') {
      versions
        .filter(v => relevantDocIds.includes(v.documentId))
        .forEach(version => {
          items.push({
            id: `version-${version.id}`,
            type: 'edit',
            timestamp: version.created_date,
            data: version,
            userName: getUserName(version.created_by),
            documentTitle: getDocumentTitle(version.documentId),
            link: `${createPageUrl("DocumentView")}?id=${version.documentId}`,
          });
        });
    }

    // Sort by timestamp descending
    return items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [suggestions, comments, votes, versions, relevantDocIds, filterType, publicProfiles]);

  const isLoading = suggestionsLoading || commentsLoading || votesLoading || versionsLoading;

  const getActivityIcon = (type) => {
    switch (type) {
      case 'suggestion': return <FileText className="w-4 h-4" />;
      case 'comment': return <MessageSquare className="w-4 h-4" />;
      case 'vote': return <ThumbsUp className="w-4 h-4" />;
      case 'edit': return <FileEdit className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case 'suggestion': return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'comment': return 'bg-green-50 text-green-600 border-green-200';
      case 'vote': return 'bg-purple-50 text-purple-600 border-purple-200';
      case 'edit': return 'bg-amber-50 text-amber-600 border-amber-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const getActivityLabel = (type) => {
    switch (type) {
      case 'suggestion': return language === 'he' ? 'הצעה חדשה' : language === 'ar' ? 'اقتراح جديد' : 'New Suggestion';
      case 'comment': return language === 'he' ? 'תגובה חדשה' : language === 'ar' ? 'تعليق جديد' : 'New Comment';
      case 'vote': return language === 'he' ? 'הצבעה' : language === 'ar' ? 'تصويت' : 'Vote';
      case 'edit': return language === 'he' ? 'שינוי במסמך' : language === 'ar' ? 'تعديل في الوثيقة' : 'Document Edit';
      default: return type;
    }
  };

  const formatTimestamp = (timestamp) => {
    const locale = language === 'he' ? he : language === 'ar' ? ar : enUS;
    return formatDistanceToNow(new Date(timestamp), { 
      addSuffix: true,
      locale 
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <PageHeader 
          title={language === 'he' ? 'פיד פעילות' : language === 'ar' ? 'آخر النشاطات' : 'Activity Feed'}
        />

        {/* Filter buttons */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              {language === 'he' ? 'סינון לפי סוג' : language === 'ar' ? 'تصفية حسب النوع' : 'Filter by Type'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'all', label: language === 'he' ? 'הכל' : language === 'ar' ? 'الكل' : 'All' },
                { value: 'suggestions', label: language === 'he' ? 'הצעות' : language === 'ar' ? 'اقتراحات' : 'Suggestions' },
                { value: 'comments', label: language === 'he' ? 'תגובות' : language === 'ar' ? 'تعليقات' : 'Comments' },
                { value: 'votes', label: language === 'he' ? 'הצבעות' : language === 'ar' ? 'تصويتات' : 'Votes' },
                { value: 'edits', label: language === 'he' ? 'עריכות' : language === 'ar' ? 'تعديلات' : 'Edits' },
              ].map(filter => (
                <Button
                  key={filter.value}
                  variant={filterType === filter.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType(filter.value)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Activity feed */}
        <div className="space-y-4">
          {activityItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                <p className="text-slate-500">
                  {language === 'he' ? 'אין פעילות חדשה' : language === 'ar' ? 'لا يوجد نشاط جديد' : 'No recent activity'}
                </p>
              </CardContent>
            </Card>
          ) : (
            activityItems.map(item => (
              <Link key={item.id} to={item.link}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg border ${getActivityColor(item.type)}`}>
                        {getActivityIcon(item.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={getActivityColor(item.type)}>
                            {getActivityLabel(item.type)}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {formatTimestamp(item.timestamp)}
                          </span>
                        </div>
                        
                        <p className="text-sm font-medium text-slate-900 mb-1">
                          <span className="font-semibold text-blue-600">{item.userName}</span>
                          {' '}
                          {item.type === 'suggestion' && (language === 'he' ? 'הוסיף הצעה ב' : language === 'ar' ? 'أضاف اقتراحًا في' : 'added a suggestion in')}
                          {item.type === 'comment' && (language === 'he' ? 'הגיב ב' : language === 'ar' ? 'علق في' : 'commented in')}
                          {item.type === 'vote' && (language === 'he' ? 'הצביע על' : language === 'ar' ? 'صوت على' : 'voted on')}
                          {item.type === 'edit' && (language === 'he' ? 'ערך את' : language === 'ar' ? 'عدل' : 'edited')}
                          {' '}
                          <span className="text-slate-700">{item.documentTitle}</span>
                        </p>
                        
                        {item.type === 'suggestion' && (
                          <div className="text-sm text-slate-600">
                            <p className="font-medium mb-1">{item.data.title}</p>
                            {item.data.explanation && (
                              <p className="line-clamp-2 text-slate-500">
                                {item.data.explanation}
                              </p>
                            )}
                          </div>
                        )}
                        
                        {item.type === 'comment' && (
                          <p className="text-sm text-slate-600 line-clamp-2">
                            {item.data.content}
                          </p>
                        )}
                        
                        {item.type === 'vote' && (
                          <p className="text-sm text-slate-600">
                            {item.data.vote === 'pro' 
                              ? (language === 'he' ? 'בעד' : language === 'ar' ? 'مع' : 'Pro')
                              : (language === 'he' ? 'נגד' : language === 'ar' ? 'ضد' : 'Con')
                            }
                            {' • '}
                            {item.suggestionTitle}
                          </p>
                        )}
                        
                        {item.type === 'edit' && item.data.changeDescription && (
                          <p className="text-sm text-slate-600 truncate">
                            {item.data.changeDescription}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}