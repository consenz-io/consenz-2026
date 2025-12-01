import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Clock, ExternalLink, MessageSquare } from "lucide-react";
import SectionDiff from "./SectionDiff";
import { useLanguage } from "@/components/LanguageContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function DocumentVersionHistory({
  sectionId,
  sectionName,
  versions,
  isAdmin,
  getUserName,
  getChangeTypeLabel,
  documentId,
  userId,
  setError,
}) {
  const { t, isRTL } = useLanguage();
  const queryClient = useQueryClient();

  const sortedVersions = [...versions].sort((a, b) => b.version - a.version);

  const restoreVersionMutation = useMutation({
    mutationFn: async (versionToRestore) => {
      if (!isAdmin) throw new Error(t("adminAccessRequired"));

      const allSectionVersions = await base44.entities.DocumentVersion.filter({ sectionId });
      const nextVersion = allSectionVersions.length > 0 ? Math.max(...allSectionVersions.map(v => v.version)) + 1 : 1;

      const section = await base44.entities.Section.filter({ id: sectionId }).then(s => s[0]);
      
      await base44.entities.DocumentVersion.create({
        documentId,
        sectionId,
        content: section.content,
        changeDescription: t("restoredFromVersion").replace('{version}', versionToRestore.version),
        version: nextVersion,
        changeType: 'direct_edit'
      });

      await base44.entities.Section.update(sectionId, {
        content: versionToRestore.content,
        lastEditedBy: userId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections', documentId] });
      queryClient.invalidateQueries({ queryKey: ['versions', documentId] });
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  });

  if (sortedVersions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <h2 className={`text-xl font-bold text-slate-900 ${isRTL ? 'text-right' : 'text-left'}`}>{sectionName}</h2>
        <Link to={`${createPageUrl("DocumentView")}?id=${documentId}&scrollTo=${sectionId}`}>
          <Button variant="ghost" size="sm">
            <ExternalLink className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {t('viewInDocument')}
          </Button>
        </Link>
      </div>
      {sortedVersions.map((version, index) => {
        const previousVersion = sortedVersions[index + 1];
        return (
          <Card key={version.id} className="bg-white border-slate-200 hover:shadow-lg transition-all">
              <CardHeader>
              <div className={`flex justify-between items-start gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className="flex-1">
                  <div className={`flex items-center gap-2 mb-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <Badge variant="outline">{t('version')} {version.version}</Badge>
                    <Badge className="bg-blue-100 text-blue-800">
                      {getChangeTypeLabel(version.changeType)}
                    </Badge>
                    {version.suggestionId && (
                      <Link to={`${createPageUrl("SuggestionDetail")}?id=${version.suggestionId}`}>
                        <Badge className="bg-green-600 hover:bg-green-700 cursor-pointer flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          צפה בדיון
                        </Badge>
                      </Link>
                    )}
                  </div>
                  <CardTitle className={`text-lg ${isRTL ? 'text-right' : 'text-left'}`}>
                    {typeof version.changeDescription === 'string' 
                      ? version.changeDescription 
                      : (version.changeDescription?.title || t('changeWithoutDescription'))}
                  </CardTitle>
                  <div className={`flex items-center gap-4 mt-2 text-sm text-slate-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <Clock className="w-4 h-4" />
                      {new Date(version.created_date).toLocaleString(isRTL ? 'he-IL' : 'en-US')}
                    </div>
                    <span>{t('by')} {getUserName(version.created_by)}</span>
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (confirm(t('confirmRestoreVersion'))) {
                        restoreVersionMutation.mutate(version);
                      }
                    }}
                    disabled={restoreVersionMutation.isPending}
                  >
                    <RotateCcw className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('restoreVersion')}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {previousVersion ? (
                <SectionDiff
                  key={`${version.id}-${previousVersion.id}`}
                  originalContent={previousVersion.content}
                  newContent={version.content}
                  documentId={documentId}
                  sectionId={sectionId}
                />
              ) : (
                <div
                  className="prose prose-sm max-w-none text-slate-700 p-4 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 hover:shadow-md transition-all"
                  style={{ direction: isRTL ? 'rtl' : 'ltr', textAlign: isRTL ? 'right' : 'left' }}
                  dangerouslySetInnerHTML={{ __html: version.content }}
                  onClick={() => {
                    window.location.href = `${createPageUrl("DocumentView")}?id=${documentId}#section-${sectionId}`;
                  }}
                />
              )}
            </CardContent>
            </Card>
        );
      })}
    </div>
  );
}