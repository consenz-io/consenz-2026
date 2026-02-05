import React from "react";
import { Virtuoso } from "react-virtuoso";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Eye } from "lucide-react";
import { Link } from "react-router-dom";

const NotificationItem = React.memo(({ 
  notification, 
  onMarkAsRead, 
  onDelete,
  isRTL,
  language 
}) => {
  const getTypeColor = (type) => {
    switch (type) {
      case 'vote_on_suggestion': return 'bg-blue-50 border-blue-200';
      case 'suggestion_accepted': return 'bg-green-50 border-green-200';
      case 'suggestion_rejected': return 'bg-red-50 border-red-200';
      case 'suggestion_comment': return 'bg-purple-50 border-purple-200';
      case 'section_comment': return 'bg-amber-50 border-amber-200';
      case 'suggestion_expiring': return 'bg-orange-50 border-orange-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className={`p-3 border rounded-lg ${getTypeColor(notification.type)} ${!notification.read ? 'ring-2 ring-blue-400' : ''} transition-all`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {notification.actionUrl ? (
            <Link to={notification.actionUrl} className="block hover:opacity-80">
              <h4 className="font-medium text-sm text-slate-900 mb-1">{notification.title}</h4>
              <p className="text-xs text-slate-600">{notification.message}</p>
            </Link>
          ) : (
            <>
              <h4 className="font-medium text-sm text-slate-900 mb-1">{notification.title}</h4>
              <p className="text-xs text-slate-600">{notification.message}</p>
            </>
          )}
          <span className="text-[10px] text-slate-400 mt-1 block">
            {new Date(notification.created_date).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {!notification.read && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMarkAsRead(notification.id)}
              className="h-6 w-6 p-0"
              title={language === 'he' ? 'סמן כנקרא' : 'Mark as read'}
            >
              <Eye className="w-3 h-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(notification.id)}
            className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
            title={language === 'he' ? 'מחק' : 'Delete'}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
});

NotificationItem.displayName = 'NotificationItem';

export default function VirtualizedNotificationsList({
  notifications,
  onMarkAsRead,
  onDelete,
  isRTL,
  language
}) {
  if (!notifications || notifications.length === 0) return null;

  // Use virtualization for lists with >15 items
  if (notifications.length <= 15) {
    return (
      <div className="space-y-2">
        {notifications.map(notification => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onMarkAsRead={onMarkAsRead}
            onDelete={onDelete}
            isRTL={isRTL}
            language={language}
          />
        ))}
      </div>
    );
  }

  return (
    <Virtuoso
      data={notifications}
      style={{ height: '500px' }}
      itemContent={(index, notification) => (
        <div className="pb-2">
          <NotificationItem
            notification={notification}
            onMarkAsRead={onMarkAsRead}
            onDelete={onDelete}
            isRTL={isRTL}
            language={language}
          />
        </div>
      )}
    />
  );
}