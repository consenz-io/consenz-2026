import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ArrowLeft, MessageSquare, FileText, Edit } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";

export default function DocumentComments() {
  const { t, isRTL, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('id');

  const { data: document, isLoading: docLoading } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => base44.entities.Document.filter({ id: documentId }).then(docs => docs[0]),
    enabled: !!documentId,
  });

  const { data: sections } = useQuery({
    queryKey: ['sections', documentId],
    queryFn: () => base44.entities.Section.filter({ documentId }),
    initialData: [],
    enabled: !!documentId,
  });

  const { data: topics } = useQuery({
    queryKey: ['topics', documentId],
    queryFn: () => base44.entities.Topic.filter({ documentId }),
    initialData: [],
    enabled: !!documentId,
  });

  const { data: suggestions } = useQuery({
    queryKey: ['suggestions', documentId],
    queryFn: () => base44.entities.Suggestion.filter({ documentId }),
    initialData: [],
    enabled: !!documentId,
  });

  const { data: sectionComments } = useQuery({
    queryKey: ['allSectionComments', documentId],
    queryFn: async () => {
      const sectionIds = sections.map(s => s.id);
      if (sectionIds.length === 0) return [];
      const allComments = await base44.entities.Comment.filter({ rootEntityType: 'section' });
      return allComments.filter(c => sectionIds.includes(c.rootEntityId));
    },
    initialData: [],
    enabled: sections.length > 0,
  });

  const { data: suggestionComments } = useQuery({
    queryKey: ['allSuggestionComments', documentId],
    queryFn: async () => {
      const suggestionIds = suggestions.map(s => s.id);
      if (suggestionIds.length === 0) return [];
      const allComments = await base44.entities.Comment.filter({ rootEntityType: 'suggestion' });
      return allComments.filter(c => suggestionIds.includes(c.rootEntityId));
    },
    initialData: [],
    enabled: suggestions.length > 0,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const getUserName = (email) => {
    const user = users.find(u => u.email === email);
    return user?.full_name || email;
  };

  const getTopicName = (topicId) => {
    const topic = topics.find(t => t.id === topicId);
    return topic?.title || '';
  };

  const getSectionPreview = (sectionId) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return '';
    const text = section.content?.replace(/<[^>]*>/g, '') || '';
    return text.length > 80 ? text.substring(0, 80) + '...' : text;
  };

  const getSuggestionTitle = (suggestionId) => {
    const suggestion = suggestions.find(s => s.id === suggestionId);
    return suggestion?.title || '';
  };

  // Group comments by section/suggestion
  const groupedComments = React.useMemo(() => {
    const groups = [];

    // Group section comments
    const sectionGroups = {};
    sectionComments.forEach(comment => {
      if (!sectionGroups[comment.rootEntityId]) {
        const section = sections.find(s => s.id === comment.rootEntityId);
        sectionGroups[comment.rootEntityId] = {
          type: 'section',
          entityId: comment.rootEntityId,
          section,
          topicName: section ? getTopicName(section.topicId) : '',
          comments: []
        };
      }
      sectionGroups[comment.rootEntityId].comments.push(comment);
    });
    Object.values(sectionGroups).forEach(g => groups.push(g));

    // Group suggestion comments
    const suggestionGroups = {};
    suggestionComments.forEach(comment => {
      if (!suggestionGroups[comment.rootEntityId]) {
        const suggestion = suggestions.find(s => s.id === comment.rootEntityId);
        suggestionGroups[comment.rootEntityId] = {
          type: 'suggestion',
          entityId: comment.rootEntityId,
          suggestion,
          comments: []
        };
      }
      suggestionGroups[comment.rootEntityId].comments.push(comment);
    });
    Object.values(suggestionGroups).forEach(g => groups.push(g));

    // Sort groups by most recent comment
    groups.sort((a, b) => {
      const aLatest = Math.max(...a.comments.map(c => new Date(c.created_date).getTime()));
      const bLatest = Math.max(...b.comments.map(c => new Date(c.created_date).getTime()));
      return bLatest - aLatest;
    });

    // Sort comments within each group
    groups.forEach(g => {
      g.comments.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    });

    return groups;
  }, [sectionComments, suggestionComments, sections, suggestions, topics]);

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  if (docLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <p className="text-slate-500">{t('documentNotFound')}</p>
          <Link to={createPageUrl("Home")}>
            <Button className="mt-4">{t('goHome')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to={`${createPageUrl("DocumentView")}?id=${documentId}`} className={isRTL ? 'order-first' : ''}>
            <Button variant="ghost" size="icon">
              <BackArrow className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">{t('allSectionComments')}</h1>
            <p className="text-sm text-slate-600">{document.title}</p>
          </div>
        </div>

        {/* Comments List */}
        {groupedComments.length === 0 ? (
          <Card className="bg-white border-slate-200">
            <CardContent className="p-8 text-center">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{t('noCommentsYet')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {groupedComments.map((group, idx) => (
              <Card key={idx} className="bg-white border-slate-200">
                <CardContent className="p-4">
                  {/* Group Header */}
                  <div className={`flex items-start justify-between gap-3 mb-3 pb-3 border-b border-slate-100 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="flex-1 min-w-0">
                      {group.type === 'section' ? (
                        <>
                          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            <Badge variant="outline" className="text-xs">{group.topicName}</Badge>
                          </div>
                          <p className={`text-sm text-slate-700 mt-1 line-clamp-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                            {getSectionPreview(group.entityId)}
                          </p>
                        </>
                      ) : (
                        <Link to={`${createPageUrl("SuggestionDetail")}?id=${group.entityId}`} className={`block w-full ${isRTL ? 'text-right' : 'text-left'}`}>
                          <span className="text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors">{t('suggestion')}: {getSuggestionTitle(group.entityId)}</span>
                        </Link>
                      )}
                    </div>
                    {group.type === 'section' && (
                      <Link to={`${createPageUrl("DocumentView")}?id=${documentId}&scrollTo=${group.entityId}`}>
                        <Button size="sm" variant="outline" className="text-xs">
                          {t('viewDetails')}
                        </Button>
                      </Link>
                    )}
                  </div>

                  {/* Comments */}
                  <div className="space-y-3">
                    {group.comments.slice(0, 3).map((comment) => (
                      <div key={comment.id} className={`${isRTL ? 'text-right' : 'text-left'}`}>
                        <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                          <div className={`flex items-center gap-2 ${isRTL ? 'justify-start' : ''}`}>
                            <span className="text-sm font-medium text-slate-900">{getUserName(comment.created_by)}</span>
                            <span className="text-xs text-slate-500">{new Date(comment.created_date).toLocaleDateString()}</span>
                          </div>
                          <p className={`text-sm text-slate-700 mt-0.5 ${isRTL ? 'text-right' : 'text-left'}`}>{comment.content}</p>
                        </div>
                      </div>
                    ))}
                    {group.comments.length > 3 && (
                      <p className="text-xs text-slate-500 text-center">
                        +{group.comments.length - 3} {t('comments')}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}