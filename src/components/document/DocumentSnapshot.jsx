import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Loader2, Eye, EyeOff } from "lucide-react";
import InlineDiff from "./InlineDiff";
import { useLanguage } from "@/components/LanguageContext";

const detectLanguage = (text) => {
  if (!text) return 'en';
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  const cleanText = text.replace(/<[^>]*>/g, '');
  if (hebrewPattern.test(cleanText)) return 'he';
  if (arabicPattern.test(cleanText)) return 'ar';
  return 'en';
};

export default function DocumentSnapshot({
  topic,
  topicIndex,
  sections,
  currentSnapshot,
  olderSnapshot,
  isViewingHistory,
  showTranslatedSections,
  translatedSections,
  showDiffForSections,
  onToggleDiff,
  onOpenSectionHistory,
  onOpenSuggestion,
  translateSectionMutation,
  onToggleTranslation,
  documentId
}) {
  const { t, isRTL, language } = useLanguage();

  return (
    <div className="space-y-4 md:space-y-6 break-inside-avoid">
      <div className="border-b border-slate-300 pb-2 mb-4 md:mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight">
          {topicIndex + 1}. {topic.title}
        </h2>
      </div>

      {sections.length === 0 ? (
        <p className="text-slate-500 italic pr-2 md:pr-4">{t('noSectionsYet')}</p>
      ) : (
        <div className="space-y-4 md:space-y-6">
          {sections.map((section, sectionIndex) => {
            const displayedContent = currentSnapshot?.sectionContents?.[section.id] || section.content;
            const olderContent = olderSnapshot?.sectionContents?.[section.id];
            
            const isNewlyCreatedSection = isViewingHistory && 
              currentSnapshot?.isNewSection && 
              currentSnapshot?.newSectionId === section.id;
            
            const isDeletedSection = isViewingHistory &&
              currentSnapshot?.isDeleted &&
              currentSnapshot?.deletedSectionId === section.id;

            const hasChanged = isViewingHistory && 
              !isDeletedSection &&
              currentSnapshot?.changedSectionId === section.id && 
              currentSnapshot?.newContent && 
              currentSnapshot?.newContent !== '' &&
              displayedContent !== currentSnapshot?.newContent;

            return (
              <div key={section.id} id={`section-${section.id}`} className="break-inside-avoid transition-all">
                <div className="flex gap-2 md:gap-4 group p-2 rounded-lg transition-colors">
                  {!isDeletedSection && (
                    <span className="text-slate-500 font-medium min-w-[1.5rem] md:min-w-[2rem] text-sm md:text-base">
                      {topicIndex + 1}.{sectionIndex + 1}
                    </span>
                  )}
                  <div className="flex-1">
                    {isDeletedSection ? (
                      <div 
                        id={`change-${section.id}`} 
                        className="border-l-4 border-red-500 pl-3 py-2 bg-red-50 rounded cursor-pointer hover:bg-red-100 transition-colors"
                        onClick={() => currentSnapshot?.suggestionId && onOpenSuggestion(currentSnapshot.suggestionId)}
                      >
                        <Badge className="mb-2 bg-red-100 text-red-800 text-xs">
                          {language === 'he' ? 'סעיף נמחק - לחץ לצפייה בדיון' : 'Section Deleted'}
                        </Badge>
                        <div 
                          className="prose prose-sm max-w-none text-slate-700 line-through opacity-60"
                          style={{ 
                            fontFamily: "'Times New Roman', 'David Libre', 'Noto Serif', Georgia, serif",
                            fontSize: "1.125rem",
                            lineHeight: "1.8"
                          }}
                          dangerouslySetInnerHTML={{ __html: currentSnapshot?.deletedSectionContent || displayedContent }}
                        />
                      </div>
                    ) : isViewingHistory && isNewlyCreatedSection ? (
                      <div 
                        id={`change-${section.id}`} 
                        className="bg-green-50 border-l-4 border-green-500 p-3 rounded cursor-pointer hover:bg-green-100 transition-colors"
                        onClick={() => currentSnapshot?.suggestionId && onOpenSuggestion(currentSnapshot.suggestionId)}
                      >
                        <Badge className="mb-2 bg-green-100 text-green-800 text-xs">
                          {language === 'he' ? 'סעיף חדש - לחץ לצפייה בדיון' : 'New Section'}
                        </Badge>
                        <div 
                          className="prose prose-sm max-w-none text-green-800"
                          style={{ 
                            fontFamily: "'Times New Roman', 'David Libre', 'Noto Serif', Georgia, serif",
                            fontSize: "1.125rem",
                            lineHeight: "1.8"
                          }}
                          dangerouslySetInnerHTML={{ __html: currentSnapshot?.newSectionContent || displayedContent }}
                        />
                      </div>
                    ) : isViewingHistory && hasChanged ? (
                      <div 
                        id={`change-${section.id}`} 
                        className="border-l-4 border-amber-400 pl-3 py-2 bg-amber-50/50 rounded cursor-pointer hover:bg-amber-100 transition-colors"
                        onClick={() => currentSnapshot?.suggestionId && onOpenSuggestion(currentSnapshot.suggestionId)}
                      >
                        <Badge className="mb-2 bg-amber-100 text-amber-800 text-xs">
                          {language === 'he' ? 'שינוי - לחץ לצפייה בדיון' : 'Change'}
                        </Badge>
                        <InlineDiff
                          originalContent={displayedContent}
                          newContent={currentSnapshot?.newContent}
                        />
                      </div>
                    ) : (
                      <>
                        {isViewingHistory && olderContent && olderContent !== displayedContent ? (
                          <div 
                            id={`change-${section.id}`} 
                            className="border-l-4 border-blue-400 pl-3 py-2 bg-blue-50/30 rounded cursor-pointer hover:bg-blue-100 transition-colors"
                            onClick={() => currentSnapshot?.suggestionId && onOpenSuggestion(currentSnapshot.suggestionId)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <Badge className="bg-blue-100 text-blue-800 text-xs">
                                {language === 'he' ? 'השוואה - לחץ לצפייה בדיון' : 'Comparison'}
                              </Badge>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleDiff(section.id);
                                  }}
                                  className="h-7 px-2 text-xs"
                                >
                                  {showDiffForSections[section.id] ? (
                                    <>
                                      <EyeOff className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                                      {t('hideChanges')}
                                    </>
                                  ) : (
                                    <>
                                      <Eye className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                                      {t('showDiff')}
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenSectionHistory(section.id);
                                  }}
                                  className="h-7 px-2 text-xs"
                                >
                                  {language === 'he' ? 'היסטוריית סעיף' : 'Section History'}
                                </Button>
                              </div>
                            </div>
                            {showDiffForSections[section.id] ? (
                              <InlineDiff
                                originalContent={olderContent}
                                newContent={displayedContent}
                              />
                            ) : (
                              <div
                                className="prose prose-sm max-w-none text-slate-700"
                                style={{ 
                                  direction: isRTL ? 'rtl' : 'ltr', 
                                  textAlign: isRTL ? 'right' : 'left',
                                  fontFamily: "'Times New Roman', 'David Libre', 'Noto Serif', Georgia, serif",
                                  fontSize: "1.125rem",
                                  lineHeight: "1.8",
                                  letterSpacing: "0.01em"
                                }}
                                dangerouslySetInnerHTML={{ __html: displayedContent }}
                              />
                            )}
                          </div>
                        ) : (
                          <div 
                            className="text-slate-700 leading-relaxed prose prose-sm md:prose prose-slate max-w-none"
                            style={{ 
                              fontFamily: "'Times New Roman', 'David Libre', 'Noto Serif', Georgia, serif",
                              fontSize: "1.125rem",
                              lineHeight: "1.8",
                              letterSpacing: "0.01em"
                            }}
                            dangerouslySetInnerHTML={{ 
                              __html: showTranslatedSections[section.id] 
                                ? (translatedSections[section.id] || section.translations?.[language] || displayedContent)
                                : displayedContent 
                            }}
                          />
                        )}
                        {(section.originalLanguage || detectLanguage(section.content)) !== language && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 text-blue-600 hover:text-blue-700 print:hidden opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onToggleTranslation(section);
                            }}
                            disabled={translateSectionMutation.isPending}
                          >
                            {translateSectionMutation.isPending ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                {t('translating')}
                              </>
                            ) : (
                              <>
                                <Globe className="w-3 h-3 mr-1" />
                                {showTranslatedSections[section.id] ? t('showOriginal') : t('translateSection')}
                              </>
                            )}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}