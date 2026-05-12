import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function SectionVoteButtons({ section, user, onSuggestEdit, canParticipate = true, onCannotParticipate, initialVotes, acceptedSuggestionVotes }) {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [showConDialog, setShowConDialog] = useState(false);

  // Use initialVotes (batch-loaded by parent) as placeholder; after voting, re-fetch individually
  const { data: sectionVotes = [] } = useQuery({
    queryKey: ["sectionVotes", section.id],
    queryFn: () => base44.entities.SectionVote.filter({ sectionId: section.id }),
    staleTime: 60 * 1000,
    placeholderData: initialVotes,
    enabled: !acceptedSuggestionVotes, // אם יש הצעה שהתקבלה, לא צריך לטעון SectionVotes
  });

  // אם הגרסה הנוכחית הגיעה מהצעה שהתקבלה — מציג את הצבעות שלה (read-only)
  const proCount = acceptedSuggestionVotes ? acceptedSuggestionVotes.pro : sectionVotes.filter(v => v.vote === "pro").length;
  const conCount = acceptedSuggestionVotes ? acceptedSuggestionVotes.con : sectionVotes.filter(v => v.vote === "con").length;
  const userVote = acceptedSuggestionVotes ? null : (user?.id ? sectionVotes.find(v => v.userId === user.id) : null);

  const voteMutation = useMutation({
    mutationFn: async (voteType) => {
      if (!user?.id) return;
      const res = await base44.functions.invoke('voteOnSection', {
        sectionId: section.id,
        vote: voteType,
      });
      return res.data;
    },
    onSuccess: (data) => {
      // Update cache directly with fresh votes returned from backend (avoids extra fetch)
      if (data?.votes) {
        queryClient.setQueryData(["sectionVotes", section.id], data.votes);
        // Also invalidate the batch query so DocumentContent stays in sync
        queryClient.invalidateQueries({ queryKey: ["allSectionVotes"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["sectionVotes", section.id] });
        queryClient.invalidateQueries({ queryKey: ["allSectionVotes"] });
      }
    },
  });

  const handleProClick = (e) => {
    e.stopPropagation();
    if (acceptedSuggestionVotes) return; // read-only
    if (!user) {
      base44.auth.redirectToLogin(window.location.href);
      return;
    }
    if (!canParticipate) {
      if (onCannotParticipate) onCannotParticipate();
      return;
    }
    voteMutation.mutate("pro");
  };

  const handleConClick = (e) => {
    e.stopPropagation();
    if (acceptedSuggestionVotes) return; // read-only
    if (!user) {
      base44.auth.redirectToLogin(window.location.href);
      return;
    }
    if (!canParticipate) {
      if (onCannotParticipate) onCannotParticipate();
      return;
    }
    // If already voted con — toggle it off directly, no dialog
    if (userVote?.vote === "con") {
      voteMutation.mutate("con");
      return;
    }
    // Show dialog asking if they want to suggest an improvement
    setShowConDialog(true);
  };

  const handleConVoteOnly = () => {
    setShowConDialog(false);
    voteMutation.mutate("con");
  };

  const handleConVoteAndSuggest = () => {
    setShowConDialog(false);
    // Fire vote first; open modal only after vote succeeds to avoid stale state on error
    voteMutation.mutate("con", {
      onSuccess: () => {
        if (onSuggestEdit) onSuggestEdit(section);
      },
    });
  };

  const isHe = language === "he";
  const isAr = language === "ar";

  return (
    <>
      <div className="flex items-center gap-2" title={acceptedSuggestionVotes ? (isHe ? 'הצבעות שקיבלה ההצעה שהתקבלה' : isAr ? 'أصوات الاقتراح المقبول' : 'Votes from the accepted suggestion') : undefined}>
        <Button
          variant={acceptedSuggestionVotes ? "outline" : (userVote?.vote === "pro" ? "default" : "outline")}
          size="sm"
          onClick={handleProClick}
          disabled={voteMutation.isPending || !!acceptedSuggestionVotes}
          className={`text-xs px-2 md:px-3 ${!acceptedSuggestionVotes && userVote?.vote === "pro" ? "bg-green-600 hover:bg-green-700" : ""} ${acceptedSuggestionVotes ? "cursor-default opacity-80 text-green-700 border-green-300" : ""}`}
        >
          <ThumbsUp className="w-3 h-3 md:w-4 md:h-4" />
          {proCount}
        </Button>
        <Button
          variant={acceptedSuggestionVotes ? "outline" : (userVote?.vote === "con" ? "default" : "outline")}
          size="sm"
          onClick={handleConClick}
          disabled={voteMutation.isPending || !!acceptedSuggestionVotes}
          className={`text-xs px-2 md:px-3 ${!acceptedSuggestionVotes && userVote?.vote === "con" ? "bg-red-600 hover:bg-red-700" : ""} ${acceptedSuggestionVotes ? "cursor-default opacity-80 text-red-700 border-red-300" : ""}`}
        >
          <ThumbsDown className="w-3 h-3 md:w-4 md:h-4" />
          {conCount}
        </Button>
      </div>

      <Dialog open={showConDialog} onOpenChange={(open) => { if (!open) setShowConDialog(false); }}>
        <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>
              {isHe ? "האם ברצונך להציע שיפור לנוסח הסעיף?" : isAr ? "هل تريد اقتراح تحسين لنص القسم؟" : "Would you like to suggest an improvement?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            {isHe ? "הצבעתך נגד תירשם. תוכל גם להציע שינוי לנוסח הסעיף." : isAr ? "سيتم تسجيل تصويتك ضد. يمكنك أيضاً اقتراح تعديل على نص القسم." : "Your vote against will be recorded. You can also suggest a change to the section text."}
          </p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleConVoteOnly} className="flex-1">
              {isHe ? "הצבע נגד בלבד" : isAr ? "صوّت ضد فقط" : "Vote against only"}
            </Button>
            <Button onClick={handleConVoteAndSuggest} className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600">
              {isHe ? "הצע שיפור" : isAr ? "اقترح تحسيناً" : "Suggest improvement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}