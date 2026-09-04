import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Handshake, Download, FileCheck2, Users, Gauge } from "lucide-react";
import { createPageUrl } from "@/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription } from
"@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { parseUserDate } from "@/components/utils/dateFormatter";

const SERIF = "var(--font-document)";

function formatDate(dateStr, language) {
  if (!dateStr) return "";
  return parseUserDate(dateStr).toLocaleString(
    language === "he" ? "he-IL" : language === "ar" ? "ar-SA" : "en-GB",
    { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }
  );
}

/**
 * Modal showing the most up-to-date, clean version of the document — the
 * tangible product of the consensus process. Festive/formal look (ribbon,
 * stamp badge, serif) to convey "this is the current agreement". A subtle
 * confetti burst on open celebrates the fact that there is a product.
 *
 * Content is intentionally clean: topics + sections only, no diff tags,
 * voting buttons, or change markers.
 */
export default function CurrentVersionModal({
  open,
  onClose,
  document,
  topics,
  sections,
  language,
  isRTL,
  lastVersionDate,
  documentId,
  participantsCount = 0,
  suggestionsCount = 0,
  votesCount = 0,
  consensusPct = '0'
}) {
  const sortedTopics = useMemo(
    () => [...topics].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [topics]
  );

  const sectionsByTopic = useMemo(() => {
    const map = new Map();
    for (const s of sections) {
      if (!map.has(s.topicId)) map.set(s.topicId, []);
      map.get(s.topicId).push(s);
    }
    map.forEach((arr) => arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    return map;
  }, [sections]);

  const title =
  language === "he" ?
  "הגרסה הנוכחית של המסמך" :
  language === "ar" ?
  "النسخة الحالية من الوثيقة" :
  "Current Version of the Document";

  const subtitle =
  language === "he" ?
  "זוהי הגרסה המעודכנת ביותר, המשקפת את ההסכמות שהתקבלו בקהילה עד כה. המסמך ממשיך להתעדכן ככל שמתקבלות הסכמות חדשות." :
  language === "ar" ?
  "هذه أحدث نسخة، تعكس التوافق الذي تم التوصل إليه في المجتمع حتى الآن. تستمر الوثيقة في التحديث مع كل توافق جديد." :
  "This is the most up-to-date version, reflecting the consensus reached by the community so far. The document continues to evolve as new consensus is reached.";

  const asOf = language === "he" ? "נכון ל-" : language === "ar" ? "حتى " : "As of ";

  const versionCreatedByLabel =
  language === "he" ?
  ` ${participantsCount} משתתפים · ${suggestionsCount} עריכות · ${votesCount} הצבעות` :
  language === "ar" ?
  `أنشأها ${participantsCount} مشارك · ${suggestionsCount} تعديل · ${votesCount} تصويت` :
  `Created by ${participantsCount} participants · ${suggestionsCount} edits · ${votesCount} votes`;
  const consensusLabel =
  language === "he" ?
  "רמת הסכמה" :
  language === "ar" ?
  "مستوى الاتفاق" :
  "Agreement level";
  const consensusTooltip =
  language === "he" ?
  "מד הקונצנזוס משקף את רמת ההסכמה על גרסת המסמך הנוכחית. לחץ להסבר מפורט." :
  language === "ar" ?
  "مقياس الإجماع يعكس مستوى الاتفاق على النسخة الحالية. انقر لشرح مفصل." :
  "The consensus meter reflects the level of agreement on the current document version. Click for details.";
  const downloadLabel = language === "he" ? "הורדה / הדפסה" : language === "ar" ? "تنزيل / طباعة" : "Download / Print";
  const closeLabel = language === "he" ? "סגירה" : language === "ar" ? "إغلاق" : "Close";
  const fullHistoryLabel =
  language === "he" ?
  "צפו בגרסה המלאה עם היסטוריית שינויים ←" :
  language === "ar" ?
  "اعرض النسخة الكاملة مع سجل التغييرات ←" :
  "View full version with change history ←";
  const emptyDoc =
  language === "he" ?
  "עדיין אין תוכן במסמך. ההסכמות שיתקבלו יופיעו כאן." :
  language === "ar" ?
  "لا يوجد محتوى بعد. التوافق الذي يتم التوصل إليه سيظهر هنا." :
  "No content yet. Accepted consensus will appear here.";

  const dateStr = formatDate(lastVersionDate, language);

  const handleDownload = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    // Escape user-controlled text before injecting into document.write() —
    // prevents DOM-XSS via malicious document/topic titles.
    const escapeHtml = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
    const docTitle = escapeHtml(document?.title || "");
    const dir = isRTL ? "rtl" : "ltr";
    const topicRows = sortedTopics.
    map((topic, ti) => {
      const topicSections = sectionsByTopic.get(topic.id) || [];
      if (topicSections.length === 0) return "";
      const sectionsHtml = topicSections.
      map(
        (section, si) =>
        `<div style="margin-bottom:1.5rem"><span style="color:#64748b;font-weight:500;margin-inline-end:0.5rem">${ti + 1}.${si + 1}</span><span style="font-size:1.1rem;line-height:1.8">${section.content || ""}</span></div>`
      ).
      join("");
      return `<div style="margin-bottom:2.5rem"><h2 style="font-size:1.4rem;font-weight:bold;border-bottom:1px solid #cbd5e1;padding-bottom:0.5rem;margin-bottom:1rem">${ti + 1}. ${escapeHtml(topic.title || "")}</h2>${sectionsHtml}</div>`;
    }).
    join("");

    printWindow.document.write(
      `<!DOCTYPE html><html dir="${dir}" lang="${language}"><head><meta charset="UTF-8"><title>${docTitle}</title><style>body{font-family:'Noto Serif Hebrew','David Libre','Alegreya','Noto Serif',Georgia,serif;max-width:800px;margin:2cm auto;padding:1rem;color:#1e293b}h1{font-size:2rem;margin-bottom:2rem}@page{margin:2cm}@media print{body{margin:0}}</style></head><body><h1>${docTitle}</h1>${topicRows}<footer style="margin-top:3rem;padding-top:1rem;border-top:1px solid #cbd5e1;text-align:center;color:#94a3b8;font-size:0.8rem">${asOf}${dateStr}</footer><script>window.onload=function(){window.print()}<\/script></body></html>`
    );
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {if (!o) onClose();}}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Decorative top accent — refined, formal */}
        <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600" />

        {/* Header — consensus emblem, right-aligned editorial layout */}
        <DialogHeader className="px-6 pt-5 pb-5 space-y-3 border-b border-slate-100 bg-gradient-to-b from-blue-50/40 to-white">
          <div className="flex items-start gap-3" dir={isRTL ? "rtl" : "ltr"}>
            

            
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <DialogTitle className={`font-medium text-slate-800 leading-snug text-base ${isRTL ? "text-right" : "text-left"}`}>
                {title}
              </DialogTitle>
              <DialogDescription className="text-slate-500 leading-relaxed text-justify text-xs">
                {subtitle}
              </DialogDescription>
            </div>
          </div>
          {dateStr &&
          <div className="flex flex-wrap items-center justify-end gap-2" dir={isRTL ? "rtl" : "ltr"}>
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-100/60 px-3 py-1 rounded-full hidden">
                <FileCheck2 className="w-3.5 h-3.5" />
                {asOf}
                {dateStr}
              </div>
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-100/60 px-3 py-1 rounded-full">
                <Users className="w-3.5 h-3.5" />
                {versionCreatedByLabel}
              </div>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                    to={`${createPageUrl("UnderstandingConsensus")}?id=${documentId}`}
                    onClick={() => onClose()}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-100/60 hover:bg-indigo-200/70 px-3 py-1 rounded-full transition-colors cursor-pointer">
                    
                      <Gauge className="w-3.5 h-3.5" />
                      {consensusLabel}: {consensusPct}%
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side={isRTL ? "left" : "right"} className="max-w-[240px] text-center">
                    {consensusTooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          }
        </DialogHeader>

        {/* Body — the document presented as the product of consensus */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8 bg-gradient-to-b from-slate-50 to-slate-100/70" dir={isRTL ? "rtl" : "ltr"}>
          {/* Formal "agreement paper" — frame + shadow lift it as the focal artifact */}
          <div className="relative mx-auto max-w-2xl bg-white rounded-lg shadow-xl shadow-slate-400/15 border border-slate-200">
            {/* Ornamental inner frame — certificate feel */}
            <div className="pointer-events-none absolute inset-3 sm:inset-4 rounded-md border border-slate-200/80" />
            <div className="relative z-10 px-8 sm:px-12 py-10">
              {/* Consensus emblem */}
              <div className="flex justify-center mb-5">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-300/40 ring-1 ring-blue-100">
                  <Handshake className="w-5 h-5 text-white" />
                </div>
              </div>
              <h2 className="text-2xl text-slate-900 mb-3 text-center font-display font-normal" style={{ fontFamily: "var(--font-display)" }}>
                {document?.title}
              </h2>
              <div className="flex items-center justify-center gap-2 mb-8">
                <span className="h-px w-10 bg-slate-300" />
                <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400 font-medium">
                  {language === "he" ? "מסמך ההסכמות" : language === "ar" ? "وثيقة التوافق" : "Consensus Document"}
                </span>
                <span className="h-px w-10 bg-slate-300" />
              </div>
              {sortedTopics.length === 0 ?
              <p className="text-center text-slate-500 italic py-12">{emptyDoc}</p> :

              <div className="space-y-8">
              {sortedTopics.map((topic, ti) => {
                  const topicSections = sectionsByTopic.get(topic.id) || [];
                  if (topicSections.length === 0) return null;
                  return (
                    <div key={topic.id} className="space-y-3">
                    <h3
                        className="text-xl text-slate-800 border-b border-slate-200 pb-2 font-display font-normal"
                        style={{ fontFamily: "var(--font-display)" }}>
                    
                      {ti + 1}. {topic.title}
                    </h3>
                    <div className="space-y-4">
                      {topicSections.map((section, si) =>
                        <div key={section.id} className="flex gap-3">
                          <span className="text-slate-400 font-medium min-w-[1.75rem] text-sm pt-1">
                            {ti + 1}.{si + 1}
                          </span>
                          <div
                            className="flex-1 text-slate-700 leading-relaxed prose prose-sm max-w-none"
                            style={{ fontFamily: SERIF, fontSize: "1.125rem", lineHeight: "1.8" }}
                            dangerouslySetInnerHTML={{ __html: section.content || "" }} />
                      
                        </div>
                        )}
                    </div>
                  </div>);

                })}
            </div>
              }
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Link
            to={`${createPageUrl("DocumentCleanView")}?id=${documentId}`}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium text-center">
            
            {fullHistoryLabel}
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
              {downloadLabel}
            </Button>
            <Button size="sm" onClick={onClose} className="bg-blue-600 hover:bg-blue-700">
              {closeLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>);

}