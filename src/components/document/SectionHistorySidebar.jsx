import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, History, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { PAGE_NAMES } from "@/components/pageNames";


export default function SectionHistorySidebar({ sectionId, isOpen, onClose }) {
  const { t, isRTL, language } = useLanguage();

  const { data: section, isLoading: sectionLoading } = useQuery({
    queryKey: ['section', sectionId],
    queryFn: () => base44.entities.Section.filter({ id: sectionId }).then((s) => s[0]),
    enabled: !!sectionId && isOpen
  });

  const { data: document } = useQuery({
    queryKey: ['document', section?.documentId],
    queryFn: () => base44.entities.Document.filter({ id: section.documentId }).then((d) => d[0]),
    enabled: !!section?.documentId
  });

  const { data: topic } = useQuery({
    queryKey: ['topic', section?.topicId],
    queryFn: () => base44.entities.Topic.filter({ id: section.topicId }).then((t) => t[0]),
    enabled: !!section?.topicId
  });

  const { data: versions, isLoading: versionsLoading } = useQuery({
    queryKey: ['versions', sectionId, section?.documentId],
    queryFn: async () => {
      if (!section?.documentId) return [];
      const result = await base44.functions.invoke('getDocumentVersionsServiceRole', { documentId: section.documentId });
      const allVersions = result?.data?.data ?? result?.data ?? [];
      return allVersions.filter(v => v.sectionId === sectionId).sort((a, b) => (b.version || 0) - (a.version || 0));
    },
    initialData: [],
    enabled: !!sectionId && !!section?.documentId && isOpen,
    staleTime: 0
  });

  // Sort versions by version number descending, deduplicate
  const sortedVersions = [...versions]
    .sort((a, b) => b.version - a.version)
    .filter((version, index, arr) =>
      index === arr.findIndex((v) => v.version === version.version)
    )
    .filter((version, index, arr) => {
      if (index === arr.length - 1) return true;
      const nextVersion = arr[index + 1];
      return version.content !== nextVersion?.content;
    });

  // Deduplicate by suggestionId
  const seenSuggestionIds = new Set();
  const versionGroups = sortedVersions.map((version) => {
    const shouldShowSuggestion = version.suggestionId && !seenSuggestionIds.has(version.suggestionId);
    if (version.suggestionId) seenSuggestionIds.add(version.suggestionId);
    return {
      version,
      suggestionId: shouldShowSuggestion ? version.suggestionId : null,
    };
  });

  const changeTypeLabel = (changeType) => {
    if (changeType === 'suggestion_accepted') return t('suggestionAccepted');
    if (changeType === 'section_created') return t('sectionCreated');
    return t('directEdit');
  };

  return (
    <AnimatePresence>
      {isOpen && <>
        {/* Overlay */}
        <motion.div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        />

        {/* Sidebar */}
        <motion.div
          className={`fixed inset-y-0 ${isRTL ? 'right-0' : 'left-0'} w-full max-w-sm bg-white shadow-2xl z-50 overflow-y-auto`}
          initial={{ x: isRTL ? '100%' : '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: isRTL ? '100%' : '-100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900">{t('sectionHistory')}</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="p-4 space-y-2">
            {/* Breadcrumb */}
            {document && topic && (
              <p className={`text-sm text-slate-500 mb-4 ${isRTL ? 'text-right' : ''}`}>
                <Link to={`${createPageUrl("DocumentView")}?id=${document.id}`} className="hover:underline">
                  {document.title}
                </Link>
                {' > '}{topic.title}
              </p>
            )}

            {sectionLoading || versionsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : !section ? (
              <div className="text-center py-12">
                <p className="text-slate-500">{t('sectionNotFound')}</p>
              </div>
            ) : versionGroups.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">{t('noPreviousVersions')}</p>
                <p className="text-xs text-slate-400 mt-2">{t('sectionChangesAutomaticallySaved')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {versionGroups.filter(g => g.version?.changeType).map((group, idx) => {
                  const ver = group.version;
                  const date = ver.updated_date || ver.created_date;
                  const row = (
                    <div
                      key={idx}
                      className={`flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors ${group.suggestionId ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (group.suggestionId) {
                          window.location.href = `${createPageUrl(PAGE_NAMES.SUGGESTION_DETAIL)}?id=${group.suggestionId}`;
                        }
                      }}
                    >
                      <div className={`flex flex-col gap-1 ${isRTL ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-700">
                            {t('version')} {ver.version}
                          </span>
                          <Badge variant="outline" className="text-xs py-0">
                            {changeTypeLabel(ver.changeType)}
                          </Badge>
                        </div>
                        {date && (
                          <span className="text-xs text-slate-400">
                            {new Date(date).toLocaleDateString(language === 'he' ? 'he-IL' : language === 'ar' ? 'ar' : 'en-GB', {
                              day: 'numeric', month: 'short', year: 'numeric'
                            })}
                          </span>
                        )}
                      </div>
                      {group.suggestionId && (
                        <ChevronRight className={`w-4 h-4 text-slate-400 flex-shrink-0 ${isRTL ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  );
                  return row;
                })}
              </div>
            )}
          </div>
        </motion.div>
      </>}
    </AnimatePresence>
  );
}