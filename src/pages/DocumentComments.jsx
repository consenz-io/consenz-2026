import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, ArrowLeft, MessageSquare, FileText,
  ExternalLink, ChevronDown, ChevronUp,
  ThumbsUp, BookOpen, SortAsc, Filter
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";
import { formatLocalDateTime } from "@/components/utils/dateFormatter";

const SORT_OPTIONS = {
  recent: 'recent',
  oldest: 'oldest',
  most_comments: 'most_comments',
  topic: 'topic',
};

// ─── Pure helpers ────────────────────────────────────────────────────────────

const stripHtml = (html) => (html || '').replace(/<[^>]*>/g, '');

function AvatarInitial({ name, size = 'sm' }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  const COLORS = ['from-blue-500 to-indigo-500', 'from-green-500 to-teal-500', 'from-purple-500 to-pink-500', 'from-orange-500 to-red-500', 'from-cyan-500 to-blue-500'];
  const colorIdx = (name?.charCodeAt(0) || 0) % COLORS.length;
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${COLORS[colorIdx]} flex items-center justify-center flex-shrink-0`}>
      <span className="text-white font-semibold">{initial}</span>
    </div>
  );
}

// Memoized — only re-renders when comment data or language changes
const CommentRow = React.memo(function CommentRow({ comment, name, userId, isRTL }) {
  const likeCount = (comment.likes || []).length;
  return (
    <div
      id={`comment-${comment.id}`}
      className={`flex gap-2.5 ${comment._level > 0 ? 'mt-2 pl-4 md:pl-8 border-l-2 border-slate-100' : ''}`}
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
          {stripHtml(comment.content)}
        </p>
      </div>
    </div>
  );
});

function SectionContextBlock({ section, topicTitle, sectionNumber, isRTL, language, onNavigate }) {
  const [expanded, setExpanded] = React.useState(false);
  // Compute plain text once, not on every render
  const text = React.useMemo(() => stripHtml(section?.content), [section?.content]);
  if (!section || !text) return null;

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
    </div>
  );
}

// Memoized card — only re-renders if group data or display-related props change
const GroupCard = React.memo(function GroupCard({ group, profileMap, language, isRTL, documentId, sectionMeta }) {
  const [collapsed, setCollapsed] = React.useState(false);

  const topLevelComments = React.useMemo(() => group.comments.filter(c => !c.parentCommentId), [group.comments]);
  const replyComments = React.useMemo(() => group.comments.filter(c => !!c.parentCommentId), [group.comments]);
  const totalCount = group.comments.length;

  const { topicTitle, sectionNum } = sectionMeta || {};

  const navigateToSection = React.useCallback(() => {
    window.open(`${createPageUrl("DocumentView")}?id=${documentId}&scrollTo=${group.entityId}`, '_self');
  }, [documentId, group.entityId]);

  const previewText = React.useMemo(() =>
    collapsed && topLevelComments[0]
      ? stripHtml(topLevelComments[0].content).substring(0, 80)
      : null,
    [collapsed, topLevelComments]
  );

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
          {previewText && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{previewText}</p>
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

          <div className="space-y-3">
            {topLevelComments.map(comment => {
              const profile = profileMap[comment.created_by] || {};
              const replies = replyComments.filter(r => r.parentCommentId === comment.id);
              return (
                <div key={comment.id}>
                  <CommentRow
                    comment={comment}
                    name={profile.name || (comment.created_by || '?').split('@')[0]}
                    userId={profile.userId || ''}
                    isRTL={isRTL}
                  />
                  {replies.map(reply => {
                    const rProfile = profileMap[reply.created_by] || {};
                    return (
                      <CommentRow
                        key={reply.id}
                        comment={{ ...reply, _level: 1 }}
                        name={rProfile.name || (reply.created_by || '?').split('@')[0]}
                        userId={rProfile.userId || ''}
                        isRTL={isRTL}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>

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
});

export default function DocumentComments() {
  const { t, isRTL, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('id');
  const [sortBy, setSortBy] = React.useState(SORT_OPTIONS.recent);
  const [filterType, setFilterType] = React.useState('all');

  const { data: doc, isLoading: docLoading } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => base44.entities.Document.filter({ id: documentId }).then(docs => docs[0]),
    enabled: !!documentId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['sections', documentId],
    queryFn: () => base44.entities.Section.filter({ documentId }),
    enabled: !!documentId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: topics = [] } = useQuery({
    queryKey: ['topics', documentId],
    queryFn: () => base44.entities.Topic.filter({ documentId }),
    enabled: !!documentId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: suggestions = [] } = useQuery({
    queryKey: ['suggestions', documentId],
    queryFn: () => base44.entities.Suggestion.filter({ documentId }),
    enabled: !!documentId,
    staleTime: 2 * 60 * 1000,
  });

  // Build Sets/Maps once for O(1) lookups instead of O(n) finds inside queries
  const sectionIdSet = React.useMemo(() => new Set(sections.map(s => s.id)), [sections]);
  const suggestionIdSet = React.useMemo(() => new Set(suggestions.map(s => s.id)), [suggestions]);

  const { data: sectionComments = [], isLoading: loadingSC } = useQuery({
    queryKey: ['allSectionComments', documentId],
    queryFn: async () => {
      const all = await base44.entities.Comment.filter({ rootEntityType: 'section' });
      return all.filter(c => sectionIdSet.has(c.rootEntityId));
    },
    enabled: sectionIdSet.size > 0,
    staleTime: 60 * 1000,
  });

  const { data: suggestionComments = [], isLoading: loadingSSC } = useQuery({
    queryKey: ['allSuggestionComments', documentId],
    queryFn: async () => {
      const all = await base44.entities.Comment.filter({ rootEntityType: 'suggestion' });
      return all.filter(c => suggestionIdSet.has(c.rootEntityId));
    },
    enabled: suggestionIdSet.size > 0,
    staleTime: 60 * 1000,
  });

  const { data: publicProfiles = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    staleTime: 10 * 60 * 1000,
  });

  // O(1) lookup map: email → {name, userId}
  const profileMap = React.useMemo(() => {
    const map = {};
    for (const p of publicProfiles) {
      map[p.email] = { name: p.fullName, userId: p.userId };
    }
    return map;
  }, [publicProfiles]);

  // Pre-sort topics once; reuse in sectionMetas below
  const sortedTopics = React.useMemo(
    () => [...topics].sort((a, b) => a.order - b.order),
    [topics]
  );

  // topicId → index map for O(1) topic order lookup
  const topicOrderMap = React.useMemo(() => {
    const map = {};
    sortedTopics.forEach((t, i) => { map[t.id] = i; });
    return map;
  }, [sortedTopics]);

  // sectionId → {topicTitle, sectionNum, topicOrder} — computed once
  const sectionMetas = React.useMemo(() => {
    const meta = {};
    // Group sections by topicId
    const byTopic = {};
    for (const s of sections) {
      if (!byTopic[s.topicId]) byTopic[s.topicId] = [];
      byTopic[s.topicId].push(s);
    }
    // Sort each topic's sections
    for (const topicId of Object.keys(byTopic)) {
      byTopic[topicId].sort((a, b) => a.order - b.order);
    }
    for (const s of sections) {
      const topicIdx = topicOrderMap[s.topicId] ?? -1;
      const topic = sortedTopics[topicIdx];
      const topicTitle = topic
        ? ((typeof topic.translations?.[language]?.title === 'string'
            ? topic.translations[language].title
            : topic.title) || '')
        : '';
      const secArr = byTopic[s.topicId] || [];
      const secIdx = secArr.findIndex(x => x.id === s.id);
      meta[s.id] = {
        topicTitle,
        sectionNum: topicIdx !== -1 && secIdx !== -1 ? `${topicIdx + 1}.${secIdx + 1}` : '',
        topicOrder: topicIdx,
      };
    }
    return meta;
  }, [sections, sortedTopics, topicOrderMap, language]);

  const acceptedSuggestionToSectionMap = React.useMemo(() => {
    const map = {};
    for (const s of suggestions) {
      if (s.status === 'accepted' && s.sectionId) map[s.id] = s.sectionId;
    }
    return map;
  }, [suggestions]);

  // O(1) section lookup map
  const sectionById = React.useMemo(() => {
    const map = {};
    for (const s of sections) map[s.id] = s;
    return map;
  }, [sections]);

  // O(1) suggestion lookup map
  const suggestionById = React.useMemo(() => {
    const map = {};
    for (const s of suggestions) map[s.id] = s;
    return map;
  }, [suggestions]);

  const groupedComments = React.useMemo(() => {
    const sectionGroups = {};
    const suggestionGroups = {};

    for (const comment of sectionComments) {
      const id = comment.rootEntityId;
      if (!sectionGroups[id]) {
        sectionGroups[id] = { type: 'section', entityId: id, section: sectionById[id], comments: [] };
      }
      sectionGroups[id].comments.push(comment);
    }

    // Use a Set to deduplicate comment IDs per group efficiently
    const sectionCommentSets = {};
    for (const id of Object.keys(sectionGroups)) {
      sectionCommentSets[id] = new Set(sectionGroups[id].comments.map(c => c.id));
    }

    for (const comment of suggestionComments) {
      const suggestionId = comment.rootEntityId;
      const linkedSectionId = acceptedSuggestionToSectionMap[suggestionId];

      if (linkedSectionId) {
        if (!sectionGroups[linkedSectionId]) {
          sectionGroups[linkedSectionId] = { type: 'section', entityId: linkedSectionId, section: sectionById[linkedSectionId], comments: [] };
          sectionCommentSets[linkedSectionId] = new Set();
        }
        if (!sectionCommentSets[linkedSectionId].has(comment.id)) {
          sectionCommentSets[linkedSectionId].add(comment.id);
          sectionGroups[linkedSectionId].comments.push(comment);
        }
      } else {
        if (!suggestionGroups[suggestionId]) {
          suggestionGroups[suggestionId] = { type: 'suggestion', entityId: suggestionId, suggestion: suggestionById[suggestionId], comments: [] };
        }
        suggestionGroups[suggestionId].comments.push(comment);
      }
    }

    let groups = [
      ...Object.values(sectionGroups),
      ...Object.values(suggestionGroups),
    ].filter(g => g.comments.length > 0);

    if (filterType === 'section') groups = groups.filter(g => g.type === 'section');
    if (filterType === 'suggestion') groups = groups.filter(g => g.type === 'suggestion');

    // Pre-compute sort keys to avoid redundant work inside comparator
    if (sortBy === SORT_OPTIONS.recent || sortBy === SORT_OPTIONS.oldest) {
      const fn = sortBy === SORT_OPTIONS.recent ? Math.max : Math.min;
      const withKey = groups.map(g => ({
        g,
        key: fn(...g.comments.map(c => new Date(c.created_date).getTime())),
      }));
      withKey.sort((a, b) => sortBy === SORT_OPTIONS.recent ? b.key - a.key : a.key - b.key);
      groups = withKey.map(x => x.g);
    } else if (sortBy === SORT_OPTIONS.most_comments) {
      groups.sort((a, b) => b.comments.length - a.comments.length);
    } else if (sortBy === SORT_OPTIONS.topic) {
      groups.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'section' ? -1 : 1;
        if (a.type === 'section') {
          const oA = sectionMetas[a.entityId]?.topicOrder ?? 9999;
          const oB = sectionMetas[b.entityId]?.topicOrder ?? 9999;
          if (oA !== oB) return oA - oB;
          const nA = sectionMetas[a.entityId]?.sectionNum || '';
          const nB = sectionMetas[b.entityId]?.sectionNum || '';
          return nA.localeCompare(nB, undefined, { numeric: true });
        }
        return 0;
      });
    }

    return groups;
  }, [sectionComments, suggestionComments, sectionById, suggestionById, acceptedSuggestionToSectionMap, sortBy, filterType, sectionMetas]);

  const totalComments = React.useMemo(
    () => groupedComments.reduce((acc, g) => acc + g.comments.length, 0),
    [groupedComments]
  );

  const isLoading = docLoading || loadingSC || loadingSSC;

  const sortLabel = React.useMemo(() => ({
    [SORT_OPTIONS.recent]: language === 'he' ? 'עדכני ראשון' : language === 'ar' ? 'الأحدث أولاً' : 'Most recent',
    [SORT_OPTIONS.oldest]: language === 'he' ? 'ישן ראשון' : language === 'ar' ? 'الأقدم أولاً' : 'Oldest first',
    [SORT_OPTIONS.most_comments]: language === 'he' ? 'הכי הרבה תגובות' : language === 'ar' ? 'الأكثر تعليقاً' : 'Most comments',
    [SORT_OPTIONS.topic]: language === 'he' ? 'לפי נושא' : language === 'ar' ? 'حسب الموضوع' : 'By topic',
  }), [language]);

  const filterOptions = React.useMemo(() => [
    { value: 'all', label: language === 'he' ? 'הכל' : language === 'ar' ? 'الكل' : 'All' },
    { value: 'section', label: language === 'he' ? 'סעיפים' : language === 'ar' ? 'المقاطع' : 'Sections' },
    { value: 'suggestion', label: language === 'he' ? 'הצעות' : language === 'ar' ? 'الاقتراحات' : 'Suggestions' },
  ], [language]);

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
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
              <SortAsc className="w-3.5 h-3.5 text-slate-400 mx-1 flex-shrink-0" />
              {Object.entries(sortLabel).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={`text-xs px-2 py-1 rounded-md transition-colors font-medium ${
                    sortBy === key ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
              <Filter className="w-3.5 h-3.5 text-slate-400 mx-1 flex-shrink-0" />
              {filterOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilterType(opt.value)}
                  className={`text-xs px-2 py-1 rounded-md transition-colors font-medium ${
                    filterType === opt.value ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
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
            {groupedComments.map(group => (
              <GroupCard
                key={`${group.type}-${group.entityId}`}
                group={group}
                profileMap={profileMap}
                language={language}
                isRTL={isRTL}
                documentId={documentId}
                sectionMeta={group.type === 'section' ? sectionMetas[group.entityId] : null}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}