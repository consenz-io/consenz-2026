import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, History, MessageSquare, Languages, Loader2, GitCompare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";
import CommentsSection from "./CommentsSection";
import TranslatableContent from "./TranslatableContent";

// Inline diff view component
function InlineDiffView({ originalContent, newContent, isRTL }) {
  const getTextContent = (html) => {
    if (!html) return '';
    // Replace common HTML entities with their character equivalent
    let text = html.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    // Remove all HTML tags
    text = text.replace(/<[^>]*>/g, '');
    // Replace multiple whitespace characters (spaces, tabs, newlines) with a single space
    text = text.replace(/\s+/g, ' ');
    // Trim leading/trailing spaces
    return text.trim();
  };

  const originalText = getTextContent(originalContent);
  const newText = getTextContent(newContent);

  // Character-level diff using LCS algorithm for block-based display
  const computeDiff = () => {
    const oldChars = originalText.split('');
    const newChars = newText.split('');
    
    const m = oldChars.length;
    const n = newChars.length;
    
    // Build LCS table
    const lcs = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (oldChars[i - 1] === newChars[j - 1]) {
          lcs[i][j] = lcs[i - 1][j - 1] + 1;
        } else {
          lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
        }
      }
    }
    
    // Backtrack to find character-level diff
    const charDiff = [];
    let i = m, j = n;
    
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldChars[i - 1] === newChars[j - 1]) {
        charDiff.unshift({ type: 'unchanged', char: oldChars[i - 1] });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
        charDiff.unshift({ type: 'added', char: newChars[j - 1] });
        j--;
      } else if (i > 0) {
        charDiff.unshift({ type: 'removed', char: oldChars[i - 1] });
        i--;
      }
    }
    
    // Group consecutive characters of the same type into blocks
    const result = [];
    let currentType = null;
    let currentText = '';
    
    for (const item of charDiff) {
      if (item.type === currentType) {
        currentText += item.char;
      } else {
        if (currentText) {
          result.push({ type: currentType, text: currentText });
        }
        currentType = item.type;
        currentText = item.char;
      }
    }
    
    if (currentText) {
      result.push({ type: currentType, text: currentText });
    }
    
    return result;
  };

  const diff = computeDiff();

  return (
    <div 
      className="prose prose-sm max-w-none text-slate-700"
      style={{ 
        direction: isRTL ? 'rtl' : 'ltr', 
        textAlign: isRTL ? 'right' : 'left'
      }}
    >
      {diff.map((part, idx) => {
        if (part.type === 'removed') {
          return (
            <span key={idx} className="bg-red-100 text-red-800 line-through">
              {part.text}
            </span>
          );
        } else if (part.type === 'added') {
          return (
            <span key={idx} className="bg-green-100 text-green-800 font-medium">
              {part.text}
            </span>
          );
        } else {
          return <span key={idx}>{part.text}</span>;
        }
      })}
    </div>
  );
}

const languagePrompts = {
  en: "English",
  he: "Hebrew",
  ar: "Arabic"
};

const detectLanguage = (text) => {
  if (!text) return 'en';
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  if (hebrewPattern.test(text)) return 'he';
  if (arabicPattern.test(text)) return 'ar';
  return 'en';
};

export default function SectionHistorySidebar({ sectionId, isOpen, onClose }) {
  const { t, isRTL, language } = useLanguage();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState({});
  const [translatedPairs, setTranslatedPairs] = useState({}); // { versionId: { current: string, previous: string } }
  const [translatingPairs, setTranslatingPairs] = useState({});

  const { data: section, isLoading: sectionLoading } = useQuery({
    queryKey: ['section', sectionId],
    queryFn: () => base44.entities.Section.filter({ id: sectionId }).then(s => s[0]),
    enabled: !!sectionId && isOpen,
  });

  const { data: document } = useQuery({
    queryKey: ['document', section?.documentId],
    queryFn: () => base44.entities.Document.filter({ id: section.documentId }).then(d => d[0]),
    enabled: !!section?.documentId,
  });

  const { data: topic } = useQuery({
    queryKey: ['topic', section?.topicId],
    queryFn: () => base44.entities.Topic.filter({ id: section.topicId }).then(t => t[0]),
    enabled: !!section?.topicId,
  });

  const { data: versions, isLoading: versionsLoading } = useQuery({
    queryKey: ['versions', sectionId],
    queryFn: () => base44.entities.DocumentVersion.filter({ sectionId }, '-version'),
    initialData: [],
    enabled: !!sectionId && isOpen,
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const getUserName = (email) => {
    const foundUser = users.find(u => u.email === email);
    return foundUser?.full_name || email;
  };

  const toggleComments = (suggestionId) => {
    setShowComments(prev => ({
      ...prev,
      [suggestionId]: !prev[suggestionId]
    }));
  };

  const translatePairForDiff = async (versionId, currentContent, previousContent) => {
    if (translatedPairs[versionId]) {
      // Toggle back to original
      setTranslatedPairs(prev => {
        const newState = { ...prev };
        delete newState[versionId];
        return newState;
      });
      return;
    }

    setTranslatingPairs(prev => ({ ...prev, [versionId]: true }));
    try {
      // Translate both current and previous content
      const [currentResult, previousResult] = await Promise.all([
        base44.integrations.Core.InvokeLLM({
          prompt: `Translate the following HTML text to ${languagePrompts[language]}. Return ONLY the translated HTML, preserving all HTML tags:\n${currentContent}`,
          add_context_from_internet: false,
        }),
        base44.integrations.Core.InvokeLLM({
          prompt: `Translate the following HTML text to ${languagePrompts[language]}. Return ONLY the translated HTML, preserving all HTML tags:\n${previousContent}`,
          add_context_from_internet: false,
        })
      ]);
      
      const translatedCurrent = (typeof currentResult === 'string' ? currentResult : currentResult.content || currentResult).trim();
      const translatedPrevious = (typeof previousResult === 'string' ? previousResult : previousResult.content || previousResult).trim();
      
      setTranslatedPairs(prev => ({ 
        ...prev, 
        [versionId]: { current: translatedCurrent, previous: translatedPrevious } 
      }));
    } catch (err) {
      console.error('Translation error:', err);
    } finally {
      setTranslatingPairs(prev => ({ ...prev, [versionId]: false }));
    }
  };

  if (!isOpen) return null;

  // Sort versions by version number descending, deduplicate, and filter versions with same content
  const sortedVersions = [...versions]
    .sort((a, b) => b.version - a.version)
    .filter((version, index, arr) => 
      index === arr.findIndex(v => v.version === version.version)
    )
    .filter((version, index, arr) => {
      // הגרסה האחרונה תמיד נשארת
      if (index === arr.length - 1) return true;
      // אם התוכן זהה לגרסה הבאה (הקודמת כרונולוגית), נסנן אותה
      const nextVersion = arr[index + 1];
      return version.content !== nextVersion?.content;
    });
  
  // Create version groups - each version paired with the one before it for diff display
  // Also track which suggestionIds we've already shown to avoid duplicates
  const seenSuggestionIds = new Set();
  const versionGroups = sortedVersions.map((version, index) => {
    const previousVersion = sortedVersions[index + 1]; // The older version
    
    // Only show suggestion details once (on the newer version that contains the change)
    const shouldShowSuggestion = version.suggestionId && !seenSuggestionIds.has(version.suggestionId);
    if (version.suggestionId) {
      seenSuggestionIds.add(version.suggestionId);
    }
    
    return {
      version,
      previousVersion,
      suggestionId: shouldShowSuggestion ? version.suggestionId : null,
      changeDescription: version.changeDescription
    };
  });

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className={`fixed inset-y-0 ${isRTL ? 'right-0' : 'left-0'} w-full max-w-2xl bg-white shadow-2xl z-50 overflow-y-auto`}>
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

        <div className="p-4 space-y-4">
          {/* Breadcrumb */}
          {document && topic && (
            <p className={`text-sm text-slate-600 ${isRTL ? 'text-right' : ''}`}>
              <Link to={`${createPageUrl("DocumentView")}?id=${document.id}`} className="hover:underline">
                {document.title}
              </Link>
              {' > '}
              {topic.title}
            </p>
          )}

          {(sectionLoading || versionsLoading) ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : !section ? (
            <div className="text-center py-12">
              <p className="text-slate-500">{t('sectionNotFound')}</p>
            </div>
          ) : (
            <>
              {/* Version History */}
              {versionGroups.length > 0 ? (
                <div className="space-y-4">
                  {versionGroups.filter(g => g.version && g.version.changeType).map((group, groupIndex) => {
                    const currentVer = group.version;
                    const prevVer = group.previousVersion;
                    const isOldestVersion = groupIndex === versionGroups.length - 1;
                    
                    return (
                      <Card key={groupIndex} className="border-slate-200">
                        <CardHeader className="border-b border-slate-100 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <CardTitle className="text-sm">
                                {t('version')} {currentVer.version}
                              </CardTitle>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {currentVer.changeType === 'suggestion_accepted' ? t('suggestionAccepted') :
                                 currentVer.changeType === 'section_created' ? t('sectionCreated') :
                                 t('directEdit')}
                              </Badge>
                              {group.suggestionId && (
                                <Link to={`${createPageUrl("SuggestionDetail")}?id=${group.suggestionId}`}>
                                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7">
                                    <MessageSquare className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                                    {t('viewFullDiscussion')}
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                          {/* Show content for direct edits or oldest version */}
                          {(currentVer.changeType === 'direct_edit' || currentVer.changeType === 'section_created' || isOldestVersion) && (
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                              <TranslatableContent
                                content={currentVer.content}
                                entity={currentVer}
                                entityType="DocumentVersion"
                                onUpdate={(updated) => {
                                  queryClient.setQueryData(['versions', sectionId], (old) => 
                                    old?.map(v => v.id === currentVer.id ? updated : v)
                                  );
                                }}
                                className="prose prose-sm max-w-none text-slate-700"
                              />
                            </div>
                          )}
                          
                          {/* Show diff for suggestion_accepted */}
                          {prevVer && currentVer.changeType === 'suggestion_accepted' && !isOldestVersion && (
                            <div className="space-y-2">
                              {/* Check if content needs translation */}
                              {detectLanguage(currentVer.content) !== language ? (
                                <>
                                  {/* Show translate button if not yet translated */}
                                  {!translatedPairs[currentVer.id] ? (
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                      <InlineDiffView
                                        originalContent={prevVer.content}
                                        newContent={currentVer.content}
                                        isRTL={detectLanguage(currentVer.content) === 'he' || detectLanguage(currentVer.content) === 'ar'}
                                      />
                                      <div className="text-center mt-3 pt-3 border-t border-slate-200">
                                        <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => translatePairForDiff(currentVer.id, currentVer.content, prevVer.content)}
                                        disabled={translatingPairs[currentVer.id]}
                                        className="h-7 text-xs gap-1"
                                      >
                                        {translatingPairs[currentVer.id] ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Languages className="w-3 h-3" />
                                        )}
                                        {translatingPairs[currentVer.id] ? t('translating') : t('translate')}
                                      </Button>
                                    </div>
                                  ) : (
                                    <>
                                      {/* Show translated diff */}
                                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                        <InlineDiffView
                                          originalContent={translatedPairs[currentVer.id].previous}
                                          newContent={translatedPairs[currentVer.id].current}
                                          isRTL={isRTL}
                                        />
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => translatePairForDiff(currentVer.id, currentVer.content, prevVer.content)}
                                        className="h-6 text-xs text-slate-500"
                                      >
                                        {t('showOriginal')}
                                      </Button>
                                    </>
                                  )}
                                </>
                              ) : (
                                /* Content is in system language - show diff directly */
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                  <InlineDiffView
                                    originalContent={prevVer.content}
                                    newContent={currentVer.content}
                                    isRTL={isRTL}
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Show suggestion details if available */}
                          {group.suggestionId && (
                            <SuggestionDetails 
                              suggestionId={group.suggestionId}
                              user={user}
                              getUserName={getUserName}
                              showComments={showComments}
                              toggleComments={toggleComments}
                              users={users}
                            />
                          )}

                          <div className="text-xs text-slate-500 pt-3 border-t">
                            {t('created')} {new Date(currentVer.created_date).toLocaleString()}
                            {currentVer.created_by && ` ${t('by')} ${getUserName(currentVer.created_by)}`}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">{t('noPreviousVersions')}</p>
                  <p className="text-xs text-slate-400 mt-2">{t('sectionChangesAutomaticallySaved')}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// Component to display suggestion details
function SuggestionDetails({ suggestionId, user, getUserName, showComments, toggleComments, users }) {
  const { t, isRTL } = useLanguage();
  const queryClient = useQueryClient();
  
  const { data: suggestion } = useQuery({
    queryKey: ['suggestion', suggestionId],
    queryFn: () => base44.entities.Suggestion.filter({ id: suggestionId }).then(s => s[0]),
    enabled: !!suggestionId,
  });

  const { data: comments } = useQuery({
    queryKey: ['suggestionComments', suggestionId],
    queryFn: () => base44.entities.Comment.filter({ 
      rootEntityType: 'suggestion',
      rootEntityId: suggestionId 
    }),
    initialData: [],
    enabled: !!suggestionId,
  });

  if (!suggestion) {
    return null;
  }

  return (
    <div className="space-y-3 bg-blue-50/50 p-3 rounded-lg border border-blue-200">
      {suggestion.explanation && (
        <div>
          <h4 className="text-xs font-semibold text-slate-700 mb-1">{t('explanationForSuggestion')}</h4>
          <TranslatableContent
            content={suggestion.explanation}
            entity={suggestion}
            entityType="Suggestion"
            fieldName="explanation"
            className="text-xs text-slate-600"
          />
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-green-600 font-semibold">{suggestion.proVotes || 0}</span>
            <span className="text-slate-500">{t('pro')}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-red-600 font-semibold">{suggestion.conVotes || 0}</span>
            <span className="text-slate-500">{t('con')}</span>
          </div>
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-xs">
            {suggestion.status === 'accepted' ? t('accepted') : t(suggestion.status)}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleComments(suggestionId)}
          className="text-slate-600 hover:text-blue-600 text-xs h-7"
        >
          <MessageSquare className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
          {t('comments')} ({comments.length})
        </Button>
      </div>

      {showComments[suggestionId] && (
        <div className="mt-3 pt-3 border-t border-blue-300">
          <CommentsSection
            entityType="suggestion"
            entityId={suggestionId}
            user={user}
          />
        </div>
      )}

      <div className="text-xs text-slate-500">
        {t('publishedBy')} <Link to={`${createPageUrl("Profile")}?userId=${users?.find(u => u.email === suggestion.created_by)?.id}`} className="hover:underline text-blue-600">{getUserName(suggestion.created_by)}</Link> • {t('created')} {new Date(suggestion.created_date).toLocaleString()}
        {suggestion.status === 'accepted' && suggestion.updated_date && (
          <span className="text-green-600 font-medium block mt-1">
            {t('acceptedOn')} {new Date(suggestion.updated_date).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}