import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/components/LanguageContext";
import VirtualizedNotificationsList from "./VirtualizedNotificationsList";
import { formatRelativeTime } from "@/components/utils/dateFormatter";

export default function NotificationBell({ user }) {
  const { t, isRTL, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // All hooks must be called before any conditional returns
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const notifs = await base44.entities.Notification.filter({ userId: user.id }, '-created_date', 50);
      return notifs;
    },
    enabled: !!user?.id,
    staleTime: Infinity, // Real-time via subscription
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Real-time subscription for notifications
  // IMPORTANT: `notifications` must NOT be in the dependency array — it would cause the subscription
  // to be torn down and re-created on every new notification, creating a gap where events are missed.
  // Instead we use a ref to access current notifications inside the stable callback.
  const notificationsRef = React.useRef(notifications);
  React.useEffect(() => { notificationsRef.current = notifications; }, [notifications]);

  React.useEffect(() => {
    if (!user?.id) return;
    
    let notifTimer;
    const unsubscribe = base44.entities.Notification.subscribe((event) => {
      if (event.data?.userId === user.id || (event.type === 'update' && notificationsRef.current?.some(n => n.id === event.id))) {
        clearTimeout(notifTimer);
        notifTimer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
        }, 800);
      }
    });
    
    return () => {
      clearTimeout(notifTimer);
      unsubscribe();
    };
  }, [user?.id, queryClient]);

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId) => base44.entities.Notification.update(notificationId, { read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unreadNotifications = notifications.filter(n => !n.read);
      await Promise.all(
        unreadNotifications.map(n => base44.entities.Notification.update(n.id, { read: true }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationId) => base44.entities.Notification.delete(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'vote_on_suggestion':
      case 'new_vote_on_suggestion':
        return '👍';
      case 'suggestion_accepted':
        return '✅';
      case 'suggestion_rejected':
        return '❌';
      case 'suggestion_comment':
      case 'section_comment':
      case 'document_comment':
      case 'comment_reply':
        return '💬';
      case 'suggestion_expiring':
        return '⏰';
      case 'new_suggestion_in_followed_document':
        return '📝';
      default:
        return '🔔';
    }
  };

  const formatTimeAgo = (date) => {
    return formatRelativeTime(date);
  };

  const handleNotificationClick = async (notification) => {
    try {
      // Close the popover immediately
      setOpen(false);
      
      // Mark as read (in background, don't wait)
      if (!notification.read) {
        markAsReadMutation.mutate(notification.id);
      }
      
      // For suggestion_accepted notifications, always navigate to suggestion detail
      if (notification.type === 'suggestion_accepted' && notification.relatedEntityId) {
        setTimeout(() => {
          navigate(`/suggestiondetail?id=${notification.relatedEntityId}`);
        }, 100);
        return;
      }

      // Navigate only if we have a valid actionUrl
      if (notification.actionUrl && typeof notification.actionUrl === 'string' && notification.actionUrl.length > 0) {
        // Normalize legacy kebab-case URLs that were stored in DB before the fix
        const normalizeUrl = (url) => {
          return url
            .replace(/\/document-view(\?|#|$)/, '/documentview$1')
            .replace(/\/suggestion-detail(\?|#|$)/, '/suggestiondetail$1')
            .replace(/\/my-documents(\?|#|$)/, '/mydocuments$1')
            .replace(/\/create-document(\?|#|$)/, '/createdocument$1')
            .replace(/\/document-admin(\?|#|$)/, '/documentadmin$1')
            .replace(/\/document-clean-view(\?|#|$)/, '/documentcleanview$1')
            .replace(/\/document-comments(\?|#|$)/, '/documentcomments$1')
            .replace(/\/section-history(\?|#|$)/, '/sectionhistory$1')
            .replace(/\/understanding-consensus(\?|#|$)/, '/understandingconsensus$1')
            .replace(/\/group-view(\?|#|$)/, '/groupview$1')
            .replace(/\/create-group(\?|#|$)/, '/creategroup$1')
            .replace(/\/learn-more(\?|#|$)/, '/learnmore$1')
            .replace(/\/email-logs(\?|#|$)/, '/emaillogs$1');
        };
        const normalizedUrl = normalizeUrl(notification.actionUrl);
        // Small delay to ensure popover closes smoothly
        setTimeout(() => {
          try {
            navigate(normalizedUrl);
          } catch (navError) {
            console.error('[NAVIGATION ERROR] React Router failed:', navError);
            window.location.href = normalizedUrl;
          }
        }, 100);
      }
    } catch (error) {
      console.error('[NOTIFICATION CLICK ERROR]', error);
      setOpen(false); // Ensure popover closes even on error
    }
  };

  // Conditional return AFTER all hooks
  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className={`w-[95vw] max-w-md p-0 ${isRTL ? 'ml-2' : 'mr-2'}`} align={isRTL ? 'start' : 'end'}>
        <div className="flex items-center justify-between p-3 md:p-4 border-b">
          <h3 className="font-semibold text-sm md:text-base">
            {language === 'he' ? 'התראות' : language === 'ar' ? 'الإشعارات' : 'Notifications'}
          </h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              className="text-xs md:text-sm h-8"
            >
              {language === 'he' ? 'סמן הכל כנקרא' : language === 'ar' ? 'تعليم الكل كمقروء' : 'Mark all as read'}
            </Button>
          )}
        </div>
        <div className="max-h-[60vh] md:max-h-96 overflow-y-auto p-3 md:p-4">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>{language === 'he' ? 'אין התראות חדשות' : language === 'ar' ? 'لا إشعارات جديدة' : 'No new notifications'}</p>
            </div>
          ) : (
            <VirtualizedNotificationsList
              notifications={notifications}
              onMarkAsRead={(id) => markAsReadMutation.mutate(id)}
              onDelete={(id) => deleteNotificationMutation.mutate(id)}
              onNotificationClick={handleNotificationClick}
              isRTL={isRTL}
              language={language}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}