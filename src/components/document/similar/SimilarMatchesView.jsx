import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/components/LanguageContext";
import { castVote } from "@/components/document/utils/castVote";
import SimilarMatchCard from "./SimilarMatchCard";
import { plainText } from "./similarProposals";

/**
 * The duplicate-review window: how many existing matches were found, what each
 * one is, and the two ways forward — vote on what already exists, or go back and
 * publish anyway. Voting ends the flow and no new proposal is published.
 */
export default function SimilarMatchesView({
  document,
  user,
  matches,
  draftText,
  onBackToDraft,
  onContinuePublishing,
  onDraftCleared,
  onClose,
}) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [pendingVote, setPendingVote] = useState(null);
  const [votingKey, setVotingKey] = useState(null);
  const [result, setResult] = useState(null);
  const [voteError, setVoteError] = useState(null);

  const refreshCaches = () => {
    const keys = [
      ["suggestions", document.id],
      ["sections", document.id],
      ["document", document.id],
      ["documentAggregatedData", document.id],
      ["documentVersions", document.id],
    ];
    if (user?.id) keys.push(["userVotes", document.id, user.id]);
    keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
  };

  const submitVote = async () => {
    if (!pendingVote) return;
    const { match, vote } = pendingVote;
    setPendingVote(null);
    setVoteError(null);
    setVotingKey(match.key);
    onDraftCleared();

    try {
      if (match.kind === "section") {
        const response = await base44.functions.invoke("voteOnSectionV2", {
          sectionId: match.id,
          vote,
        });
        if (!response.data?.success) {
          throw new Error(response.data?.error || t("similarVoteFailed"));
        }
        setResult({
          key: match.key,
          vote,
          sectionDeleted: !!response.data.sectionDeleted,
          proVotes: response.data.proCount,
          conVotes: response.data.conCount,
        });
      } else {
        const data = await castVote({ suggestionId: match.id, vote, document, user });

        let acceptedContent = "";
        if (data.accepted) {
          const fresh = await base44.entities.Suggestion.filter({ id: match.id })
            .then((r) => r[0])
            .catch(() => null);
          acceptedContent = plainText(fresh?.newContent).slice(0, 400);
        }

        setResult({
          key: match.key,
          vote,
          accepted: !!data.accepted,
          proVotes: data.newProVotes,
          conVotes: data.newConVotes,
          acceptedContent,
        });
      }

      refreshCaches();
      window.dispatchEvent(new CustomEvent("consenz:vote-cast"));
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || "";
      if (message.includes("כבר טופלה") || message.toLowerCase().includes("already")) {
        setResult({ key: match.key, vote, alreadyAccepted: true });
        refreshCaches();
      } else {
        setVoteError({ key: match.key, message: message || t("similarVoteFailed") });
      }
    } finally {
      setVotingKey(null);
    }
  };

  const countLabel =
    matches.length === 1
      ? t("similarMatchOne")
      : t("similarMatchMany", { count: matches.length });

  const draftSnippet = plainText(draftText).slice(0, 300);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{countLabel}</span>
        </h2>
        <p className="text-sm text-slate-600">{t("similarMatchesBody")}</p>
      </div>

      <div className="space-y-3">
        {matches.map((match) => (
          <SimilarMatchCard
            key={match.key}
            match={match}
            documentId={document.id}
            draftText={draftSnippet}
            locked={!!result || !!votingKey}
            isVoting={votingKey === match.key}
            votedResult={result?.key === match.key ? result : null}
            errorMessage={voteError?.key === match.key ? voteError.message : null}
            onVote={(vote) => setPendingVote({ match, vote })}
          />
        ))}
      </div>

      {result ? (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-500">{t("similarDraftDeletedNote")}</p>
          <Button type="button" onClick={onClose} className="w-full">
            {t("similarShowDocument")}
          </Button>
        </div>
      ) : (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <Button type="button" onClick={onBackToDraft} className="w-full">
            {t("similarBackToEdit")}
          </Button>
          <Button type="button" variant="outline" onClick={onContinuePublishing} className="w-full">
            {t("similarPublishAnyway")}
          </Button>
          <p className="text-xs text-slate-500">{t("similarPublishAnywayNote")}</p>
        </div>
      )}

      <AlertDialog open={!!pendingVote} onOpenChange={(open) => !open && setPendingVote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("similarDraftWarningTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("similarDraftWarningBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={submitVote}>{t("similarDraftWarningConfirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}