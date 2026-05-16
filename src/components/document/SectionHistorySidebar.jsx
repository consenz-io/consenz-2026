import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, History, ChevronRight, CheckCircle2, Edit2, PlusCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { PAGE_NAMES } from "@/components/pageNames";
import SuggestionSidebar from "@/components/document/SuggestionSidebar";


export default function SectionHistorySidebar({ sectionId, isOpen, onClose, document: parentDocument, user }) {
  const { t, isRTL, language } = useLanguage();
  const [activeSuggestionId, setActiveSuggestionId] = React.useState(null);

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

  const changeTypeIcon = (changeType) => {
    if (changeType === 'suggestion_accepted') return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
    if (changeType === 'section_created') return <PlusCircle className="w-3.5 h-3.5 text-blue-500" />;
    return <Edit2 className="w-3.5 h-3.5 text-slate-400" />;
  };

  const changeTypeBadgeClass = (changeType) => {
    if (changeType === 'suggestion_accepted') return 'bg-green-50 text-green-700 border-green-200';
    if (changeType === 'section_created') return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-slate-50 text-slate-600 border-slate-200';
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
          className={`fixed inset-y-0 ${isRTL ? 'right-0' : 'left-0'} w-full max-w-sm bg-gradient-to-b from-slate-50 to-white shadow-2xl z-50 overflow-y-auto flex flex-col`}
          initial={{ x: isRTL ? '100%' : '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: isRTL ? '100%' : '-100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white/90 backdrop-blur-sm border-b border-slate-200 px-5 py-4 flex items-center justify-between z-10 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                <History className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 leading-tight">{t('sectionHistory')}</h2>
                {document && topic && (
                  <p className={`text-xs text-slate-400 ${isRTL ? 'text-right' : ''}`}>
                    <Link to={`${createPageUrl("DocumentView")}?id=${document.id}`} className="hover:text-blue-600 transition-colors">
                      {document.title}
                    </Link>
                    <span className="mx-1">›</span>
                    <span>{topic.title}</span>
                  </p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="p-4 space-y-2 flex-1">
            {sectionLoading || versionsLoading ? (
              <div className="space-y-3 pt-2">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            ) : !section ? (
              <div className="text-center py-16">
                <p className="text-slate-500 text-sm">{t('sectionNotFound')}</p>
              </div>
            ) : versionGroups.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <History className="w-7 h-7 text-slate-300" />
                </div>
                <p className="text-slate-600 font-medium text-sm">{t('noPreviousVersions')}</p>
                <p className="text-xs text-slate-400 mt-2">{t('sectionChangesAutomaticallySaved')}</p>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                {versionGroups.filter(g => g.version?.changeType).map((group, idx) => {
                  const ver = group.version;
                  const date = ver.updated_date || ver.created_date;
                  return (
                    <div
                      key={idx}
                      className={`group relative rounded-xl border bg-white transition-all duration-200 overflow-hidden
                        ${group.suggestionId
                          ? 'cursor-pointer border-slate-200 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5'
                          : 'border-slate-100'
                        }`}
                    >
                      {/* Colored accent bar */}
                      <div className={`absolute inset-y-0 right-0 w-1 rounded-full
                        ${ver.changeType === 'suggestion_accepted' ? 'bg-green-400' :
                          ver.changeType === 'section_created' ? 'bg-blue-400' : 'bg-slate-300'}`}
                      />

                      <div className="px-4 pl-5 py-3" dir="rtl">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                            {/* Badge + version */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${changeTypeBadgeClass(ver.changeType)}`}>
                                {changeTypeIcon(ver.changeType)}
                                {changeTypeLabel(ver.changeType)}
                              </span>
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                v{ver.version}
                              </span>
                            </div>

                            {/* Content preview */}
                            {ver.content && (
                              <p
                                className="text-sm text-slate-600 line-clamp-2 leading-relaxed text-right"
                                dir="rtl"
                                style={{ fontFamily: "'Times New Roman', 'David Libre', serif" }}
                              >
                                {ver.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}
                              </p>
                            )}

                            {/* Date */}
                            {date && (
                              <span className="text-xs text-slate-400">
                                {new Date(date).toLocaleDateString(
                                  language === 'he' ? 'he-IL' : language === 'ar' ? 'ar' : 'en-GB',
                                  { day: 'numeric', month: 'short', year: 'numeric' }
                                )}
                              </span>
                            )}
                          </div>

                          {group.suggestionId && (
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 flex-shrink-0 mt-1 transition-colors" />
                          )}
                        </div>
                      </div>

                      {/* Clickable overlay */}
                      {group.suggestionId && (
                        <button
                          className="absolute inset-0 w-full h-full"
                          onClick={() => setActiveSuggestionId(group.suggestionId)}
                          aria-label="פתח פרטי הצעה"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* Suggestion sidebar — opens on top when a version card is clicked */}
        {activeSuggestionId && (
          <SuggestionSidebar
            suggestionId={activeSuggestionId}
            onClose={() => setActiveSuggestionId(null)}
            document={parentDocument}
            user={user}
          />
        )}
      </>}
    </AnimatePresence>
  );
}