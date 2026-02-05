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

export default function NotificationBell({ user }) {
  const { t, isRTL } = useLanguage();
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
    staleTime: 30000,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

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
    const now = new Date();
    const then = new Date(date);
    const diff = now - then;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'עכשיו';
    if (minutes < 60) return `לפני ${minutes} דקות`;
    if (hours < 24) return `לפני ${hours} שעות`;
    return `לפני ${days} ימים`;
  };

  const handleNotificationClick = async (notification) => {
    try {
      // Mark as read first and WAIT for it
      if (!notification.read) {
        await markAsReadMutation.mutateAsync(notification.id);
      }
      
      // Close the popover
      setOpen(false);
      
      // Navigate only if we have a valid actionUrl
      if (notification.actionUrl && typeof notification.actionUrl === 'string' && notification.actionUrl.length > 0) {
        // Small delay to ensure popover closes
        await new Promise(resolve => setTimeout(resolve, 150));
        
        try {
          navigate(notification.actionUrl);
        } catch (navError) {
          console.error('[NAVIGATION ERROR] React Router failed:', navError);
          // Fallback to window.location for external or problematic URLs
          window.location.href = notification.actionUrl;
        }
      }
    } catch (error) {
      console.error('[NOTIFICATION CLICK ERROR]', error);
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
          <h3 className="font-semibold text-sm md:text-base">התראות</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              className="text-xs md:text-sm h-8"
            >
              סמן הכל כנקרא
            </Button>
          )}
        </div>
        <div className="max-h-[60vh] md:max-h-96 overflow-y-auto p-3 md:p-4">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>אין התראות חדשות</p>
            </div>
          ) : (
            <VirtualizedNotificationsList
              notifications={notifications}
              onMarkAsRead={(id) => markAsReadMutation.mutate(id)}
              onDelete={(id) => deleteNotificationMutation.mutate(id)}
              onNotificationClick={handleNotificationClick}
              formatTimeAgo={formatTimeAgo}
              getNotificationIcon={getNotificationIcon}
              isRTL={isRTL}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}