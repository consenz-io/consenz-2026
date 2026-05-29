import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, ArrowLeft, MessageSquare, FileText,
  Languages, Loader2, ExternalLink, ChevronDown, ChevronUp,
  Clock, ThumbsUp, Hash, BookOpen, SortAsc, SortDesc, Filter
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";
import { formatLocalDateTime } from "@/components/utils/dateFormatter";

const detectLanguage = (text) => {
  if (/[\u0590-\u05FF]/.test(text)) return 'he';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  return 'en';
};

const SORT_OPTIONS = {
  recent: 'recent',
  oldest: 'oldest',
  most_comments: 'most_comments',
  topic: 'topic',
};

function AvatarInitial({ name, size = 'sm' }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  const colors = ['from-blue-500 to-indigo-500', 'from-green-500 to-teal-500', 'from-purple-500 to-pink-500', 'from-orange-500 to-red-500', 'from-cyan-500 to-blue-500'];
  const colorIdx = (name?.charCodeAt(0) || 0) % colors.length;
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${colors[colorIdx]} flex items-center justify-center flex-shrink-0`}>
      <span className="text-white font-semibold">{initial}</span>
    </div>
  );
}

function CommentRow({ comment, getUserName, getUserId, language, isRTL, level = 0 }) {
  const name = getUserName(comment.created_by);
  const userId = getUserId(comment.created_by);
  const likeCount = (comment.likes || []).length;
  return (
    <div
      id={`comment-${comment.id}`}
      className={`flex gap-2.5 ${level > 0 ? 'mt-2 pl-4 md:pl-8 border-l-2 border-slate-100' : ''}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <Link to={`${createPageUrl("Profile")}?userId=${userId}`} className="flex-shrink-0 mt-0.5">
        <AvatarInitial name={name} size="sm" />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <Link to={`${createPageUrl("Profile")}?userId=${userId}`} className="text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors">
            {name}
          </Link>
          <span className="text-xs text-slate-400">
            {formatLocalDateTime(comment.created_date, 'DD/MM HH:mm')}
          </span>
          {likeCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-slate-400">
              <ThumbsUp className="w-3 h-3" />
              {likeCount}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
          {(comment.content || '').replace(/<[^>]*>/g, '')}
        </p>
      </div>
    </div>
  );
}

function SectionContextBlock({ section, topicTitle, sectionNumber, isRTL, language, onNavigate }) {
  const [expanded, setExpanded] = React.useState(false);
  if (!section) return null;

  const tempDiv = typeof window !== 'undefined' ? window.document.createElement('div') : null;
  let text = '';
  if (tempDiv) {
    tempDiv.innerHTML = section.content || '';
    text = (tempDiv.textContent || tempDiv.innerText || '').trim();
  }

  const SHORT_LEN = 120;
  const isLong = text.length > SHORT_LEN;
  const displayText = expanded ? text : (isLong ? text.substring(0, SHORT_LEN) + '…' : text);

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 mb-3">
      <div className={`flex items-center gap-2 mb-1.5 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          {topicTitle && (
            <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">{topicTitle}</span>
          )}
          {sectionNumber && (
            <span className="text-xs text-blue-500 font-mono">§{sectionNumber}</span>
          )}
        </div>
        <button
          onClick={onNavigate}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium ml-auto transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          {language === 'he' ? 'עבור לסעיף' : language === 'ar' ? 'انتقل إلى المقطع' : 'Go to section'}
        </button>
      </div>
      {text && (
        <div>
          <p
            className="text-sm text-slate-700 leading-relaxed"
            style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {displayText}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              {expanded
                ? <><ChevronUp className="w-3 h-3" />{language === 'he' ? 'פחות' : language === 'ar' ? 'أقل' : 'Less'}</>
                : <><ChevronDown className="w-3 h-3" />{language === 'he' ? 'עוד' : language === 'ar' ? 'المزيد' : 'More'}</>
              }
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function GroupCard({ group, getUserName, getUserId, language, isRTL, documentId, getSectionNumber, getTopicName }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const topLevelComments = group.comments.filter(c => !c.parentCommentId);
  const replyComments = group.comments.filter(c => !!c.parentCommentId);
  const totalCount = group.comments.length;

  const navigateToSection = () => {
    if (group.type === 'section') {
      window.open(`${createPageUrl("DocumentView")}?id=${documentId}&scrollTo=${group.entityId}`, '_self');
    }
  };

  const topicTitle = group.type === 'section' && group.section
    ? getTopicName(group.section.topicId)
    : group.type === 'suggestion'
    ? null
    : null;

  const sectionNum = group.type === 'section' ? getSectionNumber(group.entityId) : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Card Header */}
      <div
        className={`flex items-start gap-3 px-4 py-3 cursor-pointer select-none ${isRTL ? 'flex-row-reverse text-right' : ''} ${collapsed ? '' : 'border-b border-slate-100'}`}
        onClick={() => setCollapsed(v => !v)}
        role="button"
        aria-expanded={!collapsed}
      >
        <div className={`mt-0.5 flex-shrink-0 rounded-lg p-1.5 ${group.type === 'section' ? 'bg-blue-50' : 'bg-amber-50'}`}>
          {group.type === 'section'
            ? <FileText className="w-4 h-4 text-blue-600" />
            : <MessageSquare className="w-4 h-4 text-amber-600" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className={`flex items-center gap-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
            {group.type === 'section' ? (
              <>
                {topicTitle && (
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{topicTitle}</span>
                )}
                {sectionNum && <span className="text-xs text-slate-400 font-mono">§{sectionNum}</span>}
                {totalCount > 0 && (
                  <Badge className="bg-green-100 text-green-700 border-0 text-xs px-1.5 py-0 h-5 font-medium">
                    <MessageSquare className="w-3 h-3 mr-1" />
                    {totalCount}
                  </Badge>
                )}
              </>
            ) : (
              <>
                <span className="text-xs font-medium text-amber-700 uppercase tracking-wide">
                  {language === 'he' ? 'הצעה' : language === 'ar' ? 'اقتراح' : 'Suggestion'}
                </span>
                <span className="text-sm font-medium text-slate-800 truncate">{group.suggestion?.title}</span>
                {totalCount > 0 && (
                  <Badge className="bg-amber-100 text-amber-700 border-0 text-xs px-1.5 py-0 h-5">
                    <MessageSquare className="w-3 h-3 mr-1" />
                    {totalCount}
                  </Badge>
                )}
              </>
            )}
          </div>
          {/* Latest comment preview when collapsed */}
          {collapsed && topLevelComments[0] && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {(topLevelComments[0].content || '').replace(/<[^>]*>/g, '').substring(0, 80)}
            </p>
          )}
        </div>
        <div className="flex-shrink-0">
          {collapsed
            ? <ChevronDown className="w-4 h-4 text-slate-400" />
            : <ChevronUp className="w-4 h-4 text-slate-400" />
          }
        </div>
      </div>

      {/* Card Body */}
      {!collapsed && (
        <div className="px-4 py-3">
          {/* Section context block */}
          {group.type === 'section' && group.section && (
            <SectionContextBlock
              section={group.section}
              topicTitle={topicTitle}
              sectionNumber={sectionNum}
              isRTL={isRTL}
              language={language}
              onNavigate={navigateToSection}
            />
          )}

          {/* Suggestion link */}
          {group.type === 'suggestion' && group.suggestion && (
            <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3 mb-3">
              <Link
                to={`${createPageUrl("SuggestionDetail")}?id=${group.entityId}`}
                className="flex items-center gap-2 text-sm text-amber-700 font-medium hover:text-amber-900 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                {group.suggestion.title}
              </Link>
            </div>
          )}

          {/* Comment thread */}
          <div className="space-y-3">
            {topLevelComments.map(comment => {
              const replies = replyComments.filter(r => r.parentCommentId === comment.id);
              return (
                <div key={comment.id}>
                  <CommentRow
                    comment={comment}
                    getUserName={getUserName}
                    getUserId={getUserId}
                    language={language}
                    isRTL={isRTL}
                    level={0}
                  />
                  {replies.map(reply => (
                    <CommentRow
                      key={reply.id}
                      comment={reply}
                      getUserName={getUserName}
                      getUserId={getUserId}
                      language={language}
                      isRTL={isRTL}
                      level={1}
                    />
                  ))}
                </div>
              );
            })}
          </div>

          {/* Footer nav link */}
          {group.type === 'section' && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
              <Link
                to={`${createPageUrl("DocumentView")}?id=${documentId}&scrollTo=${group.entityId}`}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {language === 'he' ? 'פתח במסמך' : language === 'ar' ? 'فتح في المستند' : 'Open in document'}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DocumentComments() {
  const { t, isRTL, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('id');
  const [sortBy, setSortBy] = React.useState(SORT_OPTIONS.recent);
  const [filterType, setFilterType] = React.useState('all'); // all | section | suggestion

  const { data: doc, isLoading: docLoading } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => base44.entities.Document.filter({ id: documentId }).then(docs => docs[0]),
    enabled: !!documentId,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['sections', documentId],
    queryFn: () => base44.entities.Section.filter({ documentId }),
    enabled: !!documentId,
  });

  const { data: topics = [] } = useQuery({
    queryKey: ['topics', documentId],
    queryFn: () => base44.entities.Topic.filter({ documentId }),
    enabled: !!documentId,
  });

  const { data: suggestions = [] } = useQuery({
    queryKey: ['suggestions', documentId],
    queryFn: () => base44.entities.Suggestion.filter({ documentId }),
    enabled: !!documentId,
  });

  const { data: sectionComments = [], isLoading: loadingSC } = useQuery({
    queryKey: ['allSectionComments', documentId],
    queryFn: async () => {
      const sectionIds = sections.map(s => s.id);
      if (sectionIds.length === 0) return [];
      const all = await base44.entities.Comment.filter({ rootEntityType: 'section' });
      return all.filter(c => sectionIds.includes(c.rootEntityId));
    },
    enabled: sections.length > 0,
  });

  const { data: suggestionComments = [], isLoading: loadingSSC } = useQuery({
    queryKey: ['allSuggestionComments', documentId],
    queryFn: async () => {
      const suggestionIds = suggestions.map(s => s.id);
      if (suggestionIds.length === 0) return [];
      const all = await base44.entities.Comment.filter({ rootEntityType: 'suggestion' });
      return all.filter(c => suggestionIds.includes(c.rootEntityId));
    },
    enabled: suggestions.length > 0,
  });

  const { data: publicProfiles = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    initialData: [],
  });

  const getUserName = React.useCallback((email) => {
    if (!email) return '?';
    const profile = publicProfiles.find(p => p.email === email);
    if (profile?.fullName) return profile.fullName;
    return email.split('@')[0];
  }, [publicProfiles]);

  const getUserId = React.useCallback((email) => {
    const profile = publicProfiles.find(p => p.email === email);
    return profile?.userId || '';
  }, [publicProfiles]);

  const getTopicName = React.useCallback((topicId) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return '';
    const translated = topic.translations?.[language]?.title;
    return (typeof translated === 'string' ? translated : topic.title) || '';
  }, [topics, language]);

  const getSectionNumber = React.useCallback((sectionId) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return '';
    const sortedTopics = [...topics].sort((a, b) => a.order - b.order);
    const topicIdx = sortedTopics.findIndex(t => t.id === section.topicId);
    if (topicIdx === -1) return '';
    const topicSections = sections.filter(s => s.topicId === section.topicId).sort((a, b) => a.order - b.order);
    const secIdx = topicSections.findIndex(s => s.id === sectionId);
    if (secIdx === -1) return '';
    return `${topicIdx + 1}.${secIdx + 1}`;
  }, [sections, topics]);

  const getSectionTopicOrder = React.useCallback((sectionId) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return 9999;
    const sortedTopics = [...topics].sort((a, b) => a.order - b.order);
    return sortedTopics.findIndex(t => t.id === section.topicId);
  }, [sections, topics]);

  const acceptedSuggestionToSectionMap = React.useMemo(() => {
    const map = {};
    suggestions.forEach(s => {
      if (s.status === 'accepted' && s.sectionId) map[s.id] = s.sectionId;
    });
    return map;
  }, [suggestions]);

  const groupedComments = React.useMemo(() => {
    const sectionGroups = {};
    const suggestionGroups = {};

    sectionComments.forEach(comment => {
      const id = comment.rootEntityId;
      if (!sectionGroups[id]) {
        const section = sections.find(s => s.id === id);
        sectionGroups[id] = { type: 'section', entityId: id, section, comments: [] };
      }
      sectionGroups[id].comments.push(comment);
    });

    suggestionComments.forEach(comment => {
      const suggestionId = comment.rootEntityId;
      const linkedSectionId = acceptedSuggestionToSectionMap[suggestionId];

      if (linkedSectionId) {
        if (!sectionGroups[linkedSectionId]) {
          const section = sections.find(s => s.id === linkedSectionId);
          sectionGroups[linkedSectionId] = { type: 'section', entityId: linkedSectionId, section, comments: [] };
        }
        if (!sectionGroups[linkedSectionId].comments.some(c => c.id === comment.id)) {
          sectionGroups[linkedSectionId].comments.push(comment);
        }
      } else {
        if (!suggestionGroups[suggestionId]) {
          const suggestion = suggestions.find(s => s.id === suggestionId);
          suggestionGroups[suggestionId] = { type: 'suggestion', entityId: suggestionId, suggestion, comments: [] };
        }
        if (!suggestionGroups[suggestionId].comments.some(c => c.id === comment.id)) {
          suggestionGroups[suggestionId].comments.push(comment);
        }
      }
    });

    let groups = [
      ...Object.values(sectionGroups),
      ...Object.values(suggestionGroups),
    ].filter(g => g.comments.length > 0);

    // Apply filter
    if (filterType === 'section') groups = groups.filter(g => g.type === 'section');
    if (filterType === 'suggestion') groups = groups.filter(g => g.type === 'suggestion');

    // Apply sort
    if (sortBy === SORT_OPTIONS.recent) {
      groups.sort((a, b) => {
        const aDate = Math.max(...a.comments.map(c => new Date(c.created_date).getTime()));
        const bDate = Math.max(...b.comments.map(c => new Date(c.created_date).getTime()));
        return bDate - aDate;
      });
    } else if (sortBy === SORT_OPTIONS.oldest) {
      groups.sort((a, b) => {
        const aDate = Math.min(...a.comments.map(c => new Date(c.created_date).getTime()));
        const bDate = Math.min(...b.comments.map(c => new Date(c.created_date).getTime()));
        return aDate - bDate;
      });
    } else if (sortBy === SORT_OPTIONS.most_comments) {
      groups.sort((a, b) => b.comments.length - a.comments.length);
    } else if (sortBy === SORT_OPTIONS.topic) {
      groups.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'section' ? -1 : 1;
        if (a.type === 'section') {
          const topicA = getSectionTopicOrder(a.entityId);
          const topicB = getSectionTopicOrder(b.entityId);
          if (topicA !== topicB) return topicA - topicB;
          const numA = getSectionNumber(a.entityId) || '';
          const numB = getSectionNumber(b.entityId) || '';
          return numA.localeCompare(numB, undefined, { numeric: true });
        }
        return 0;
      });
    }

    return groups;
  }, [sectionComments, suggestionComments, sections, suggestions, topics, acceptedSuggestionToSectionMap, sortBy, filterType, getSectionTopicOrder, getSectionNumber]);

  const totalComments = groupedComments.reduce((acc, g) => acc + g.comments.length, 0);
  const isLoading = docLoading || loadingSC || loadingSSC;

  const sortLabel = {
    [SORT_OPTIONS.recent]: language === 'he' ? 'עדכני ראשון' : language === 'ar' ? 'الأحدث أولاً' : 'Most recent',
    [SORT_OPTIONS.oldest]: language === 'he' ? 'ישן ראשון' : language === 'ar' ? 'الأقدم أولاً' : 'Oldest first',
    [SORT_OPTIONS.most_comments]: language === 'he' ? 'הכי הרבה תגובות' : language === 'ar' ? 'الأكثر تعليقاً' : 'Most comments',
    [SORT_OPTIONS.topic]: language === 'he' ? 'לפי נושא' : language === 'ar' ? 'حسب الموضوع' : 'By topic',
  };

  if (docLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-6">
        <div className="max-w-3xl mx-auto text-center py-12">
          <p className="text-slate-500">{t('documentNotFound')}</p>
          <Link to={createPageUrl("Home")}><Button className="mt-4">{t('goHome')}</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to={`${createPageUrl("DocumentView")}?id=${documentId}`}>
              <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0 shrink-0">
                {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-base md:text-lg font-bold text-slate-900 leading-tight">
                {language === 'he' ? 'כל התגובות' : language === 'ar' ? 'جميع التعليقات' : 'All Comments'}
              </h1>
              <p className="text-xs text-slate-500 truncate">{doc.title}</p>
            </div>
            {totalComments > 0 && (
              <Badge className="bg-green-100 text-green-700 border-0 font-medium flex-shrink-0">
                {totalComments}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 md:py-6 space-y-4">
        {/* Toolbar */}
        {groupedComments.length > 0 && (
          <div className={`flex items-center gap-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
            {/* Sort */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
              <SortAsc className="w-3.5 h-3.5 text-slate-400 mx-1 flex-shrink-0" />
              {Object.entries(sortLabel).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={`text-xs px-2 py-1 rounded-md transition-colors font-medium ${
                    sortBy === key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Filter */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
              <Filter className="w-3.5 h-3.5 text-slate-400 mx-1 flex-shrink-0" />
              {[
                { value: 'all', label: language === 'he' ? 'הכל' : language === 'ar' ? 'الكل' : 'All' },
                { value: 'section', label: language === 'he' ? 'סעיפים' : language === 'ar' ? 'المقاطع' : 'Sections' },
                { value: 'suggestion', label: language === 'he' ? 'הצעות' : language === 'ar' ? 'الاقتراحات' : 'Suggestions' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilterType(opt.value)}
                  className={`text-xs px-2 py-1 rounded-md transition-colors font-medium ${
                    filterType === opt.value
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <span className="text-xs text-slate-400 ml-auto">
              {groupedComments.length} {language === 'he' ? 'סעיפים/הצעות' : language === 'ar' ? 'مقطع/اقتراح' : 'threads'}
            </span>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && groupedComments.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium text-lg mb-1">
              {language === 'he' ? 'אין תגובות עדיין' : language === 'ar' ? 'لا توجد تعليقات بعد' : 'No comments yet'}
            </p>
            <p className="text-slate-400 text-sm">
              {language === 'he' ? 'היה הראשון להגיב על סעיפי המסמך' : language === 'ar' ? 'كن أول من يعلق على مقاطع الوثيقة' : 'Be the first to comment on document sections'}
            </p>
            <Link to={`${createPageUrl("DocumentView")}?id=${documentId}`} className="inline-block mt-4">
              <Button variant="outline" size="sm">
                {language === 'he' ? 'חזור למסמך' : language === 'ar' ? 'العودة إلى المستند' : 'Back to document'}
              </Button>
            </Link>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
          </div>
        )}

        {/* Comment Groups */}
        {!isLoading && groupedComments.length > 0 && (
          <div className="space-y-3">
            {groupedComments.map((group, idx) => (
              <GroupCard
                key={`${group.type}-${group.entityId}`}
                group={group}
                getUserName={getUserName}
                getUserId={getUserId}
                language={language}
                isRTL={isRTL}
                documentId={documentId}
                getSectionNumber={getSectionNumber}
                getTopicName={getTopicName}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}