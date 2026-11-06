import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X, Loader2, Languages, ExternalLink } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { toast } from "sonner";
import moment from "moment";

const LANGUAGE_LABELS = { en: "English", he: "עברית", ar: "العربية" };

const labels = {
  he: {
    title: "הצעות תרגום",
    subtitle: "הצעות תרגום שהוגשו על ידי המשתמשים, לאישור או דחייה",
    pending: "ממתינות",
    approved: "אושרו",
    rejected: "נדחו",
    platform: "טקסט ממשק",
    content: "תוכן משתמש",
    current: "הנוסח הנוכחי",
    proposed: "הנוסח המוצע",
    note: "הסבר",
    submittedBy: "הוגש על ידי",
    approve: "אישור",
    reject: "דחייה",
    approveToasts: "ההצעה אושרה והתרגום עודכן",
    rejectToasts: "ההצעה נדחתה",
    failToast: "הפעולה נכשלה. נסו שוב.",
    empty: "אין הצעות בסטטוס זה",
    loading: "טוען הצעות...",
    openDocument: "פתיחת המסמך",
    deny: "אין לך הרשאת גישה לדף זה",
    reviewedBy: "נסקר על ידי",
  },
  ar: {
    title: "اقتراحات الترجمة",
    subtitle: "اقتراحات الترجمة المقدمة من المستخدمين للموافقة أو الرفض",
    pending: "معلقة",
    approved: "مقبولة",
    rejected: "مرفوضة",
    platform: "نص الواجهة",
    content: "محتوى المستخدم",
    current: "الصياغة الحالية",
    proposed: "الصياغة المقترحة",
    note: "شرح",
    submittedBy: "قدّمه",
    approve: "موافقة",
    reject: "رفض",
    approveToasts: "تمت الموافقة وتحديث الترجمة",
    rejectToasts: "تم رفض الاقتراح",
    failToast: "فشلت العملية. حاول مرة أخرى.",
    empty: "لا توجد اقتراحات بهذه الحالة",
    loading: "جارٍ تحميل الاقتراحات...",
    openDocument: "فتح المستند",
    deny: "ليس لديك صلاحية للوصول إلى هذه الصفحة",
    reviewedBy: "راجعه",
  },
  en: {
    title: "Translation suggestions",
    subtitle: "Translation fixes submitted by users, waiting for approval or rejection",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    platform: "Interface text",
    content: "User content",
    current: "Current wording",
    proposed: "Proposed wording",
    note: "Explanation",
    submittedBy: "Submitted by",
    approve: "Approve",
    reject: "Reject",
    approveToasts: "Suggestion approved and translation updated",
    rejectToasts: "Suggestion rejected",
    failToast: "The action failed. Please try again.",
    empty: "No suggestions with this status",
    loading: "Loading suggestions...",
    openDocument: "Open document",
    deny: "You do not have access to this page",
    reviewedBy: "Reviewed by",
  },
};

export default function TranslationReview() {
  const { language } = useLanguage();
  const text = labels[language] || labels.en;
  const isRTL = language === "he" || language === "ar";
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("pending");

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["translationSuggestions", status],
    queryFn: async () => {
      const res = await base44.entities.TranslationSuggestion.filter(
        { status },
        { sort: "-created_date", limit: 100 }
      );
      return Array.isArray(res) ? res : res?.items || [];
    },
    enabled: user?.role === "admin",
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, action }) =>
      base44.functions.invoke("reviewTranslationSuggestion", { id, action }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["translationSuggestions"] });
      queryClient.invalidateQueries({ queryKey: ["versionTranslation"] });
      queryClient.invalidateQueries({ queryKey: ["translationOverride"] });
      toast.success(variables.action === "approve" ? text.approveToasts : text.rejectToasts);
    },
    onError: () => toast.error(text.failToast),
  });

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <Skeleton className="h-12 w-64 rounded-lg mb-6" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="p-8 text-center text-slate-600" dir={isRTL ? "rtl" : "ltr"}>
        {text.deny}
      </div>
    );
  }

  const statusTabs = [
    { value: "pending", label: text.pending },
    { value: "approved", label: text.approved },
    { value: "rejected", label: text.rejected },
  ];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-start gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
          <Languages className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{text.title}</h1>
          <p className="text-sm text-slate-600">{text.subtitle}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              status === tab.value
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : suggestions.length === 0 ? (
        <div className="text-center text-slate-500 py-16 bg-white rounded-xl border border-slate-200">
          {text.empty}
        </div>
      ) : (
        <div className="space-y-4">
          {suggestions.map((item) => {
            const isPendingThis =
              reviewMutation.isPending && reviewMutation.variables?.id === item.id;
            return (
              <Card key={item.id} className="border-slate-200 shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      {item.scope === "platform" ? text.platform : text.content}
                    </Badge>
                    <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                      {LANGUAGE_LABELS[item.targetLanguage] || item.targetLanguage}
                    </Badge>
                    {item.sourceEntityType && item.scope === "content" && (
                      <span className="text-xs text-slate-500">{item.sourceEntityType}</span>
                    )}
                    <span className="text-xs text-slate-400 ms-auto">
                      {moment(item.created_date).format("DD/MM/YYYY HH:mm")}
                    </span>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                      {text.current}
                    </p>
                    <p
                      className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-wrap line-through decoration-slate-300"
                      dir={item.targetLanguage === "en" ? "ltr" : "rtl"}
                    >
                      {item.currentText}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide mb-1">
                      {text.proposed}
                    </p>
                    <p
                      className="text-sm text-slate-900 bg-emerald-50 border border-emerald-200 rounded-lg p-3 whitespace-pre-wrap"
                      dir={item.targetLanguage === "en" ? "ltr" : "rtl"}
                    >
                      {item.proposedText}
                    </p>
                  </div>

                  {item.note && (
                    <p className="text-sm text-slate-600">
                      <span className="font-medium">{text.note}: </span>
                      {item.note}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                    <span>
                      {text.submittedBy}: {item.userName || item.created_by || "—"}
                    </span>
                    {item.status !== "pending" &&
                      item.reviewedByEmail &&
                      (user?.role === "admin" || item.created_by_id === user?.id) && (
                      <span>
                        {text.reviewedBy}: {item.reviewedByEmail}
                      </span>
                    )}
                    {item.scope === "content" && item.documentId && (
                      <Link
                        to={`/DocumentView?id=${item.documentId}`}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {text.openDocument}
                      </Link>
                    )}
                  </div>

                  {item.status === "pending" && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => reviewMutation.mutate({ id: item.id, action: "approve" })}
                        disabled={isPendingThis}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {isPendingThis ? (
                          <Loader2 className="w-4 h-4 animate-spin me-2" />
                        ) : (
                          <Check className="w-4 h-4 me-2" />
                        )}
                        {text.approve}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => reviewMutation.mutate({ id: item.id, action: "reject" })}
                        disabled={isPendingThis}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <X className="w-4 h-4 me-2" />
                        {text.reject}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}