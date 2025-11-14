import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { MessageSquare, Send, Reply, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/components/LanguageContext";
import TranslatableContent from "./TranslatableContent";

export default function CommentsSection({ entityType, entityId, user }) {
  const { t } = useLanguage();
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  const { data: comments, isLoading } = useQuery({
    queryKey: ['comments', entityType, entityId],
    queryFn: () => base44.entities.Comment.filter({ 
      rootEntityType: entityType, 
      rootEntityId: entityId 
    }, '-created_date'),
    initialData: [],
    enabled: !!entityType && !!entityId,
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

  const createCommentMutation = useMutation({
    mutationFn: async (data) => {
      const hebrewPattern = /[\u0590-\u05FF]/;
      const arabicPattern = /[\u0600-\u06FF]/;
      let detectedLanguage = 'en';
      
      if (hebrewPattern.test(data.content)) detectedLanguage = 'he';
      else if (arabicPattern.test(data.content)) detectedLanguage = 'ar';
      
      return await base44.entities.Comment.create({
        ...data,
        originalLanguage: detectedLanguage
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] });
      setNewComment("");
      setReplyTo(null);
      setError(null);
    },
    onError: (err) => {
      setError(err.message || "Failed to post comment");
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId) => {
      return await base44.entities.Comment.delete(commentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] });
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
      <div className={`${isReply ? 'ml-8 mt-2' : ''}`}>
        <Card className={`p-3 ${isReply ? 'bg-slate-50' : 'bg-white'}`}>
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-medium text-sm">
                {getUserName(comment.created_by)?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm text-slate-900">
                  {getUserName(comment.created_by)}
                </span>
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

      {user && (
        <form onSubmit={handleSubmit} className="space-y-2">
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
      )}

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