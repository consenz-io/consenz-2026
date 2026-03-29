import React from "react";
import { Virtuoso } from "react-virtuoso";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { formatLocalDateTime } from "@/components/utils/dateFormatter";
import { useLanguage } from "@/components/LanguageContext";

// Fallback translations for legacy notifications that were stored without translations
const LEGACY_FALLBACKS = {
  en: {
    suggestion_accepted: { title: "A suggestion was accepted", message: "A suggestion in a document you follow was accepted" },
    suggestion_rejected: { title: "Your suggestion was rejected", message: "Your suggestion was rejected by the document admin" },
    suggestion_comment: { title: "New comment", message: "Someone commented on a suggestion" },
    section_comment: { title: "New comment", message: "Someone commented on a section" },
    comment_reply: { title: "Reply to your comment", message: "Someone replied to your comment" },
    new_suggestion_in_followed_document: { title: "New suggestion in document", message: "A new suggestion was added to a document you follow" },
    suggestion_expiring: { title: "Voting period ended", message: "The voting period for a suggestion has ended" },
    document_comment: { title: "New comment in document", message: "Someone commented in a document discussion" },
    group_join_request: { title: "Join request approved!", message: "You have been accepted to the group" },
  },
  ar: {
    suggestion_accepted: { title: "تم قبول اقتراح", message: "تم قبول اقتراح في مستند تتابعه" },
    suggestion_rejected: { title: "تم رفض اقتراحك", message: "تم رفض اقتراحك من قبل مدير المستند" },
    suggestion_comment: { title: "تعليق جديد", message: "علق أحدهم على اقتراح" },
    section_comment: { title: "تعليق جديد", message: "علق أحدهم على قسم" },
    comment_reply: { title: "رد على تعليقك", message: "رد أحدهم على تعليقك" },
    new_suggestion_in_followed_document: { title: "اقتراح جديد في المستند", message: "تمت إضافة اقتراح جديد إلى مستند تتابعه" },
    suggestion_expiring: { title: "انتهت فترة التصويت", message: "انتهت فترة التصويت على اقتراح" },
    document_comment: { title: "تعليق جديد في المستند", message: "علق أحدهم في نقاش المستند" },
    group_join_request: { title: "تمت الموافقة على طلب الانضمام!", message: "تم قبولك في المجموعة" },
  }
};

function getLocalizedNotification(notification, language) {
  // 1. If translations exist for the current language - use them
  if (notification.translations?.[language]?.title) {
    return {
      title: notification.translations[language].title,
      message: notification.translations[language].message,
    };
  }
  // 2. For non-Hebrew languages, use legacy fallback by type
  if (language !== 'he' && LEGACY_FALLBACKS[language]?.[notification.type]) {
    return LEGACY_FALLBACKS[language][notification.type];
  }
  // 3. Default: show stored title/message (Hebrew or whatever was stored)
  return { title: notification.title, message: notification.message };
}

const NotificationItem = React.memo(({ 
  notification, 
  onMarkAsRead, 
  onDelete,
  onNotificationClick,
  isRTL,
  language 
}) => {
  const { title: displayTitle, message: displayMessage } = getLocalizedNotification(notification, language);
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
            <button 
              onClick={() => onNotificationClick(notification)} 
              className="block hover:opacity-80 text-right w-full"
            >
              <h4 className="font-medium text-sm text-slate-900 mb-1">{displayTitle}</h4>
              <p className="text-xs text-slate-600">{displayMessage}</p>
            </button>
          ) : (
            <>
              <h4 className="font-medium text-sm text-slate-900 mb-1">{displayTitle}</h4>
              <p className="text-xs text-slate-600">{displayMessage}</p>
            </>
          )}
          <span className="text-[10px] text-slate-400 mt-1 block">
            {formatLocalDateTime(notification.created_date, 'DD/MM/YYYY HH:mm')}
          </span>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {!notification.read && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead(notification.id);
              }}
              className="h-6 w-6 p-0"
              title={language === 'he' ? 'סמן כנקרא' : 'Mark as read'}
            >
              <Eye className="w-3 h-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(notification.id);
            }}
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
  onNotificationClick,
  formatTimeAgo,
  getNotificationIcon,
  isRTL,
  language
}) {
  if (!notifications || notifications.length === 0) return null;

  if (notifications.length <= 15) {
    return (
      <div className="space-y-2">
        {notifications.map(notification => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onMarkAsRead={onMarkAsRead}
            onDelete={onDelete}
            onNotificationClick={onNotificationClick}
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
      style={{ height: '400px' }}
      itemContent={(index, notification) => (
        <NotificationItem
          notification={notification}
          onMarkAsRead={onMarkAsRead}
          onDelete={onDelete}
          onNotificationClick={onNotificationClick}
          isRTL={isRTL}
          language={language}
        />
      )}
    />
  );
}