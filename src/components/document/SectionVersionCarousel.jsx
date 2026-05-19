import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  History, MessageSquare, ChevronLeft, ChevronRight,
  CheckCircle2, PlusCircle, Edit2,
} from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import SectionDiff from "./SectionDiff";
import CommentsSection from "./CommentsSection";
import TranslatableContent from "./TranslatableContent";
import VotingProgressSection from "./VotingProgressSection";
import SectionCommentsFooter from "./SectionCommentsFooter";

// ─── SuggestionMeta ────────────────────────────────────────────────────────
// Renders suggestion info + voting + ONE comment button for suggestion_accepted versions.
function SuggestionMeta({ suggestionId, user, getUserName, document }) {
  const { t, isRTL } = useLanguage();
  const queryClient = useQueryClient();

  const { data: suggestion } = useQuery({
    queryKey: ["suggestion", suggestionId],
    queryFn: async () => {
      const res = await base44.entities.Suggestion.filter({ id: suggestionId });
      return res?.[0] ?? null;
    },
    enabled: !!suggestionId,
    staleTime: 5000,
  });

  // Bug fix #3 & #4: staleTime:0 + refetchOnMount ensures we always get fresh data
  // for THIS suggestionId, preventing stale [] or data from a previous suggestion.
  const { data: suggestionComments = [] } = useQuery({
    queryKey: ["suggestionComments", suggestionId],
    queryFn: () =>
      base44.entities.Comment.filter({
        rootEntityType: "suggestion",
        rootEntityId: suggestionId,
      }),
    enabled: !!suggestionId,
    initialData: [],
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: userVote } = useQuery({
    queryKey: ["vote", suggestionId, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const votes = await base44.entities.Vote.filter({ suggestionId, userId: user.id });
      return votes?.[0] ?? null;
    },
    enabled: !!suggestionId && !!user?.id,
    staleTime: 10000,
  });

  const voteMutation = useMutation({
    mutationFn: async (voteType) => {
      if (!user?.id) throw new Error("login required");
      await base44.functions.invoke("voteOnSuggestion", { suggestionId, vote: voteType, userId: user.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vote", suggestionId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ["suggestion", suggestionId] });
    },
  });

  const [showSuggComments, setShowSuggComments] = useState(false);

  if (!suggestion) return null;

  const isReadOnly = suggestion.status !== "pending";
  const acceptedDate = suggestion.status === "accepted" ? suggestion.updated_date : null;
  const rejectedDate = suggestion.status === "rejected" ? suggestion.updated_date : null;

  const commentCount = suggestionComments.length;
  const hasComments = commentCount > 0;

  return (
    <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50/60 p-3 space-y-2">
      {suggestion.explanation && (
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1">{t("explanationForSuggestion")}</p>
          <TranslatableContent
            content={suggestion.explanation}
            entity={suggestion}
            entityType="Suggestion"
            fieldName="explanation"
            className="text-xs text-slate-600"
          />
        </div>
      )}

      {/* Voting progress + buttons */}
      <VotingProgressSection
        suggestion={suggestion}
        document={document}
        userVote={userVote}
        voteMutation={voteMutation}
        isRTL={isRTL}
        readOnly={isReadOnly}
        acceptedDate={acceptedDate}
        rejectedDate={rejectedDate}
        rejectedByAdmin={suggestion.rejectedByAdmin}
      />

      {/* Bug fix #1 & #2: Single comment button, styled like SectionCarousel suggestion buttons */}
      <Button
        variant={hasComments ? "outline" : "ghost"}
        size="sm"
        onClick={() => setShowSuggComments((v) => !v)}
        className={`h-8 text-sm px-3 gap-1.5 transition-all ${
          hasComments
            ? "font-semibold text-blue-700 border-blue-300 bg-blue-50 hover:bg-blue-100"
            : "text-slate-600 hover:text-blue-600"
        }`}
      >
        <MessageSquare className={`w-4 h-4 ${hasComments ? "fill-blue-200" : ""}`} />
        {t("comments")}{hasComments ? ` (${commentCount})` : ""}
      </Button>

      {/* Bug fix #5: Comments posted here are entityType="suggestion" + this suggestionId,
          so they appear correctly in the sidebar and suggestion detail page too */}
      {showSuggComments && (
        <div className="pt-2 border-t border-teal-200">
          <CommentsSection entityType="suggestion" entityId={suggestionId} user={user} />
        </div>
      )}
    </div>
  );
}

// ─── SectionVersionCarousel (main export) ──────────────────────────────────
export default function SectionVersionCarousel({
  sectionId,
  documentId,
  document,
  user,
  getUserName,
  isAdmin,
  onClose,
}) {
  const { t, isRTL, language } = useLanguage();
  const queryClient = useQueryClient();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSectionComments, setShowSectionComments] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [error, setError] = useState(null);

  const { data: publicProfiles = [] } = useQuery({
    queryKey: ["publicProfiles"],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    staleTime: 60000,
  });

  const { data: section } = useQuery({
    queryKey: ["section", sectionId],
    queryFn: async () => {
      const res = await base44.entities.Section.filter({ id: sectionId });
      return res?.[0] ?? null;
    },
    enabled: !!sectionId,
    staleTime: 5000,
  });

  const { data: versions = [], isLoading: versionsLoading, isFetching: versionsFetching } = useQuery({
    queryKey: ["versions", sectionId, documentId],
    queryFn: async () => {
      if (!documentId) return [];
      const result = await base44.functions.invoke("getDocumentVersionsServiceRole", { documentId });
      const all = result?.data?.data ?? result?.data ?? [];
      return all.filter((v) => v.sectionId === sectionId).sort((a, b) => (b.version || 0) - (a.version || 0));
    },
    initialData: [],
    enabled: !!sectionId && !!documentId,
    staleTime: 0,
  });

  // Section comments — only used for direct_edit / section_created versions
  const { data: sectionComments = [] } = useQuery({
    queryKey: ["sectionComments", sectionId],
    queryFn: () =>
      base44.entities.Comment.filter({ rootEntityType: "section", rootEntityId: sectionId }),
    enabled: !!sectionId,
    initialData: [],
    staleTime: 0,
    refetchOnMount: true,
  });

  // ── Version processing ─────────────────────────────────────────────────────
  const sortedVersions = [...versions]
    .sort((a, b) => (b.version || 0) - (a.version || 0))
    .filter((v, i, arr) => {
      if (i === arr.length - 1) return true;
      return v.content !== arr[i + 1]?.content;
    });

  const versionGroups = sortedVersions
    .map((ver, i) => ({
      version: ver,
      previousVersion: sortedVersions[i + 1] ?? null,
      suggestionId: ver.suggestionId ?? null,
    }))
    .filter((g) => g.version?.changeType);

  // ── Restore mutation ───────────────────────────────────────────────────────
  const restoreMutation = useMutation({
    mutationFn: async (versionToRestore) => {
      if (!isAdmin) throw new Error(t("adminAccessRequired"));
      const all = await base44.entities.DocumentVersion.filter({ sectionId });
      const nextVer = all.length > 0 ? Math.max(...all.map((v) => v.version)) + 1 : 1;
      await base44.entities.DocumentVersion.create({
        documentId,
        sectionId,
        content: section?.content ?? "",
        changeDescription: t("restoredFromVersion", { version: versionToRestore.version }),
        version: nextVer,
        changeType: "direct_edit",
      });
      await base44.entities.Section.update(sectionId, {
        content: versionToRestore.content,
        lastEditedBy: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["section", sectionId] });
      queryClient.invalidateQueries({ queryKey: ["versions", sectionId] });
      setError(null);
      setRestoreTarget(null);
    },
    onError: (err) => {
      setError(err.message);
      setRestoreTarget(null);
      setTimeout(() => setError(null), 5000);
    },
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const localGetUserName = (email) => {
    if (getUserName) return getUserName(email);
    const profile = publicProfiles.find((p) => p.email === email);
    return profile?.fullName || email || "User";
  };

  // Must be before early returns (hooks rule)
  const currentGroup = versionGroups[Math.min(currentIndex, versionGroups.length - 1)];
  const { data: currentSuggestion } = useQuery({
    queryKey: ["suggestion", currentGroup?.suggestionId ?? null],
    queryFn: async () => {
      const res = await base44.entities.Suggestion.filter({ id: currentGroup.suggestionId });
      return res?.[0] ?? null;
    },
    enabled: !!currentGroup?.suggestionId,
    staleTime: 30000,
  });

  // ── Empty / loading states ─────────────────────────────────────────────────
  if (versionsLoading || versionsFetching) {
    return (
      <div className="space-y-3 p-1">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  if (!versionsLoading && versionGroups.length === 0) {
    return (
      <div className="text-center py-10 px-4">
        <History className="w-10 h-10 text-teal-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-600">{t("noPreviousVersions")}</p>
        <p className="text-xs text-slate-400 mt-1">{t("sectionChangesAutomaticallySaved")}</p>
      </div>
    );
  }

  const safeIndex = Math.min(currentIndex, versionGroups.length - 1);
  const group = versionGroups[safeIndex];
  const currentVer = group?.version;
  const prevVer = group?.previousVersion;

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── Nav bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 bg-teal-100/70 border border-teal-200 rounded-lg px-3 py-2">
        <button
          onClick={() => setCurrentIndex((i) => (i + 1) % versionGroups.length)}
          className="flex items-center justify-center w-10 h-10 rounded-xl border-2 border-teal-300 bg-white text-teal-700 hover:bg-teal-100 hover:border-teal-500 hover:shadow-md active:scale-95 transition-all shadow-sm"
          aria-label={isRTL ? t("nextSuggestion") : t("previousSuggestion")}
        >
          {isRTL ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>

        <div className="text-center flex-1 px-2">
          <div className="flex flex-col items-center gap-0.5">
            {(() => {
              const creatorEmail = currentSuggestion?.created_by || currentVer?.created_by;
              const changeType = currentVer?.changeType;
              const userName = creatorEmail ? localGetUserName(creatorEmail) : null;
              let label = null;
              if (changeType === "section_created") {
                label = language === "he" ? `סעיף נוצר על ידי ${userName}` : language === "ar" ? `تم إنشاء القسم بواسطة ${userName}` : `Section created by ${userName}`;
              } else if (changeType === "suggestion_accepted") {
                label = language === "he" ? `הצעת עריכה על ידי ${userName}` : language === "ar" ? `اقتراح تعديل بواسطة ${userName}` : `Edit suggestion by ${userName}`;
              } else if (changeType === "direct_edit") {
                label = language === "he" ? `עריכה על ידי אדמין` : language === "ar" ? `تعديل مباشر بواسطة المسؤول` : `Direct edit by admin`;
              } else if (userName) {
                label = `${t("by")} ${userName}`;
              }
              return label ? <span className="text-sm font-bold text-teal-700">{label}</span> : null;
            })()}
            <span className="text-[10px] text-slate-400">
              {new Date(currentVer?.created_date).toLocaleDateString(isRTL ? "he-IL" : "en-GB", {
                day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
              })}
              {" · "}{safeIndex + 1} / {versionGroups.length}
            </span>
          </div>
        </div>

        <button
          onClick={() => setCurrentIndex((i) => (i - 1 + versionGroups.length) % versionGroups.length)}
          className="flex items-center justify-center w-10 h-10 rounded-xl border-2 border-teal-300 bg-white text-teal-700 hover:bg-teal-100 hover:border-teal-500 hover:shadow-md active:scale-95 transition-all shadow-sm"
          aria-label={isRTL ? t("previousSuggestion") : t("nextSuggestion")}
        >
          {isRTL ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
      </div>

      {/* ── Dot indicators ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-1.5">
        {versionGroups.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`rounded-full transition-all duration-200 ${
              idx === safeIndex ? "w-5 h-2.5 bg-teal-500" : "w-2 h-2 bg-teal-200 hover:bg-teal-400"
            }`}
            aria-label={`${t("version")} ${versionGroups[idx]?.version?.version}`}
          />
        ))}
      </div>

      {/* ── Version card ─────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-teal-200 bg-white/80 overflow-hidden">
        <div className="p-3">
          {prevVer ? (
            <SectionDiff
              key={`${currentVer?.id}-${prevVer?.id}`}
              originalContent={prevVer.content}
              newContent={currentVer?.content}
              documentId={documentId}
              sectionId={sectionId}
            />
          ) : (
            <div
              className="prose prose-sm max-w-none text-slate-700 p-3 bg-slate-50 rounded-lg"
              style={{
                direction: isRTL ? "rtl" : "ltr",
                textAlign: isRTL ? "right" : "left",
                fontFamily: "'Times New Roman', 'David Libre', 'Noto Serif', Georgia, serif",
                fontSize: "1rem",
                lineHeight: "1.75",
              }}
              dangerouslySetInnerHTML={{ __html: currentVer?.content }}
            />
          )}

          {/* SuggestionMeta owns the comment button for suggestion_accepted versions */}
          {group.suggestionId && (
            <SuggestionMeta
              suggestionId={group.suggestionId}
              user={user}
              getUserName={localGetUserName}
              document={document}
            />
          )}
        </div>

        {/* SectionCommentsFooter renders ONLY for non-suggestion versions (returns null otherwise) */}
        <SectionCommentsFooter
          group={group}
          sectionId={sectionId}
          sectionComments={sectionComments}
          showSectionComments={showSectionComments}
          setShowSectionComments={setShowSectionComments}
          user={user}
          isRTL={isRTL}
          t={t}
        />
      </div>

      {/* ── Restore confirm dialog ────────────────────────────────────────── */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("restoreVersion")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmRestoreVersion")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreTarget && restoreMutation.mutate(restoreTarget)}
              disabled={restoreMutation.isPending}
            >
              {t("restoreVersion")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}