import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import NotificationBell from "./NotificationBell";
import NotificationErrorBoundary from "./NotificationErrorBoundary";

export default function FloatingNotificationBell() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  if (!user) return null;

  return (
    <div className="fixed bottom-24 right-6 z-40">
      <NotificationErrorBoundary>
        <div className="bg-white rounded-full shadow-lg p-2 hover:shadow-xl transition-all duration-300 hover:scale-110">
          <NotificationBell user={user} />
        </div>
      </NotificationErrorBoundary>
    </div>
  );
}