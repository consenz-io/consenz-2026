import React, { useState, useCallback, useEffect, memo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Reply, Trash2, Edit2, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/components/LanguageContext";
import TranslatableContent from "./TranslatableContent";
import { ensureUserPublicProfile } from "@/components/ensureUserPublicProfile";
import { rateLimitedAction, RATE_LIMITS } from "@/components/utils/rateLimiter";
import { toast } from "sonner";

// CommentItem Component - memoized to prevent unnecessary re-renders
const CommentItem = memo(({ 
  comment, 
  isReply = false, 
  users,
  publicProfiles,
  user,
  editingComment,
  setEditingComment,
  updateCommentMutation,
  setReplyTo,
  deleteCommentMutation,
  allComments,
  t,
  replyTo,
  newComment,
  setNewComment,
  createCommentMutation
}) => {
  // Always call hooks in the same order, regardless of conditions
  const [localEditContent, setLocalEditContent] = useState(comment.content);
  
  // Always run useEffect
  useEffect(() => {
    setLocalEditContent(comment.content);
  }, [comment.content, editingComment?.id]);

  const getUserId = (email) => {
    // Try public profile first (accessible to everyone)
    const profile = publicProfiles?.find(p => p.email === email);
    if (profile?.userId) return profile.userId;
    
    // Fallback to User entity (admins only)
    const user = users?.find(u => u.email === email);
    if (user?.id) return user.id;
    
    return '';
  };

  const getUserName = (email) => {
    // Try public profile first (accessible to everyone)
    const profile = publicProfiles?.find(p => p.email === email);
    if (profile?.fullName) return profile.fullName;
    
    // Fallback to User entity (admins only)
    const user = users?.find(u => u.email === email);
    if (user?.full_name) return user.full_name;
    
    // Last resort
    return 'User';
  };

  const isEditing = editingComment?.id === comment.id;
  const replies = allComments.filter(c => c.parentCommentId === comment.id);

  return (
    <div id={`comment-${comment.id}`} className={`${isReply ? 'ml-8 mt-2' : ''}`}>
      <Card className={`p-3 ${isReply ? 'bg-slate-50' : 'bg-white'}`}>
        <div className="flex gap-3">
          <Link 
            to={`${createPageUrl("Profile")}?userId=${getUserId(comment.created_by)}`}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity"
          >
            <span className="text-white font-medium text-sm">
              {(getUserName(comment.created_by) || 'U').charAt(0)?.toUpperCase()}
            </span>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link 
                to={`${createPageUrl("Profile")}?userId=${getUserId(comment.created_by)}`}
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
            
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={localEditContent}
                  onChange={(e) => setLocalEditContent(e.target.value)}
                  className="min-h-[80px] text-sm"
                  dir="auto" 
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (localEditContent.trim()) {
                        updateCommentMutation.mutate({
                          commentId: comment.id,
                          content: localEditContent.trim()
                        });
                      }
                    }}
                    disabled={!localEditContent.trim() || updateCommentMutation.isPending}
                    className="h-7 text-xs"
                  >
                    {t('saveChanges')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingComment(null);
                      setLocalEditContent(comment.content); 
                    }}
                    className="h-7 text-xs"
                  >
                    <X className="w-3 h-3 mr-1" />
                    {t('cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <TranslatableContent
                  content={comment.content}
                  entity={comment}
                  entityType="Comment"
                  className="text-sm text-slate-700 whitespace-pre-wrap break-words"
                  renderContent={(text) => <span>{text}</span>}
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (!user) {
                        base44.auth.redirectToLogin(window.location.href);
                        return;
                      }
                      // For replies, reply to the parent instead to maintain 2-level hierarchy
                      setReplyTo(isReply && comment.parentCommentId 
                        ? allComments.find(c => c.id === comment.parentCommentId) || comment
                        : comment
                      );
                    }}
                    className="h-7 text-xs"
                  >
                    <Reply className="w-3 h-3 mr-1" />
                    {t('reply')}
                  </Button>
                  {user && user.email === comment.created_by && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingComment(comment);
                        }}
                        className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Edit2 className="w-3 h-3 mr-1" />
                        {t('edit')}
                      </Button>
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
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Reply input form - shown below this comment when replyTo is set to this comment */}
      {replyTo?.id === comment.id && (
       <div className="mt-2 p-3 bg-blue-50 rounded-lg space-y-2 border border-blue-200">
         <div className="flex items-center gap-2 text-sm text-slate-600">
           <Reply className="w-4 h-4" />
           <span>{t('replyingTo')} {(() => {
             const profile = publicProfiles?.find(p => p.email === comment.created_by);
             if (profile?.fullName) return profile.fullName;
             const userObj = users?.find(u => u.email === comment.created_by);
             if (userObj?.full_name) return userObj.full_name;
             return 'User';
           })()}</span>
         </div>
         <Textarea
           value={newComment}
           onChange={(e) => setNewComment(e.target.value)}
           placeholder={t('writeReply')}
           className="min-h-[60px]"
           dir="auto"
           aria-label={t('writeReply')}
           autoFocus
         />
         <div className="flex gap-2 justify-end">
           <Button
             type="button"
             variant="outline"
             size="sm"
             onClick={() => {
               setReplyTo(null);
               setNewComment("");
             }}
             className="h-7 text-xs"
           >
             {t('cancel')}
           </Button>
           <Button
             type="button"
             size="sm"
             disabled={!newComment.trim() || createCommentMutation.isPending}
             onClick={() => {
               if (newComment.trim()) {
                 createCommentMutation.mutate({
                   rootEntityType: comment.rootEntityType,
                   rootEntityId: comment.rootEntityId,
                   parentCommentId: isReply ? comment.parentCommentId : comment.id,
                   content: newComment.trim(),
                 });
               }
             }}
             className="h-7 text-xs"
           >
             <Send className="w-3 h-3 mr-1" />
             {t('postComment')}
           </Button>
         </div>
       </div>
      )}

      {replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {replies.map(reply => (
            <CommentItem 
              key={reply.id} 
              comment={reply} 
              isReply={true}
              users={users}
              publicProfiles={publicProfiles}
              user={user}
              editingComment={editingComment}
              setEditingComment={setEditingComment}
              updateCommentMutation={updateCommentMutation}
              setReplyTo={setReplyTo}
              deleteCommentMutation={deleteCommentMutation}
              allComments={allComments}
              t={t}
              replyTo={replyTo}
              newComment={newComment}
              setNewComment={setNewComment}
              createCommentMutation={createCommentMutation}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// Background tasks - fire and forget
const runBackgroundTasks = async (comment, entityType, entityId, parentComment, currentUser) => {
  try {
    const { notifyNewComment } = await import("../notifications/createNotification");
    const { calculateDocumentContributors } = await import('./calculateContributors');
    
    let docId;
    let documentTitle;
    
    if (entityType === 'suggestion') {
      const suggestions = await base44.entities.Suggestion.filter({ id: entityId });
      if (suggestions.length > 0) {
        docId = suggestions[0].documentId;
        const docs = await base44.entities.Document.filter({ id: docId });
        documentTitle = docs[0]?.title;
        notifyNewComment({ 
          comment, 
          targetEntity: suggestions[0], 
          targetEntityType: 'suggestion', 
          parentComment,
          currentUser,
          documentId: docId,
          documentTitle
        });
      }
    } else if (entityType === 'section') {
      const sections = await base44.entities.Section.filter({ id: entityId });
      if (sections.length > 0) {
        docId = sections[0].documentId;
        const docs = await base44.entities.Document.filter({ id: docId });
        documentTitle = docs[0]?.title;
        notifyNewComment({ 
          comment, 
          targetEntity: sections[0], 
          targetEntityType: 'section', 
          parentComment,
          currentUser,
          documentId: docId,
          documentTitle
        });
      }
    } else if (entityType === 'document') {
      const docs = await base44.entities.Document.filter({ id: entityId });
      if (docs.length > 0) {
        docId = entityId;
        documentTitle = docs[0]?.title;
        // For document comments, use the same notifyNewComment with document as targetEntity
        notifyNewComment({ 
          comment, 
          targetEntity: docs[0],
          targetEntityType: 'document',
          parentComment,
          currentUser,
          documentId: docId,
          documentTitle
        });
      }
    }
    
    if (docId) {
      const count = await calculateDocumentContributors(docId);
      await base44.entities.Document.update(docId, { totalUsersInteracted: count });
    }
  } catch (err) {
    console.error('[BACKGROUND TASKS ERROR]', err);
  }
};

export default function CommentsSection({ entityType, entityId, user }) {
  const { t, isRTL, language } = useLanguage();
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  
  // FIX: Removed editContent from parent state to prevent re-renders on every keystroke
  const [editingComment, setEditingComment] = useState(null); 
  
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  const { data: allComments, isLoading } = useQuery({
    queryKey: ['comments', entityType, entityId],
    queryFn: () => base44.entities.Comment.filter({ 
      rootEntityType: entityType, 
      rootEntityId: entityId 
    }, 'created_date'),
    initialData: [],
    enabled: !!entityType && !!entityId,
  });

  const allParentIds = React.useMemo(() => {
    return allComments.map(c => c.id);
  }, [allComments]);

  const { data: repliesComments, isLoading: repliesLoading } = useQuery({
    queryKey: ['replies', allParentIds],
    queryFn: async () => {
      if (allParentIds.length === 0) return [];
      // Fetch replies for each parent ID in parallel
      const repliesArrays = await Promise.all(
        allParentIds.map(parentId => 
          base44.entities.Comment.filter({ parentCommentId: parentId }, 'created_date')
        )
      );
      return repliesArrays.flat();
    },
    initialData: [],
    enabled: allParentIds.length > 0,
  });

  const comments = React.useMemo(() => {
    const existingIds = new Set(allComments.map(c => c.id));
    const newReplies = repliesComments.filter(r => !existingIds.has(r.id));
    const combined = [...allComments, ...newReplies];
    return combined.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
  }, [allComments, repliesComments]);

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      // Try to get all users, but if permission denied, return empty array
      // Public profiles will be used as fallback
      try {
        return await base44.entities.User.list();
      } catch (err) {
        console.warn('[CommentsSection] Cannot list users (permission denied), using public profiles only');
        return [];
      }
    },
    initialData: [],
    retry: false,
  });

  const { data: publicProfiles } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    initialData: [],
  });

  const createCommentMutation = useMutation({
    mutationFn: async (data) => {
      // Apply rate limiting
      const createComment = rateLimitedAction(
        async () => {
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
        `comment_${user?.id}`,
        RATE_LIMITS.COMMENT
      );
      
      const comment = await createComment();
      
      // Ensure UserPublicProfile exists for display
      await ensureUserPublicProfile(user);
      
      const parentComment = data.parentCommentId 
         ? comments.find(c => c.id === data.parentCommentId) 
         : null;

       runBackgroundTasks(comment, entityType, entityId, parentComment, user);
      
      return comment;
    },
    onMutate: async (data) => {
      if (!user?.email) return { previousComments: null };
      
      await queryClient.cancelQueries({ queryKey: ['comments', entityType, entityId] });
      
      const previousComments = queryClient.getQueryData(['comments', entityType, entityId]);
      
      const tempComment = {
        id: `temp-${Date.now()}`,
        rootEntityType: entityType,
        rootEntityId: entityId,
        parentCommentId: data.parentCommentId || null,
        content: data.content,
        created_date: new Date().toISOString(),
        created_by: user.email,
        _isOptimistic: true
      };
      
      queryClient.setQueryData(['comments', entityType, entityId], (old = []) => {
        return [tempComment, ...old];
      });
      
      setNewComment("");
      setReplyTo(null);
      
      return { previousComments };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] });
      setError(null);
    },
    onError: (err, variables, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(['comments', entityType, entityId], context.previousComments);
      }
      const errorMsg = err.message || "Failed to post comment";
      setError(errorMsg);
      toast.error(errorMsg);
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

  const updateCommentMutation = useMutation({
    mutationFn: async ({ commentId, content }) => {
      return await base44.entities.Comment.update(commentId, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      setEditingComment(null);
      setError(null);
    },
    onError: (err) => {
      setError(err.message || "Failed to update comment");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    if (!user || !user.id || !user.email) {
      setError("Must be logged in to comment");
      return;
    }

    createCommentMutation.mutate({
      rootEntityType: entityType,
      rootEntityId: entityId,
      parentCommentId: replyTo?.id || null,
      content: newComment.trim(),
    });
  };

  const topLevelComments = comments.filter(c => !c.parentCommentId);
  const totalCommentsCount = comments.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-slate-700">
        <MessageSquare className="w-5 h-5" />
        <h3 className="font-semibold">{t('commentsCount')} ({totalCommentsCount})</h3>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
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
             <CommentItem 
               key={comment.id} 
               comment={comment}
               users={users}
               publicProfiles={publicProfiles}
               user={user}
               editingComment={editingComment}
               setEditingComment={setEditingComment}
               updateCommentMutation={updateCommentMutation}
               setReplyTo={setReplyTo}
               deleteCommentMutation={deleteCommentMutation}
               allComments={comments}
               t={t}
               replyTo={replyTo}
               newComment={newComment}
               setNewComment={setNewComment}
               createCommentMutation={createCommentMutation}
             />
           ))
        )}
      </div>

      {/* Form for new top-level comments only */}
      {!replyTo && (
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!user) {
            base44.auth.redirectToLogin(window.location.href);
            return;
          }
          handleSubmit(e);
        }} className="space-y-2 mt-6 pt-6 border-t border-slate-200">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={t('addComment')}
            className="min-h-[80px]"
            dir="auto"
            aria-label={t('addComment')}
            aria-required="true"
            onFocus={() => {
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
      )}
    </div>
  );
}