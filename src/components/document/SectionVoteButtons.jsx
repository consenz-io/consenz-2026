import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function SectionVoteButtons({ section, user }) {
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();

  const { data: sectionVotes = [] } = useQuery({
    queryKey: ["sectionVotes", section.id],
    queryFn: () => base44.entities.SectionVote.filter({ sectionId: section.id }),
    staleTime: 60 * 1000,
  });

  const proCount = sectionVotes.filter(v => v.vote === "pro").length;
  const conCount = sectionVotes.filter(v => v.vote === "con").length;
  const userVote = user?.id ? sectionVotes.find(v => v.userId === user.id) : null;

  const voteMutation = useMutation({
    mutationFn: async (voteType) => {
      if (!user?.id) return;
      if (userVote) {
        if (userVote.vote === voteType) {
          // ביטול הצבעה
          await base44.entities.SectionVote.delete(userVote.id);
        } else {
          // שינוי הצבעה
          await base44.entities.SectionVote.update(userVote.id, { vote: voteType });
        }
      } else {
        await base44.entities.SectionVote.create({
          sectionId: section.id,
          userId: user.id,
          vote: voteType,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sectionVotes", section.id] });
    },
  });

  const handleVote = (e, voteType) => {
    e.stopPropagation();
    if (!user) {
      base44.auth.redirectToLogin(window.location.href);
      return;
    }
    voteMutation.mutate(voteType);
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={userVote?.vote === "pro" ? "default" : "outline"}
        size="sm"
        onClick={(e) => handleVote(e, "pro")}
        disabled={voteMutation.isPending}
        className={`text-xs px-2 md:px-3 ${userVote?.vote === "pro" ? "bg-green-600 hover:bg-green-700" : ""}`}
      >
        <ThumbsUp className="w-3 h-3 md:w-4 md:h-4" />
        {proCount}
      </Button>
      <Button
        variant={userVote?.vote === "con" ? "default" : "outline"}
        size="sm"
        onClick={(e) => handleVote(e, "con")}
        disabled={voteMutation.isPending}
        className={`text-xs px-2 md:px-3 ${userVote?.vote === "con" ? "bg-red-600 hover:bg-red-700" : ""}`}
      >
        <ThumbsDown className="w-3 h-3 md:w-4 md:h-4" />
        {conCount}
      </Button>
    </div>
  );
}