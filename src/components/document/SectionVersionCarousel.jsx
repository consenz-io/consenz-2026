import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  History, MessageSquare, Clock, RotateCcw, ExternalLink,
  ChevronLeft, ChevronRight, CheckCircle2, PlusCircle, Edit2,
  X
} from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import SectionDiff from "./SectionDiff";
import CommentsSection from "./CommentsSection";
import TranslatableContent from "./TranslatableContent";

// ─── SuggestionMeta ────────────────────────────────────────────────────────
function SuggestionMeta({ suggestionId, user, getUserName }) {
  const { t, isRTL, language } = useLanguage();

  const { data: suggestion } = useQuery({
    queryKey: ["suggestion", suggestionId],
    queryFn: async () => {
      const res = await base44.entities.Suggestion.filter({ id: suggestionId });
      return res?.[0] ?? null;
    },
    enabled: !!suggestionId,
    staleTime: 5000,
  });

  const { data: suggestionComments = [] } = useQuery({
    queryKey: ["suggestionComments", suggestionId],
    queryFn: () =>
      base44.entities.Comment.filter({
        rootEntityType: "suggestion",
        rootEntityId: suggestionId,
      }),
    enabled: !!suggestionId,
    initialData: [],
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const [showSuggComments, setShowSuggComments] = useState(false);

  if (!suggestion) return null;

  const localGetUserName = (email) => {
    if (getUserName) return getUserName(email);
    const u = users.find((u) => u.email === email);
    return u?.full_name || email || "User";
  };

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

      <div className={`flex items-center justify-between flex-wrap gap-2 text-xs ${isRTL ? "flex-row-reverse" : ""}`}>
        <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
          <span className="text-green-700 font-semibold">
            ▲ {suggestion.proVotes || 0} {t("pro")}
          </span>
          <span className="text-red-600 font-semibold">
            ▼ {suggestion.conVotes || 0} {t("con")}
          </span>
          <Badge className="bg-green-100 text-green-800 border-green-300 text-[10px]">
            {suggestion.status === "accepted" ? t("accepted") : suggestion.status}
          </Badge>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSuggComments((v) => !v)}
          className="h-7 text-xs text-slate-500 hover:text-blue-600 px-2"
        >
          <MessageSquare className={`w-3 h-3 ${isRTL ? "ml-1" : "mr-1"}`} />
          {t("comments")} ({suggestionComments.length})
        </Button>
      </div>

      {showSuggComments && (
        <div className="pt-2 border-t border-teal-200">
          <CommentsSection entityType="suggestion" entityId={suggestionId} user={user} />
        </div>
      )}

      <div className="text-[10px] text-slate-400">
        {t("publishedBy")}{" "}
        <Link
          to={`${createPageUrl("Profile")}?userId=${users.find((u) => u.email === suggestion.created_by)?.id}`}
          className="hover:underline text-blue-500"
        >
          {localGetUserName(suggestion.created_by)}
        </Link>
        {suggestion.status === "accepted" && suggestion.updated_date && (
          <span className="text-green-600 font-medium ms-2">
            · {t("acceptedOn")} {new Date(suggestion.updated_date).toLocaleDateString(language === "he" ? "he-IL" : language === "ar" ? "ar" : "en-GB")}
          </span>
        )}
      </div>
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
  onClose, // optional callback — shows an X button to exit history mode
}) {
  const { t, isRTL, language } = useLanguage();
  const queryClient = useQueryClient();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSectionComments, setShowSectionComments] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [error, setError] = useState(null);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: section } = useQuery({
    queryKey: ["section", sectionId],
    queryFn: async () => {
      const res = await base44.entities.Section.filter({ id: sectionId });
      return res?.[0] ?? null;
    },
    enabled: !!sectionId,
    staleTime: 5000,
  });

  const { data: versions = [], isLoading: versionsLoading } = useQuery({
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

  const { data: sectionComments = [] } = useQuery({
    queryKey: ["sectionComments", sectionId],
    queryFn: () =>
      base44.entities.Comment.filter({ rootEntityType: "section", rootEntityId: sectionId }),
    enabled: !!sectionId,
    initialData: [],
  });

  // ── Version processing ────────────────────────────────────────────────────
  const sortedVersions = [...versions]
    .sort((a, b) => (b.version || 0) - (a.version || 0))
    .filter((v, i, arr) => {
      if (i === arr.length - 1) return true;
      return v.content !== arr[i + 1]?.content;
    });

  const versionGroups = sortedVersions.map((ver, i) => ({
    version: ver,
    previousVersion: sortedVersions[i + 1] ?? null,
    suggestionId: ver.suggestionId ?? null,
  })).filter((g) => g.version?.changeType);

  // ── Restore mutation ──────────────────────────────────────────────────────
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

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getChangeTypeLabel = (type) => {
    if (type === "suggestion_accepted") return t("suggestionAccepted");
    if (type === "direct_edit") return t("directEdit");
    if (type === "section_created") return t("sectionCreated");
    return type;
  };

  const getChangeTypeBadge = (type) => {
    if (type === "suggestion_accepted") return "bg-green-100 text-green-800 border-green-300";
    if (type === "section_created") return "bg-blue-100 text-blue-800 border-blue-300";
    return "bg-slate-100 text-slate-700 border-slate-300";
  };

  const getChangeTypeIcon = (type) => {
    if (type === "suggestion_accepted") return <CheckCircle2 className="w-3 h-3 text-green-600" />;
    if (type === "section_created") return <PlusCircle className="w-3 h-3 text-blue-600" />;
    return <Edit2 className="w-3 h-3 text-slate-500" />;
  };

  const localGetUserName = (email) => {
    if (getUserName) return getUserName(email);
    return email || "User";
  };

  // ── Empty / loading states ────────────────────────────────────────────────
  if (versionsLoading) {
    return (
      <div className="space-y-3 p-1">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  if (versionGroups.length === 0) {
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
      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── Nav bar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 bg-teal-100/70 border border-teal-200 rounded-lg px-3 py-2">
        <button
          onClick={() => setCurrentIndex((i) => Math.min(i + 1, versionGroups.length - 1))}
          disabled={safeIndex >= versionGroups.length - 1}
          className="flex items-center justify-center w-10 h-10 rounded-xl border-2 border-teal-300 bg-white text-teal-700 hover:bg-teal-100 hover:border-teal-500 hover:shadow-md active:scale-95 disabled:opacity-30 transition-all shadow-sm"
          aria-label={isRTL ? t("nextSuggestion") : t("previousSuggestion")}
        >
          {isRTL ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>

        <div className="text-center flex-1">
          <span className="text-xs font-semibold text-teal-800">
            {t("version")} {currentVer?.version}
          </span>
          <span className="text-xs text-teal-600 mx-2">·</span>
          <span className="text-xs text-teal-600">
            {safeIndex + 1} / {versionGroups.length}
          </span>
        </div>

        <button
          onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
          disabled={safeIndex === 0}
          className="flex items-center justify-center w-10 h-10 rounded-xl border-2 border-teal-300 bg-white text-teal-700 hover:bg-teal-100 hover:border-teal-500 hover:shadow-md active:scale-95 disabled:opacity-30 transition-all shadow-sm"
          aria-label={isRTL ? t("previousSuggestion") : t("nextSuggestion")}
        >
          {isRTL ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
      </div>

      {/* ── Dot indicators ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-1.5">
        {versionGroups.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`rounded-full transition-all duration-200 ${
              idx === safeIndex
                ? "w-5 h-2.5 bg-teal-500"
                : "w-2 h-2 bg-teal-200 hover:bg-teal-400"
            }`}
            aria-label={`${t("version")} ${versionGroups[idx]?.version?.version}`}
          />
        ))}
      </div>

      {/* ── Version card ──────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-teal-200 bg-white/80 overflow-hidden">
        {/* meta header */}
        <div className={`flex items-start justify-between gap-3 p-3 border-b border-teal-100 bg-teal-50/50 ${isRTL ? "flex-row-reverse" : ""}`}>
          <div className="flex-1 min-w-0 space-y-1">
            <div className={`flex items-center gap-2 flex-wrap ${isRTL ? "flex-row-reverse" : ""}`}>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${getChangeTypeBadge(currentVer?.changeType)}`}>
                {getChangeTypeIcon(currentVer?.changeType)}
                {getChangeTypeLabel(currentVer?.changeType)}
              </span>
              {group.suggestionId && (
                <Link to={`${createPageUrl("SuggestionDetail")}?id=${group.suggestionId}`}>
                  <Badge className="bg-emerald-600 hover:bg-emerald-700 cursor-pointer text-[10px] flex items-center gap-1">
                    <ExternalLink className="w-2.5 h-2.5" />
                    {t("viewFullDiscussion")}
                  </Badge>
                </Link>
              )}
            </div>
            {currentVer?.changeDescription && (
              <p className={`text-xs font-semibold text-slate-700 ${isRTL ? "text-right" : ""}`}>
                {typeof currentVer.changeDescription === "string"
                  ? currentVer.changeDescription
                  : currentVer.changeDescription?.title || t("changeWithoutDescription")}
              </p>
            )}
            <div className={`flex items-center gap-3 text-[10px] text-slate-400 ${isRTL ? "flex-row-reverse" : ""}`}>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(currentVer?.created_date).toLocaleString(isRTL ? "he-IL" : "en-US")}
              </span>
              {currentVer?.created_by && (
                <span>{t("by")} {localGetUserName(currentVer.created_by)}</span>
              )}
            </div>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRestoreTarget(currentVer)}
              disabled={restoreMutation.isPending}
              className="flex-shrink-0 text-xs h-7 border-teal-300 text-teal-700 hover:bg-teal-50"
            >
              <RotateCcw className={`w-3 h-3 ${isRTL ? "ml-1" : "mr-1"}`} />
              {t("restoreVersion")}
            </Button>
          )}
        </div>

        {/* diff / content */}
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

          {/* section comments */}
          <div className="mt-3 pt-3 border-t border-teal-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSectionComments((v) => !v)}
              className={`h-7 text-xs px-2 ${
                sectionComments.length > 0
                  ? "font-semibold text-blue-700 border border-blue-300 bg-blue-50 hover:bg-blue-100"
                  : "text-slate-500 hover:text-blue-600"
              }`}
            >
              <MessageSquare className={`w-3 h-3 ${isRTL ? "ml-1" : "mr-1"} ${sectionComments.length > 0 ? "fill-blue-200" : ""}`} />
              {t("comments")} ({sectionComments.length})
            </Button>
            {showSectionComments && (
              <div className="mt-2">
                <CommentsSection entityType="section" entityId={sectionId} user={user} />
              </div>
            )}
          </div>

          {/* suggestion meta */}
          {group.suggestionId && (
            <SuggestionMeta
              suggestionId={group.suggestionId}
              user={user}
              getUserName={localGetUserName}
            />
          )}
        </div>
      </div>

      {/* ── Restore confirm dialog ─────────────────────────────────────────── */}
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