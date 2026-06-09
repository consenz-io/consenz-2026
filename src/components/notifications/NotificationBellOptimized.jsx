import React, { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/components/LanguageContext";
import VirtualizedNotificationsList from "./VirtualizedNotificationsList";
import { formatRelativeTime } from "@/components/utils/dateFormatter";
import { useCurrentUser } from "@/hooks/useCurrentUser";

/**
 * OPTIMIZATION: NotificationBell refactored to:
 * 1. Use shared useCurrentUser hook (no redundant query)
 * 2. Debounce subscription updates (800ms debounce added)
 * 3. Properly manage event listener cleanup
 * 4. Use useCallback to prevent re-renders of child components
 */
export default function NotificationBellOptimized({ user: userProp }) {
  const { t, isRTL, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Use shared hook instead of local query
  const { data: user } = useCurrentUser();
  const actualUser = userProp || user;

  // Debounce ref for subscription updates
  const notifTimerRef = useRef(null);
  const subscriptionRef = useRef(null);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', actualUser?.id],
    queryFn: async () => {
      const notifs = await base44.entities.Notification.filter({ userId: actualUser.id }, '-created_date', 50);
      return notifs;
    },
    enabled: !!actualUser?.id,
    staleTime: 30 * 1000, // Cache for 30s (changed from Infinity)
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // OPTIMIZATION: Subscription with proper debounce (800ms) and cleanup
  React.useEffect(() => {
    if (!actualUser?.id) return;
    
    const handleNotificationChange = () => {
      // Clear existing timeout
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
      
      // Debounce refetch by 800ms
      notifTimerRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['notifications', actualUser.id] });
      }, 800);
    };

    subscriptionRef.current = base44.entities.Notification.subscribe(handleNotificationChange);

    return () => {
      // Cleanup: remove subscription AND clear timer
      if (subscriptionRef.current) subscriptionRef.current();
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    };
  }, [actualUser?.id, queryClient]);

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

  // OPTIMIZATION: Memoize handler to prevent child re-renders
  const handleNotificationClick = useCallback(async (notification) => {
    setOpen(false);
    
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }
    
    if (notification.type === 'suggestion_accepted' && notification.relatedEntityId) {
      setTimeout(() => {
        navigate(`/suggestiondetail?id=${notification.relatedEntityId}`);
      }, 100);
      return;
    }

    if (notification.actionUrl && typeof notification.actionUrl === 'string' && notification.actionUrl.length > 0) {
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
          .replace(/\/learn-more(\?|#|$)/, '/learnmore$1');
      };
      const normalizedUrl = normalizeUrl(notification.actionUrl);
      setTimeout(() => {
        navigate(normalizedUrl);
      }, 100);
    }
  }, [navigate, markAsReadMutation]);

  if (!actualUser) return null;

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