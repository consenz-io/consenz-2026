import React, { useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Reply, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/components/LanguageContext";
import TranslatableContent from "./TranslatableContent";

// Background tasks - fire and forget
const runBackgroundTasks = async (comment, entityType, entityId, parentComment) => {
  try {
    const { notifyNewComment, notifyNewDocumentComment } = await import("../notifications/createNotification");
    const { calculateDocumentContributors } = await import('./calculateContributors');
    
    let documentId;
    
    if (entityType === 'suggestion') {
      const suggestions = await base44.entities.Suggestion.filter({ id: entityId });
      if (suggestions.length > 0) {
        documentId = suggestions[0].documentId;
        notifyNewComment({ comment, targetEntity: suggestions[0], targetEntityType: 'suggestion', parentComment });
      }
    } else if (entityType === 'section') {
      const sections = await base44.entities.Section.filter({ id: entityId });
      if (sections.length > 0) {
        documentId = sections[0].documentId;
        notifyNewComment({ comment, targetEntity: sections[0], targetEntityType: 'section', parentComment });
      }
    } else if (entityType === 'document') {
      const documents = await base44.entities.Document.filter({ id: entityId });
      if (documents.length > 0) {
        documentId = entityId;
        notifyNewDocumentComment({ comment, document: documents[0], parentComment });
      }
    }
    
    if (documentId) {
      const count = await calculateDocumentContributors(documentId);
      await base44.entities.Document.update(documentId, { totalUsersInteracted: count });
    }
  } catch (err) {
    console.error('[BACKGROUND TASKS ERROR]', err);
  }
};

export default function CommentsSection({ entityType, entityId, user, sectionId }) {
  const { t } = useLanguage();
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  const { data: suggestionComments, isLoading: suggestionCommentsLoading } = useQuery({
    queryKey: ['comments', entityType, entityId],
    queryFn: () => base44.entities.Comment.filter({ 
      rootEntityType: entityType, 
      rootEntityId: entityId 
    }, '-created_date'),
    initialData: [],
    enabled: !!entityType && !!entityId,
  });

  // אם יש sectionId, טען גם את התגובות של הסעיף
  const { data: sectionComments, isLoading: sectionCommentsLoading } = useQuery({
    queryKey: ['comments', 'section', sectionId],
    queryFn: () => base44.entities.Comment.filter({ 
      rootEntityType: 'section', 
      rootEntityId: sectionId 
    }, '-created_date'),
    initialData: [],
    enabled: !!sectionId && entityType === 'suggestion',
  });

  // טען את כל ה-replies לתגובות שטענו (כי replies יכולות להיות ב-rootEntityType שונה)
  const allParentIds = React.useMemo(() => {
    const ids = [...suggestionComments.map(c => c.id)];
    if (entityType === 'suggestion' && sectionId) {
      ids.push(...sectionComments.map(c => c.id));
    }
    return ids;
  }, [suggestionComments, sectionComments, entityType, sectionId]);

  const { data: repliesComments, isLoading: repliesLoading } = useQuery({
    queryKey: ['replies', allParentIds],
    queryFn: async () => {
      if (allParentIds.length === 0) return [];
      // טען תגובות שה-parentCommentId שלהן הוא אחד מהתגובות שטענו
      const allComments = await base44.entities.Comment.list('-created_date', 500);
      return allComments.filter(c => c.parentCommentId && allParentIds.includes(c.parentCommentId));
    },
    initialData: [],
    enabled: allParentIds.length > 0,
  });

  // מיזוג התגובות - אם זו הצעה עם sectionId, הצג גם תגובות סעיף
  const comments = React.useMemo(() => {
    let baseComments = [...suggestionComments];
    
    if (entityType === 'suggestion' && sectionId && sectionComments.length > 0) {
      baseComments = [...baseComments, ...sectionComments];
    }
    
    // הוסף replies שלא נכללות כבר
    const existingIds = new Set(baseComments.map(c => c.id));
    const newReplies = repliesComments.filter(r => !existingIds.has(r.id));
    baseComments = [...baseComments, ...newReplies];
    
    return baseComments.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }, [suggestionComments, sectionComments, repliesComments, entityType, sectionId]);

  const isLoading = suggestionCommentsLoading || (entityType === 'suggestion' && sectionId && sectionCommentsLoading) || repliesLoading;

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const getUserName = (email) => {
    const user = users.find(u => u.email === email);
    return user?.full_name || email?.split('@')[0] || email;
  };

  const createCommentMutation = useMutation({
    mutationFn: async (data) => {
      const hebrewPattern = /[\u0590-\u05FF]/;
      const arabicPattern = /[\u0600-\u06FF]/;
      let detectedLanguage = 'en';
      
      if (hebrewPattern.test(data.content)) detectedLanguage = 'he';
      else if (arabicPattern.test(data.content)) detectedLanguage = 'ar';
      
      // Create comment - this is the only blocking call
      const comment = await base44.entities.Comment.create({
        ...data,
        originalLanguage: detectedLanguage
      });
      
      // Find parent comment for reply context (needed for background tasks)
      const parentComment = data.parentCommentId 
        ? comments.find(c => c.id === data.parentCommentId) 
        : null;
      
      // Run all other tasks in background - don't await
      runBackgroundTasks(comment, entityType, entityId, parentComment);
      
      return comment;
    },
    // Optimistic update for instant feedback
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['comments', entityType, entityId] });
      
      const previousComments = queryClient.getQueryData(['comments', entityType, entityId]);
      
      const tempComment = {
        id: `temp-${Date.now()}`,
        rootEntityType: entityType,
        rootEntityId: entityId,
        parentCommentId: data.parentCommentId || null,
        content: data.content,
        created_date: new Date().toISOString(),
        created_by: user?.email,
        _isOptimistic: true
      };
      
      queryClient.setQueryData(['comments', entityType, entityId], (old = []) => {
        return [tempComment, ...old];
      });
      
      // Clear form immediately for instant feedback
      setNewComment("");
      setReplyTo(null);
      
      return { previousComments };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] });
      setError(null);
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousComments) {
        queryClient.setQueryData(['comments', entityType, entityId], context.previousComments);
      }
      setError(err.message || "Failed to post comment");
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId) => {
      return await base44.entities.Comment.delete(commentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      setError(null);
    },
    onError: (err) => {
      setError(err.message || "Failed to delete comment");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    createCommentMutation.mutate({
      rootEntityType: entityType,
      rootEntityId: entityId,
      parentCommentId: replyTo?.id || null,
      content: newComment.trim(),
    });
  };

  const topLevelComments = comments.filter(c => !c.parentCommentId);
  const getReplies = (commentId) => {
    return comments.filter(c => c.parentCommentId === commentId);
  };

  const CommentItem = ({ comment, isReply = false }) => {
    const replies = getReplies(comment.id);

    return (
      <div id={`comment-${comment.id}`} className={`${isReply ? 'ml-8 mt-2' : ''}`}>
        <Card className={`p-3 ${isReply ? 'bg-slate-50' : 'bg-white'}`}>
          <div className="flex gap-3">
            <Link 
              to={`${createPageUrl("Profile")}?userId=${users.find(u => u.email === comment.created_by)?.id}`}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity"
            >
              <span className="text-white font-medium text-sm">
                {getUserName(comment.created_by)?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Link 
                  to={`${createPageUrl("Profile")}?userId=${users.find(u => u.email === comment.created_by)?.id}`}
                  className="font-medium text-sm text-slate-900 hover:underline"
                >
                  {getUserName(comment.created_by)}
                </Link>
                <span className="text-xs text-slate-500">
                  {new Date(comment.created_date).toLocaleDateString('he-IL', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              <TranslatableContent
                content={comment.content}
                entity={comment}
                entityType="Comment"
                className="text-sm text-slate-700 whitespace-pre-wrap break-words"
                renderContent={(text) => <span>{text}</span>}
              />
              <div className="flex gap-2 mt-2">
                {user && !isReply && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReplyTo(comment)}
                    className="h-7 text-xs"
                  >
                    <Reply className="w-3 h-3 mr-1" />
                    {t('reply')}
                  </Button>
                )}
                {user && user.email === comment.created_by && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteCommentMutation.mutate(comment.id)}
                    disabled={deleteCommentMutation.isPending}
                    className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    {t('delete')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
        {replies.length > 0 && (
          <div className="mt-2 space-y-2">
            {replies.map(reply => (
              <CommentItem key={reply.id} comment={reply} isReply={true} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-slate-700">
        <MessageSquare className="w-5 h-5" />
        <h3 className="font-semibold">{t('commentsCount')} ({comments.length})</h3>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={(e) => {
        e.preventDefault();
        if (!user) {
          base44.auth.redirectToLogin(window.location.href);
          return;
        }
        handleSubmit(e);
      }} className="space-y-2">
        {replyTo && (
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-blue-50 p-2 rounded">
            <Reply className="w-4 h-4" />
            <span>{t('replyingTo')} {getUserName(replyTo.created_by)}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setReplyTo(null)}
              className="mr-auto h-6"
            >
              {t('cancel')}
            </Button>
          </div>
        )}
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={replyTo ? t('writeReply') : t('addComment')}
          className="min-h-[80px]"
          dir="auto"
          onClick={() => {
            if (!user) {
              base44.auth.redirectToLogin(window.location.href);
            }
          }}
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={!newComment.trim() || createCommentMutation.isPending}
            size="sm"
          >
            <Send className="w-4 h-4 mr-2" />
            {t('postComment')}
          </Button>
        </div>
      </form>

      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-slate-500">{t('loadingComments')}</div>
        ) : topLevelComments.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            {t('noCommentsYet')} {user && t('beFirstToComment')}
          </div>
        ) : (
          topLevelComments.map(comment => (
            <CommentItem key={comment.id} comment={comment} />
          ))
        )}
      </div>
    </div>
  );
}