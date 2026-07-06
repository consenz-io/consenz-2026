import React from "react";
import { Virtuoso } from "react-virtuoso";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

const CommentItem = React.memo(({ comment, onReply, onDelete, getUserName, user, isRTL }) => {
  const { t } = useLanguage();
  
  return (
    <div id={`comment-${comment.id}`} className="p-3 bg-white border border-slate-200 rounded-lg">
      <p className="text-sm text-slate-700 whitespace-pre-wrap break-words" dir={isRTL ? 'rtl' : 'ltr'}>
        {comment.content}
      </p>
      <div className={`flex flex-wrap items-center ${isRTL ? 'justify-start' : 'justify-between'} gap-2 mt-2`}>
        <span className="text-xs text-slate-500">
          {getUserName(comment)} • {new Date(comment.created_date).toLocaleDateString()}
        </span>
        <div className="flex gap-2">
          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onReply(comment)}
              className="h-7 px-2 text-xs"
            >
              {t('reply')}
            </Button>
          )}
          {user && (user.id === comment.created_by_id || user.email === comment.created_by) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(comment.id)}
              className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

CommentItem.displayName = 'CommentItem';

export default function VirtualizedCommentsList({ 
  comments, 
  onReply, 
  onDelete, 
  getUserName, 
  user,
  isRTL 
}) {
  if (!comments || comments.length === 0) return null;

  // Use virtualization only for long lists (>20 items)
  if (comments.length <= 20) {
    return (
      <div className="space-y-3">
        {comments.map(comment => (
          <CommentItem
            key={comment.id}
            comment={comment}
            onReply={onReply}
            onDelete={onDelete}
            getUserName={getUserName}
            user={user}
            isRTL={isRTL}
          />
        ))}
      </div>
    );
  }

  return (
    <Virtuoso
      data={comments}
      style={{ height: '600px' }}
      itemContent={(index, comment) => (
        <div className="pb-3">
          <CommentItem
            comment={comment}
            onReply={onReply}
            onDelete={onDelete}
            getUserName={getUserName}
            user={user}
            isRTL={isRTL}
          />
        </div>
      )}
    />
  );
}