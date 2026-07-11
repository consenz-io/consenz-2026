import React from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, MessageSquare, FileText, ArrowRight } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { createPageUrl } from "@/utils";
import { formatLocalDate } from "@/components/utils/dateFormatter";

function SuggestionCard({ suggestion, isRTL, t }) {
  const statusClass =
    suggestion.status === 'accepted'
      ? 'bg-green-100 text-green-800 border-green-300'
      : suggestion.status === 'rejected'
      ? 'bg-red-100 text-red-800 border-red-300'
      : 'bg-yellow-100 text-yellow-800 border-yellow-300';
  const statusLabel =
    suggestion.status === 'accepted'
      ? t('accepted')
      : suggestion.status === 'rejected'
      ? t('rejected')
      : t('pending');

  return (
    <Link
      to={`${createPageUrl("SuggestionDetail")}?id=${suggestion.id}`}
      className="block p-4 rounded-lg border-2 bg-green-50 border-green-200 hover:border-green-300 transition-all hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className={`text-xs font-semibold ${statusClass}`}>
              {statusLabel}
            </Badge>
            <span className="text-xs text-slate-500">
              {formatLocalDate(suggestion.created_date, 'DD/MM/YYYY')}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-900 mb-1">{suggestion.title}</p>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span>{suggestion.proVotes || 0} {t('pro')}</span>
            <span>{suggestion.conVotes || 0} {t('con')}</span>
          </div>
        </div>
        <ArrowRight className={`w-4 h-4 text-slate-400 shrink-0 ${isRTL ? 'rotate-180' : ''}`} />
      </div>
    </Link>
  );
}

function CommentCard({ comment, isRTL, t }) {
  let commentUrl = null;
  if (comment.rootEntityType === 'suggestion') {
    commentUrl = `${createPageUrl("SuggestionDetail")}?id=${comment.rootEntityId}&commentId=${comment.id}`;
  } else if (comment.rootEntityType === 'section') {
    commentUrl = `${createPageUrl("SectionHistory")}?id=${comment.rootEntityId}&commentId=${comment.id}`;
  }

  return (
    <div className="p-4 rounded-lg border-2 bg-blue-50 border-blue-200 hover:border-blue-300 transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs font-semibold bg-blue-100 text-blue-800 border-blue-300">
              {t('commentOn')} {comment.rootEntityType === 'suggestion' ? t('suggestion') : t('section')}
            </Badge>
            <span className="text-xs text-slate-500">
              {formatLocalDate(comment.created_date, 'DD/MM/YYYY')}
            </span>
          </div>
          <p className="text-sm text-slate-700 line-clamp-2 mb-2">{comment.content}</p>
          {commentUrl && (
            <Link to={commentUrl} className="text-blue-600 hover:underline inline-flex items-center gap-1 text-xs">
              {t('viewFullComment')}
              <ArrowRight className={`w-3 h-3 ${isRTL ? 'rotate-180' : ''}`} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function TabContent({ isLoading, items, renderItem, emptyLabels, language }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p className="text-slate-500 text-sm text-center py-8">
        {language === 'he' ? emptyLabels.he : language === 'ar' ? emptyLabels.ar : emptyLabels.en}
      </p>
    );
  }
  return <div className="space-y-3">{items.map(renderItem)}</div>;
}

export default function ProfileActivityTabs({
  userSuggestions = [],
  userComments = [],
  acceptedSuggestions = [],
  isLoading = false,
  activeTab,
  setActiveTab,
}) {
  const { t, isRTL, language } = useLanguage();

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" dir={isRTL ? 'rtl' : 'ltr'}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="accepted">
          <CheckCircle className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
          {language === 'he' ? 'התקבלו' : language === 'ar' ? 'مقبولة' : 'Accepted'} ({acceptedSuggestions.length})
        </TabsTrigger>
        <TabsTrigger value="comments">
          <MessageSquare className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
          {t('comments')} ({userComments.length})
        </TabsTrigger>
        <TabsTrigger value="suggestions">
          <FileText className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
          {t('suggestions')} ({userSuggestions.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="accepted" className="mt-4">
        <TabContent
          isLoading={isLoading}
          items={acceptedSuggestions}
          renderItem={(s) => <SuggestionCard key={s.id} suggestion={s} isRTL={isRTL} t={t} />}
          emptyLabels={{ he: 'אין הצעות שהתקבלו עדיין', ar: 'لا توجد مقترحات مقبولة بعد', en: 'No accepted suggestions yet' }}
          language={language}
        />
      </TabsContent>

      <TabsContent value="comments" className="mt-4">
        <TabContent
          isLoading={isLoading}
          items={userComments}
          renderItem={(c) => <CommentCard key={c.id} comment={c} isRTL={isRTL} t={t} />}
          emptyLabels={{ he: 'אין תגובות עדיין', ar: 'لا توجد تعليقات بعد', en: 'No comments yet' }}
          language={language}
        />
      </TabsContent>

      <TabsContent value="suggestions" className="mt-4">
        <TabContent
          isLoading={isLoading}
          items={userSuggestions}
          renderItem={(s) => <SuggestionCard key={s.id} suggestion={s} isRTL={isRTL} t={t} />}
          emptyLabels={{ he: 'אין הצעות עדיין', ar: 'لا توجد مقترحات بعد', en: 'No suggestions yet' }}
          language={language}
        />
      </TabsContent>
    </Tabs>
  );
}