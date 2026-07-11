import React, { useState, useCallback, useEffect, useMemo, memo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Reply, Trash2, Edit2, X, ThumbsUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/components/LanguageContext";
import TranslatableContent from "./TranslatableContent";
import { ensureUserPublicProfile } from "@/components/ensureUserPublicProfile";
import { rateLimitedAction, RATE_LIMITS } from "@/components/utils/rateLimiter";
import { toast } from "sonner";
import { formatLocalDateTime } from "@/components/utils/dateFormatter";

// ── ReplyForm — extracted to its own component with LOCAL state ──────────────
// Typing in the reply textarea only re-renders THIS component, not all CommentItems.
// Previously, `newComment` lived in CommentsSection and was passed to every CommentItem,
// defeating memo() — every keystroke re-rendered all comments.
const ReplyForm = memo(function ReplyForm({
  parentComment,
  profileByUserId,
  profileByEmail,
  t,
  onSubmit,
  onCancel,
  isSubmitting,
}) {
  const [content, setContent] = useState("");

  // O(1) Map lookup for the "replying to" name
  const replyToName = useMemo(() => {
    const id = parentComment?.created_by_id;
    if (id) {
      const profile = profileByUserId.get(id);
      if (profile?.fullName) return profile.fullName;
    }
    const email = parentComment?.created_by;
    if (email) {
      const profile = profileByEmail.get(email);
      if (profile?.fullName) return profile.fullName;
      return email.split('@')[0] || email;
    }
    return '?';
  }, [parentComment, profileByUserId, profileByEmail]);

  return (
    <div className="mt-2 p-3 bg-blue-50 rounded-lg space-y-2 border border-blue-200">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Reply className="w-4 h-4" />
        <span>{t('replyingTo')} {replyToName}</span>
      </div>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
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
          onClick={() => { onCancel(); setContent(""); }}
          className="h-7 text-xs"
        >
          {t('cancel')}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!content.trim() || isSubmitting}
          onClick={() => {
            if (content.trim()) {
              onSubmit(content.trim());
              setContent("");
            }
          }}
          className="h-7 text-xs"
        >
          <Send className="w-3 h-3 mr-1" />
          {t('postComment')}
        </Button>
      </div>
    </div>
  );
});

// ── CommentItem — memoized, uses O(1) Map lookups ────────────────────────────
// Key optimizations:
// 1. profileByUserId / profileByEmail Maps replace O(n) Array.find (12 scans → 12 Map.get)
// 2. `replies` array is pre-grouped by parentCommentId in parent (O(n²) → O(1))
// 3. `isReplying` (boolean) replaces `replyTo` (object) — only the replying comment
//    re-renders when reply state changes, not all comments
// 4. `newComment`/`setNewComment` removed from props — reply text lives in ReplyForm
const CommentItem = memo(({ 
  comment, 
  isReply = false, 
  profileByUserId,
  profileByEmail,
  user,
  editingComment,
  setEditingComment,
  updateCommentMutation,
  onStartReply,
  isReplying,
  onCancelReply,
  onSubmitReply,
  deleteCommentMutation,
  replies,
  t,
  createCommentMutation,
  queryClient
}) => {
  const [localEditContent, setLocalEditContent] = useState(comment.content);
  
  useEffect(() => {
    setLocalEditContent(comment.content);
  }, [comment.content, editingComment?.id]);

  // O(1) Map lookups — was O(n) Array.find × 4 per call
  const getUserId = useCallback((comment) => {
    const id = comment?.created_by_id;
    if (id) {
      const profile = profileByUserId.get(id);
      if (profile?.userId) return profile.userId;
    }
    const email = comment?.created_by;
    if (email) {
      const profile = profileByEmail.get(email);
      if (profile?.userId) return profile.userId;
    }
    return '';
  }, [profileByUserId, profileByEmail]);

  const getUserName = useCallback((comment) => {
    const id = comment?.created_by_id;
    if (id) {
      const profile = profileByUserId.get(id);
      if (profile?.fullName) return profile.fullName;
    }
    const email = comment?.created_by;
    if (email) {
      const profile = profileByEmail.get(email);
      if (profile?.fullName) return profile.fullName;
      return email.split('@')[0] || email;
    }
    return '?';
  }, [profileByUserId, profileByEmail]);

  const isEditing = editingComment?.id === comment.id;

  return (
    <div id={`comment-${comment.id}`} className={`${isReply ? 'ml-8 mt-2' : ''}`}>
      <Card className={`p-3 ${isReply ? 'bg-slate-50' : 'bg-white'}`}>
        <div className="flex gap-3">
          <Link 
            to={`${createPageUrl("Profile")}?userId=${getUserId(comment)}`}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity"
          >
            <span className="text-white font-medium text-sm">
              {(getUserName(comment) || 'U').charAt(0)?.toUpperCase()}
            </span>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link 
                to={`${createPageUrl("Profile")}?userId=${getUserId(comment)}`}
                className="font-medium text-sm text-slate-900 hover:underline"
              >
                {getUserName(comment)}
              </Link>
              <span className="text-xs text-slate-500">
                {formatLocalDateTime(comment.created_date, 'DD/MM HH:mm')}
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
                  renderContent={(text) => <span>{text?.replace(/<[^>]*>/g, '')}</span>}
                />
                <div className="flex gap-2 mt-2 items-center flex-wrap">
                  {/* Like button */}
                  {(() => {
                    const likes = comment.likes || [];
                    const isLiked = user ? likes.includes(user.email) : false;
                    const likeCount = likes.length;
                    return (
                      <button
                        onClick={() => {
                          if (!user) { base44.auth.redirectToLogin(window.location.href); return; }
                          const newLikes = isLiked
                            ? likes.filter(e => e !== user.email)
                            : [...likes, user.email];
                          base44.entities.Comment.update(comment.id, { likes: newLikes });
                          // Award/deduct 5 points to comment creator (only if gamification enabled)
                          base44.functions.invoke('awardCommentLikePoints', { commentId: comment.id, isLiking: !isLiked })
                            .catch(err => console.error('[comment like points]', err));
                          // Optimistic update via queryClient passed down would need prop drilling,
                          // so just invalidate — the mutation is fast enough
                          queryClient.setQueryData(
                            ['comments', comment.rootEntityType, comment.rootEntityId],
                            (old = []) => old.map(c => c.id === comment.id ? { ...c, likes: newLikes } : c)
                          );
                        }}
                        className={`flex items-center gap-1 h-7 px-2 rounded text-xs transition-colors ${
                          isLiked
                            ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                            : 'text-slate-500 hover:text-blue-500 hover:bg-blue-50'
                        }`}
                      >
                        <ThumbsUp className={`w-3 h-3 ${isLiked ? 'fill-blue-500' : ''}`} />
                        {likeCount > 0 && <span>{likeCount}</span>}
                      </button>
                    );
                  })()}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (!user) {
                        base44.auth.redirectToLogin(window.location.href);
                        return;
                      }
                      onStartReply(comment);
                    }}
                    className="h-7 text-xs"
                  >
                    <Reply className="w-3 h-3 mr-1" />
                    {t('reply')}
                  </Button>
                  {user && (user.id === comment.created_by_id || user.email === comment.created_by) && (
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

      {/* Reply form — extracted component with local state.
          Typing here only re-renders ReplyForm, not sibling CommentItems. */}
      {isReplying && (
        <ReplyForm
          parentComment={comment}
          profileByUserId={profileByUserId}
          profileByEmail={profileByEmail}
          t={t}
          isSubmitting={createCommentMutation.isPending}
          onSubmit={(content) => {
            onSubmitReply({
              rootEntityType: comment.rootEntityType,
              rootEntityId: comment.rootEntityId,
              parentCommentId: isReply ? comment.parentCommentId : comment.id,
              content,
            });
          }}
          onCancel={onCancelReply}
        />
      )}

      {replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {replies.map(reply => (
            <CommentItem 
              key={reply.id} 
              comment={reply} 
              isReply={true}
              profileByUserId={profileByUserId}
              profileByEmail={profileByEmail}
              user={user}
              editingComment={editingComment}
              setEditingComment={setEditingComment}
              updateCommentMutation={updateCommentMutation}
              onStartReply={onStartReply}
              isReplying={false}
              onCancelReply={onCancelReply}
              onSubmitReply={onSubmitReply}
              deleteCommentMutation={deleteCommentMutation}
              replies={[]}
              t={t}
              createCommentMutation={createCommentMutation}
              queryClient={queryClient}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// Background tasks - fire and forget (notifications handled by backend automation)
const runBackgroundTasks = async (comment, entityType, entityId) => {
  try {
    const { calculateDocumentContributors } = await import('./calculateContributors');
    
    let docId;
    
    if (entityType === 'suggestion') {
      const suggestions = await base44.entities.Suggestion.filter({ id: entityId });
      if (suggestions.length > 0) docId = suggestions[0].documentId;
    } else if (entityType === 'section') {
      const sections = await base44.entities.Section.filter({ id: entityId });
      if (sections.length > 0) docId = sections[0].documentId;
    } else if (entityType === 'document') {
      docId = entityId;
    }
    
    if (docId) {
      const count = await calculateDocumentContributors(docId);
      await base44.entities.Document.update(docId, { totalUsersInteracted: count });
    }
  } catch (err) {
    console.error('[BACKGROUND TASKS ERROR]', err);
  }
};

export default function CommentsSection({ entityType, entityId, user, scrollToCommentId }) {
  const { t, isRTL, language } = useLanguage();
  const [newComment, setNewComment] = useState("");
  // Store only the ID (string) instead of the comment object.
  // A string prop change only re-renders the one CommentItem where isReplying flips,
  // not all comments (which received the full `replyTo` object before).
  const [replyToCommentId, setReplyToCommentId] = useState(null);
  
  // FIX: Removed editContent from parent state to prevent re-renders on every keystroke
  const [editingComment, setEditingComment] = useState(null); 
  
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  // Single query: fetch all comments for this entity (top-level + replies) in one call
  // Note: DocumentView pre-seeds this cache from aggregatedData, so this will often be instant
  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments', entityType, entityId],
    queryFn: async () => {
      // Fetch all top-level comments for this entity
      const topLevel = await base44.entities.Comment.filter(
        { rootEntityType: entityType, rootEntityId: entityId },
        'created_date'
      );
      if (topLevel.length === 0) return [];
      // Fetch replies in a single $in query using parent IDs
      const parentIds = topLevel.map(c => c.id);
      const replies = await base44.entities.Comment.filter(
        { parentCommentId: { $in: parentIds } },
        'created_date'
      );
      // Deduplicate and sort chronologically
      const all = [...topLevel, ...replies];
      const unique = Array.from(new Map(all.map(c => [c.id, c])).values());
      return unique.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    },
    initialData: [],
    enabled: !!entityType && !!entityId,
    staleTime: 0, // Always fetch fresh comments on mount
    refetchOnMount: true,
  });

  // REMOVED: `users` query — was fetching ALL system users (User.list()) on every mount.
  // This data was only used as a fallback for name resolution, which UserPublicProfile
  // already covers (every user gets one created in Layout on login).
  // Impact: eliminates 1 full API call per CommentsSection mount (one per section/suggestion).

  const { data: publicProfiles = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list('-created_date', 1000),
    initialData: [],
    staleTime: 2 * 60 * 1000, // 2 minutes — seeded by DocumentView, avoid redundant fetch
  });

  // ── O(1) lookup maps — built once per data change, reused by all CommentItems ──
  // Previously, each CommentItem did Array.find (O(n)) on the full profiles array.
  // With 50 comments × 1000 profiles × 12 lookups = 600,000 comparisons per render.
  // Now: 50 × 12 Map.get = 600 operations — 1000× reduction.
  const profileByUserId = useMemo(() => {
    const map = new Map();
    publicProfiles.forEach(p => { if (p.userId) map.set(p.userId, p); });
    return map;
  }, [publicProfiles]);

  const profileByEmail = useMemo(() => {
    const map = new Map();
    publicProfiles.forEach(p => { if (p.email) map.set(p.email, p); });
    return map;
  }, [publicProfiles]);

  // ── Pre-group replies by parentCommentId — O(n) once, O(1) per comment ──
  // Previously: each CommentItem did allComments.filter() → O(n²) total.
  const repliesByParentId = useMemo(() => {
    const map = new Map();
    for (const c of comments) {
      if (c.parentCommentId) {
        if (!map.has(c.parentCommentId)) map.set(c.parentCommentId, []);
        map.get(c.parentCommentId).push(c);
      }
    }
    return map;
  }, [comments]);

  const topLevelComments = useMemo(
    () => comments.filter(c => !c.parentCommentId),
    [comments]
  );

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
      
      // Find parent comment if this is a reply
      const parentComment = data.parentCommentId 
         ? comments.find(c => c.id === data.parentCommentId) 
         : null;

      // For replies, we need to determine the root entity (suggestion/section/document)
      // from the parent comment's rootEntityType and rootEntityId
      const actualEntityType = parentComment ? parentComment.rootEntityType : entityType;
      const actualEntityId = parentComment ? parentComment.rootEntityId : entityId;

      runBackgroundTasks(comment, actualEntityType, actualEntityId);
      
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
        created_by_id: user.id,
        _isOptimistic: true
      };
      
      queryClient.setQueryData(['comments', entityType, entityId], (old = []) => {
        return [...old, tempComment];
      });
      
      setNewComment("");
      setReplyToCommentId(null);
      
      return { previousComments };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] });
      setError(null);
      window.dispatchEvent(new CustomEvent('proposal:commented'));
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
      parentCommentId: replyToCommentId || null,
      content: newComment.trim(),
    });
  };

  // ── Stable callback handlers — prevent CommentItem re-renders from new function refs ──
  const handleStartReply = useCallback((comment) => setReplyToCommentId(comment.id), []);
  const handleCancelReply = useCallback(() => setReplyToCommentId(null), []);
  const handleSubmitReply = useCallback((data) => {
    createCommentMutation.mutate(data);
    setReplyToCommentId(null);
  }, [createCommentMutation]);

  // Scroll to specific comment from notification link
  React.useEffect(() => {
    if (!scrollToCommentId || isLoading || comments.length === 0 || typeof window === 'undefined') return;
    let timer, highlightTimer, attempts = 0;
    const attemptScroll = () => {
      const el = window.document.getElementById(`comment-${scrollToCommentId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'background-color 0.3s ease';
        el.style.backgroundColor = '#dbeafe';
        highlightTimer = setTimeout(() => { el.style.backgroundColor = ''; }, 3000);
      } else if (attempts < 8) {
        attempts++;
        timer = setTimeout(attemptScroll, 300 * attempts);
      }
    };
    timer = setTimeout(attemptScroll, 400);
    return () => { clearTimeout(timer); clearTimeout(highlightTimer); };
  }, [scrollToCommentId, isLoading, comments.length]);

  const totalCommentsCount = comments.length;

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-slate-500">{t('loadingComments')}</div>
        ) : topLevelComments.length === 0 ? null : (
          topLevelComments.map(comment => (
            <CommentItem 
              key={comment.id} 
              comment={comment}
              profileByUserId={profileByUserId}
              profileByEmail={profileByEmail}
              user={user}
              editingComment={editingComment}
              setEditingComment={setEditingComment}
              updateCommentMutation={updateCommentMutation}
              onStartReply={handleStartReply}
              isReplying={replyToCommentId === comment.id}
              onCancelReply={handleCancelReply}
              onSubmitReply={handleSubmitReply}
              deleteCommentMutation={deleteCommentMutation}
              replies={repliesByParentId.get(comment.id) || []}
              t={t}
              createCommentMutation={createCommentMutation}
              queryClient={queryClient}
            />
           ))
        )}
      </div>

      {/* Form for new top-level comments only */}
      {!replyToCommentId && (
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!user) {
            base44.auth.redirectToLogin(window.location.href);
            return;
          }
          handleSubmit(e);
        }} className="proposal-comment-input space-y-2 mt-6 pt-6 border-t border-slate-200">
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