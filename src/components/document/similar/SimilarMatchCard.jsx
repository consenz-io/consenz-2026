import React from "react";
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/LanguageContext";
import { parseUserDate } from "@/components/utils/dateFormatter";
import moment from "moment";
import "moment/locale/he";
import "moment/locale/ar";

/**
 * One existing match: what it is, who opened it and when, what it says, and the
 * two actions that matter — vote on it, or open it and read the full thing.
 */
export default function SimilarMatchCard({ match, documentId, locked, isVoting, votedResult, errorMessage, onVote }) {
  const { t, language } = useLanguage();

  const isSection = match.kind === "section";

  // Opens the match in the document in a new tab, so the draft in this modal is
  // never discarded just for reading the existing wording.
  const openInDocument = () => {
    const url = isSection
      ? `/DocumentView?id=${documentId}&scrollTo=section-${match.id}`
      : `/suggestiondetail?id=${match.id}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const typeLabel = isSection
    ? t("similarExistingSection")
    : match.suggestionType === "new_section"
    ? t("similarNewSectionProposal")
    : t("similarEditProposal");

  const forLabel = isSection ? t("similarVoteKeepSection") : t("similarVoteForProposal");
  const againstLabel = isSection ? t("similarVoteOpposeSection") : t("similarVoteAgainstProposal");

  const meta = [
    match.authorName ? t("similarByAuthor", { name: match.authorName }) : null,
    match.createdDate ? moment(parseUserDate(match.createdDate)).locale(language || "en").fromNow() : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const hasVotes = (match.proVotes || 0) + (match.conVotes || 0) > 0;

  const accepted = !!votedResult && (votedResult.accepted || votedResult.sectionDeleted || votedResult.alreadyAccepted);

  const acceptedTitle = votedResult?.sectionDeleted
    ? t("similarSectionDeletedTitle")
    : votedResult?.alreadyAccepted
    ? t("similarAlreadyAccepted")
    : t("similarAcceptedTitle");

  const acceptedBody = votedResult?.sectionDeleted
    ? t("similarSectionDeletedBody")
    : votedResult?.alreadyAccepted
    ? ""
    : t("similarAcceptedBody");

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 ${
        accepted ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge variant="secondary">{typeLabel}</Badge>
        {match.topicTitle && (
          <span className="text-xs text-slate-500" dir="auto">
            {t("topic")}: {match.topicTitle}
          </span>
        )}
        {meta && (
          <span className="text-xs text-slate-500 sm:ms-auto" dir="auto">
            {meta}
          </span>
        )}
      </div>

      {match.title && match.title !== match.topicTitle && (
        <p className="font-semibold text-slate-900 text-sm" dir="auto">
          {match.title}
        </p>
      )}

      {match.explanation && (
        <p className="text-sm text-slate-800 leading-relaxed" dir="auto">
          {match.explanation}
        </p>
      )}

      {match.snippet && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500">
            {isSection ? t("similarCurrentWording") : t("similarProposedWording")}
          </p>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-lg px-3 py-2 line-clamp-3" dir="auto">
            {match.snippet}
          </p>
        </div>
      )}

      {hasVotes && !votedResult && (
        <p className="text-xs text-slate-500">
          {t("similarVoteCounts", { pro: match.proVotes || 0, con: match.conVotes || 0 })}
        </p>
      )}

      {votedResult && !accepted && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 space-y-0.5">
          <p className="text-xs font-medium text-slate-800">{t("similarVoteRecorded")}</p>
          <p className="text-xs text-slate-700">
            {t("similarVoteCounts", { pro: votedResult.proVotes ?? 0, con: votedResult.conVotes ?? 0 })}
          </p>
          <p className="text-xs text-slate-500">{t("similarStillOpen")}</p>
        </div>
      )}

      {accepted && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
            <p className="text-sm font-semibold text-emerald-800">{acceptedTitle}</p>
          </div>
          {acceptedBody && <p className="text-xs text-emerald-800">{acceptedBody}</p>}
          {votedResult.acceptedContent && (
            <p className="text-xs text-slate-700 bg-white/70 border border-emerald-200 rounded-lg p-2" dir="auto">
              {votedResult.acceptedContent}
            </p>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-xs text-red-700">{errorMessage}</p>
        </div>
      )}

      {!locked && (
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <div>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={openInDocument}
              className="px-0 h-auto text-blue-700 hover:text-blue-900"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="text-xs sm:text-sm">
                {isSection ? t("similarOpenSection") : t("similarOpenProposal")}
              </span>
            </Button>
          </div>

          <p className="text-xs font-medium text-slate-500">{t("similarOptionsLabel")}</p>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onVote("pro")}
              disabled={isVoting}
              className="flex-1 border-emerald-300 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900"
            >
              {isVoting ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowUp className="w-4 h-4" aria-hidden="true" />
              )}
              <span className="text-xs sm:text-sm">{forLabel}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onVote("con")}
              disabled={isVoting}
              className="flex-1 border-red-300 text-red-800 hover:bg-red-50 hover:text-red-900"
            >
              {!isVoting && <ArrowDown className="w-4 h-4" aria-hidden="true" />}
              <span className="text-xs sm:text-sm">{againstLabel}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}