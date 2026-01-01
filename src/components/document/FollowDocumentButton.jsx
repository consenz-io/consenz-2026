import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function FollowDocumentButton({ documentId, user }) {
  const { language, isRTL } = useLanguage();
  const queryClient = useQueryClient();

  const { data: following } = useQuery({
    queryKey: ['documentFollow', documentId, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const follows = await base44.entities.DocumentFollow.filter({
        documentId,
        userId: user.id
      });
      return follows.length > 0 ? follows[0] : null;
    },
    enabled: !!user?.id && !!documentId,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (following) {
        await base44.entities.DocumentFollow.delete(following.id);
      } else {
        await base44.entities.DocumentFollow.create({
          documentId,
          userId: user.id,
          followedAt: new Date().toISOString()
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentFollow', documentId, user?.id] });
    },
  });

  if (!user) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => followMutation.mutate()}
      disabled={followMutation.isPending}
      className={following ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}
    >
      {following ? <BellOff className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} /> : <Bell className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />}
      {following 
        ? (language === 'he' ? 'הפסק מעקב' : 'Unfollow')
        : (language === 'he' ? 'עקוב' : 'Follow')}
    </Button>
  );
}