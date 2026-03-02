import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, MessageSquare, Languages, Loader2, GitCompare, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import TranslatableContent from "./TranslatableContent";
import CommentsSection from "./CommentsSection";

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

// Component to display suggestion details
function SuggestionDetails({ suggestionId, user, getUserName, showComments, toggleComments, users }) {
  const { t, isRTL } = useLanguage();
  const queryClient = useQueryClient();
  
  const [suggestion, setSuggestion] = React.useState(null);
  const [comments, setComments] = React.useState([]);

  React.useEffect(() => {
    if (suggestionId) {
      base44.entities.Suggestion.filter({ id: suggestionId }).then(s => setSuggestion(s[0]));
      base44.entities.Comment.filter({ 
        rootEntityType: 'suggestion',
        rootEntityId: suggestionId 
      }).then(setComments);
    }
  }, [suggestionId]);

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
  user,
  users,
}) {
  const { t, isRTL, language } = useLanguage();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState({});
  const [showDiff, setShowDiff] = useState({});
  const [translatedVersions, setTranslatedVersions] = useState({});
  const [translatingVersions, setTranslatingVersions] = useState({});

  // סינון כפילויות - שומרים רק גרסאות עם תוכן שונה מהגרסה הקודמת
  const sortedVersions = [...versions]
    .sort((a, b) => {
      const dateA = new Date(a.created_date || 0).getTime();
      const dateB = new Date(b.created_date || 0).getTime();
      return dateB - dateA;
    })
    .filter((version, index, arr) => {
      // הגרסה האחרונה תמיד נשארת
      if (index === arr.length - 1) return true;
      // אם התוכן זהה לגרסה הבאה (הקודמת כרונולוגית), נסנן אותה
      const nextVersion = arr[index + 1];
      return version.content !== nextVersion?.content;
    });

  // Create version groups - each version paired with the one before it for diff display
  const seenSuggestionIds = new Set();
  const versionGroups = sortedVersions.map((version, index) => {
    const previousVersion = sortedVersions[index + 1];
    
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

  const toggleComments = (suggestionId) => {
    setShowComments(prev => ({
      ...prev,
      [suggestionId]: !prev[suggestionId]
    }));
  };

  const translateVersion = async (versionId, content) => {
    if (translatedVersions[versionId]) {
      setTranslatedVersions(prev => {
        const newState = { ...prev };
        delete newState[versionId];
        return newState;
      });
      return;
    }

    setTranslatingVersions(prev => ({ ...prev, [versionId]: true }));
    try {
      const prompt = `Translate the following HTML text to ${languagePrompts[language]}. Return ONLY the translated HTML, preserving all HTML tags:\n${content}`;
      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false,
      });
      const translatedContent = (typeof result === 'string' ? result : result.content || result).trim();
      setTranslatedVersions(prev => ({ ...prev, [versionId]: translatedContent }));
    } catch (err) {
      console.error('Translation error:', err);
    } finally {
      setTranslatingVersions(prev => ({ ...prev, [versionId]: false }));
    }
  };

  const toggleDiff = (versionId) => {
    setShowDiff(prev => ({
      ...prev,
      [versionId]: !prev[versionId]
    }));
  };

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

      {versionGroups.filter(g => g.version && g.version.changeType).map((group, groupIndex) => {
        const currentVer = group.version;
        const prevVer = group.previousVersion;
        const isOldestVersion = groupIndex === versionGroups.length - 1;

        return (
          <Card key={currentVer.id} className="border-slate-200">
            <CardHeader className="border-b border-slate-100 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <CardTitle className="text-sm">
                    {t('version')} {currentVer.version}
                  </CardTitle>
                  {currentVer.changeDescription && (
                    <p className="text-xs text-slate-600 mt-1">
                      {typeof currentVer.changeDescription === 'string' 
                        ? currentVer.changeDescription 
                        : (currentVer.changeDescription?.title || '')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {getChangeTypeLabel(currentVer.changeType)}
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
                      queryClient.setQueryData(['versions', documentId], (old) => 
                        old?.map(v => v.id === currentVer.id ? updated : v)
                      );
                    }}
                    className="prose prose-sm max-w-none text-slate-700"
                  />
                </div>
              )}
              
              {/* Show content with translate/diff buttons for suggestion_accepted */}
              {prevVer && currentVer.changeType === 'suggestion_accepted' && !isOldestVersion && (
                <div className="space-y-2">
                  {/* Content display */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div 
                      className="prose prose-sm max-w-none text-slate-700"
                      dir={isRTL ? 'rtl' : 'ltr'}
                    >
                      {(() => {
                        const content = translatedVersions[currentVer.id] || currentVer.content;
                        if (!content) return '';
                        return content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                      })()}
                    </div>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {/* Translate button - only show if content language differs from UI language */}
                    {detectLanguage(currentVer.content) !== language && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => translateVersion(currentVer.id, currentVer.content)}
                        disabled={translatingVersions[currentVer.id]}
                        className={`h-7 text-xs gap-1 ${translatedVersions[currentVer.id] ? 'bg-blue-50 text-blue-600 border-blue-200' : ''}`}
                      >
                        {translatingVersions[currentVer.id] ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Languages className="w-3 h-3" />
                        )}
                        {translatedVersions[currentVer.id] ? t('showOriginal') : t('translate')}
                      </Button>
                    )}
                    
                    {/* Show diff button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleDiff(currentVer.id)}
                      className={`h-7 text-xs gap-1 ${showDiff[currentVer.id] ? 'bg-purple-50 text-purple-600 border-purple-200' : ''}`}
                    >
                      <GitCompare className="w-3 h-3" />
                      {showDiff[currentVer.id] ? t('showLess') : t('showDiff')}
                    </Button>
                  </div>
                  
                  {/* Diff view - inline diff display */}
                  {showDiff[currentVer.id] && (
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                      <InlineDiffView
                        originalContent={translatedVersions[prevVer.id] || prevVer.content}
                        newContent={translatedVersions[currentVer.id] || currentVer.content}
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
  );
}