import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, ArrowLeft, MessageSquare, FileText,
  ChevronRight, ChevronLeft, ExternalLink, Hash,
  BookOpen, Users, Loader2, Languages
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";

const detectLanguage = (text) => {
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  if (hebrewPattern.test(text)) return 'he';
  if (arabicPattern.test(text)) return 'ar';
  return 'en';
};

const languagePrompts = { en: "English", he: "Hebrew", ar: "Arabic" };

// ── Avatar ──────────────────────────────────────────────────────────
function Avatar({ name, size = 'sm' }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  const colors = ['from-blue-500 to-indigo-500', 'from-green-500 to-teal-500', 'from-purple-500 to-pink-500', 'from-orange-400 to-red-500'];
  const colorIdx = name ? name.charCodeAt(0) % colors.length : 0;
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${colors[colorIdx]} flex items-center justify-center flex-shrink-0`}>
      <span className="text-white font-semibold">{initial}</span>
    </div>
  );
}

// ── Single Comment Row ───────────────────────────────────────────────
function CommentRow({ comment, getUserName, getUserId, isReply = false, translatingComment, onTranslate, showTranslated, onToggleTranslation, language }) {
  const { isRTL } = useLanguage();
  const name = getUserName(comment.created_by);
  const userId = getUserId(comment.created_by);
  const needsTranslation = (comment.originalLanguage || detectLanguage(comment.content || '')) !== language;
  const hasTranslation = !!comment.translations?.[language];
  const displayContent = (showTranslated && hasTranslation) ? comment.translations[language] : comment.content;

  const timeStr = (() => {
    const d = new Date(comment.created_date);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' }) +
      ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  })();

  return (
    <div className={`flex gap-3 ${isReply ? 'pl-8' : ''}`}>
      <Link to={`${createPageUrl("Profile")}?userId=${userId}`} className="flex-shrink-0 mt-0.5">
        <Avatar name={name} size={isReply ? 'sm' : 'sm'} />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Link to={`${createPageUrl("Profile")}?userId=${userId}`} className="text-sm font-semibold text-slate-900 hover:text-blue-600 transition-colors">
              {name}
            </Link>
            <span className="text-[11px] text-slate-400">{timeStr}</span>
            {needsTranslation && (
              translatingComment === comment.id ? (
                <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
              ) : !hasTranslation ? (
                <button onClick={() => onTranslate(comment)} className="p-0.5 hover:bg-blue-50 rounded">
                  <Languages className="w-3 h-3 text-blue-500" />
                </button>
              ) : (
                <button onClick={() => onToggleTranslation(comment.id)} className="p-0.5 hover:bg-slate-100 rounded">
                  <Languages className={`w-3 h-3 ${showTranslated ? 'text-slate-500' : 'text-blue-500'}`} />
                </button>
              )
            )}
          </div>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words" dir="auto">{displayContent}</p>
        </div>
        {comment.likes?.length > 0 && (
          <span className="text-[11px] text-slate-400 px-3 mt-0.5 inline-block">👍 {comment.likes.length}</span>
        )}
      </div>
    </div>
  );
}

// ── Section Context Card ─────────────────────────────────────────────
function SectionContext({ section, sectionNumber, topicName, documentId, isRTL, language }) {
  const [expanded, setExpanded] = React.useState(false);
  if (!section) return null;

  const tempDiv = window.document.createElement('div');
  tempDiv.innerHTML = section.content || '';
  const text = (tempDiv.textContent || '').trim();
  const SHORT = 120;
  const needsExpand = text.length > SHORT;
  const displayText = (!expanded && needsExpand) ? text.substring(0, SHORT) + '…' : text;

  return (
    <div className="relative rounded-xl border-2 border-blue-100 bg-gradient-to-r from-blue-50/70 to-indigo-50/40 px-4 py-3 mb-4">
      {/* Section number badge */}
      <div className={`flex items-center gap-2 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
          <Hash className="w-3 h-3" />
          <span>{sectionNumber}</span>
        </div>
        <span className="text-xs text-blue-700 font-medium truncate">{topicName}</span>
        <div className={`${isRTL ? 'mr-auto' : 'ml-auto'} flex-shrink-0`}>
          <Link
            to={`${createPageUrl("DocumentView")}?id=${documentId}&scrollTo=section-${section.id}`}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
          >
            {language === 'he' ? 'לסעיף במסמך' : language === 'ar' ? 'للقسم' : 'View section'}
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
      {text && (
        <div>
          <p
            className="text-sm text-slate-700 leading-relaxed"
            style={{ fontFamily: "'Times New Roman', 'David Libre', Georgia, serif" }}
            dir="auto"
          >
            {displayText}
          </p>
          {needsExpand && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-1"
            >
              {expanded
                ? (language === 'he' ? 'הצג פחות' : language === 'ar' ? 'عرض أقل' : 'Show less')
                : (language === 'he' ? 'קרא עוד' : language === 'ar' ? 'اقرأ المزيد' : 'Read more')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Topic Divider ────────────────────────────────────────────────────
function TopicDivider({ topicName, count }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-bold text-slate-800">{topicName}</span>
        <Badge className="bg-indigo-100 text-indigo-700 border-0 text-xs px-2 py-0">{count}</Badge>
      </div>
      <div className="flex-1 h-px bg-gradient-to-r from-indigo-200 to-transparent" />
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────
export default function DocumentComments() {
  const { t, isRTL, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('id');
  const queryClient = useQueryClient();
  const [translatingComment, setTranslatingComment] = React.useState(null);
  const [showTranslatedComments, setShowTranslatedComments] = React.useState({});
  const [activeFilter, setActiveFilter] = React.useState('all'); // 'all' | topicId

  const { data: doc, isLoading: docLoading } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => base44.entities.Document.filter({ id: documentId }).then(d => d[0]),
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

  const { data: sectionComments = [] } = useQuery({
    queryKey: ['allSectionComments', documentId],
    queryFn: async () => {
      const sectionIds = sections.map(s => s.id);
      if (sectionIds.length === 0) return [];
      const all = await base44.entities.Comment.filter({ rootEntityType: 'section' });
      return all.filter(c => sectionIds.includes(c.rootEntityId));
    },
    enabled: sections.length > 0,
  });

  const { data: suggestionComments = [] } = useQuery({
    queryKey: ['allSuggestionComments', documentId],
    queryFn: async () => {
      const ids = suggestions.map(s => s.id);
      if (ids.length === 0) return [];
      const all = await base44.entities.Comment.filter({ rootEntityType: 'suggestion' });
      return all.filter(c => ids.includes(c.rootEntityId));
    },
    enabled: suggestions.length > 0,
  });

  const { data: publicProfiles = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => { try { return await base44.entities.User.list(); } catch { return []; } },
    retry: false,
  });

  const getUserName = React.useCallback((email) => {
    const profile = publicProfiles.find(p => p.email === email);
    if (profile?.fullName) return profile.fullName;
    const u = users.find(u => u.email === email);
    if (u?.full_name) return u.full_name;
    return email ? email.split('@')[0] : '?';
  }, [publicProfiles, users]);

  const getUserId = React.useCallback((email) => {
    const profile = publicProfiles.find(p => p.email === email);
    if (profile?.userId) return profile.userId;
    const u = users.find(u => u.email === email);
    return u?.id || '';
  }, [publicProfiles, users]);

  const translateMutation = useMutation({
    mutationFn: async (comment) => {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Translate the following text to ${languagePrompts[language]}. Return ONLY the translated text:\n${comment.content}`,
      });
      const translated = (typeof result === 'string' ? result : result?.content || '').trim();
      const newTranslations = { ...(comment.translations || {}), [language]: translated };
      await base44.entities.Comment.update(comment.id, { translations: newTranslations });
      return { id: comment.id, translations: newTranslations };
    },
    onMutate: (comment) => {
      setTranslatingComment(comment.id);
      setShowTranslatedComments(p => ({ ...p, [comment.id]: true }));
    },
    onSuccess: () => {
      setTranslatingComment(null);
      queryClient.invalidateQueries({ queryKey: ['allSectionComments', documentId] });
      queryClient.invalidateQueries({ queryKey: ['allSuggestionComments', documentId] });
    },
    onError: () => setTranslatingComment(null),
  });

  const acceptedSuggestionToSection = React.useMemo(() => {
    const map = {};
    suggestions.forEach(s => { if (s.status === 'accepted' && s.sectionId) map[s.id] = s.sectionId; });
    return map;
  }, [suggestions]);

  const sortedTopics = React.useMemo(() =>
    [...topics].sort((a, b) => a.order - b.order), [topics]);

  const getSectionNumber = React.useCallback((sectionId) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return '';
    const topicIdx = sortedTopics.findIndex(t => t.id === section.topicId);
    if (topicIdx === -1) return '';
    const topicSections = sections.filter(s => s.topicId === section.topicId).sort((a, b) => a.order - b.order);
    const secIdx = topicSections.findIndex(s => s.id === sectionId);
    return `${topicIdx + 1}.${secIdx + 1}`;
  }, [sections, sortedTopics]);

  // Build grouped comments, merged section + accepted-suggestion threads
  const groupedComments = React.useMemo(() => {
    const sectionGroups = {};

    sectionComments.forEach(c => {
      const key = c.rootEntityId;
      if (!sectionGroups[key]) {
        const section = sections.find(s => s.id === key);
        sectionGroups[key] = { entityId: key, section, comments: [] };
      }
      sectionGroups[key].comments.push(c);
    });

    suggestionComments.forEach(c => {
      const linkedSectionId = acceptedSuggestionToSection[c.rootEntityId];
      if (linkedSectionId) {
        if (!sectionGroups[linkedSectionId]) {
          const section = sections.find(s => s.id === linkedSectionId);
          sectionGroups[linkedSectionId] = { entityId: linkedSectionId, section, comments: [] };
        }
        if (!sectionGroups[linkedSectionId].comments.some(x => x.id === c.id)) {
          sectionGroups[linkedSectionId].comments.push(c);
        }
      }
    });

    return Object.values(sectionGroups)
      .filter(g => g.comments.length > 0)
      .map(g => {
        g.comments.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
        const topicId = g.section?.topicId || '';
        const topicName = topics.find(t => t.id === topicId)?.title || '';
        const topicOrder = sortedTopics.findIndex(t => t.id === topicId);
        const sectionOrder = sections.filter(s => s.topicId === topicId).sort((a, b) => a.order - b.order).findIndex(s => s.id === g.entityId);
        return { ...g, topicId, topicName, topicOrder, sectionOrder };
      })
      .sort((a, b) => {
        if (a.topicOrder !== b.topicOrder) return a.topicOrder - b.topicOrder;
        return a.sectionOrder - b.sectionOrder;
      });
  }, [sectionComments, suggestionComments, sections, topics, sortedTopics, acceptedSuggestionToSection]);

  const filteredGroups = activeFilter === 'all'
    ? groupedComments
    : groupedComments.filter(g => g.topicId === activeFilter);

  // Topics that actually have comments
  const topicsWithComments = React.useMemo(() => {
    const topicIds = new Set(groupedComments.map(g => g.topicId));
    return sortedTopics.filter(t => topicIds.has(t.id));
  }, [groupedComments, sortedTopics]);

  const totalComments = groupedComments.reduce((sum, g) => sum + g.comments.length, 0);
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;
  const NavChevronNext = isRTL ? ChevronLeft : ChevronRight;

  if (docLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 flex items-center justify-center">
        <p className="text-slate-500">{t('documentNotFound')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Link to={`${createPageUrl("DocumentView")}?id=${documentId}`}>
              <Button variant="ghost" size="icon" className="flex-shrink-0">
                <BackArrow className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-slate-900 truncate">
                {language === 'he' ? 'תגובות' : language === 'ar' ? 'التعليقات' : 'Comments'}
              </h1>
              <p className="text-xs text-slate-500 truncate">{doc.title}</p>
            </div>
            <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-sm font-semibold px-3 py-1 rounded-full flex-shrink-0">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{totalComments}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* ── Topic Filter Pills ── */}
        {topicsWithComments.length > 1 && (
          <div className={`flex gap-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
            <button
              onClick={() => setActiveFilter('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                activeFilter === 'all'
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              {language === 'he' ? 'הכל' : language === 'ar' ? 'الكل' : 'All'}
              <span className={`px-1.5 py-0 rounded-full text-[10px] ${activeFilter === 'all' ? 'bg-white/20' : 'bg-slate-100'}`}>{totalComments}</span>
            </button>
            {topicsWithComments.map(topic => {
              const count = groupedComments.filter(g => g.topicId === topic.id).reduce((s, g) => s + g.comments.length, 0);
              return (
                <button
                  key={topic.id}
                  onClick={() => setActiveFilter(activeFilter === topic.id ? 'all' : topic.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                    activeFilter === topic.id
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  {topic.title}
                  <span className={`px-1.5 py-0 rounded-full text-[10px] ${activeFilter === topic.id ? 'bg-white/20' : 'bg-slate-100'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Empty State ── */}
        {filteredGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">
              {language === 'he' ? 'אין תגובות עדיין' : language === 'ar' ? 'لا تعليقات بعد' : 'No comments yet'}
            </p>
          </div>
        )}

        {/* ── Comment Groups ── */}
        {filteredGroups.map((group, idx) => {
          const prevGroup = filteredGroups[idx - 1];
          const showTopicDivider = prevGroup?.topicId !== group.topicId;
          const topicCommentCount = filteredGroups.filter(g => g.topicId === group.topicId).reduce((s, g) => s + g.comments.length, 0);

          return (
            <div key={group.entityId}>
              {/* Topic divider */}
              {showTopicDivider && group.topicName && (
                <TopicDivider topicName={group.topicName} count={topicCommentCount} />
              )}

              {/* Section card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-4">
                {/* Section context */}
                <div className="px-4 pt-4 pb-0">
                  <SectionContext
                    section={group.section}
                    sectionNumber={getSectionNumber(group.entityId)}
                    topicName={group.topicName}
                    documentId={documentId}
                    isRTL={isRTL}
                    language={language}
                  />
                </div>

                {/* Comments list */}
                <div className="px-4 pb-4 space-y-3">
                  <div className={`flex items-center gap-2 mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {group.comments.length} {language === 'he' ? 'תגובות' : language === 'ar' ? 'تعليقات' : 'Comments'}
                    </span>
                  </div>
                  {group.comments.map((comment) => (
                    <CommentRow
                      key={comment.id}
                      comment={comment}
                      getUserName={getUserName}
                      getUserId={getUserId}
                      translatingComment={translatingComment}
                      onTranslate={(c) => translateMutation.mutate(c)}
                      showTranslated={!!showTranslatedComments[comment.id]}
                      onToggleTranslation={(id) => setShowTranslatedComments(p => ({ ...p, [id]: !p[id] }))}
                      language={language}
                    />
                  ))}
                </div>

                {/* Footer: navigate to section */}
                <div className={`px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center ${isRTL ? 'justify-start flex-row-reverse' : 'justify-between'}`}>
                  <Link
                    to={`${createPageUrl("DocumentView")}?id=${documentId}&scrollTo=section-${group.entityId}`}
                    className={`flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 font-medium transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {language === 'he' ? 'עבור לסעיף במסמך' : language === 'ar' ? 'انتقل إلى القسم' : 'Go to section'}
                    <NavChevronNext className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}