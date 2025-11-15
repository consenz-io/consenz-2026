import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, History, Edit, MessageSquare, ThumbsUp, ThumbsDown } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import SectionDiff from "./SectionDiff";
import VotesNeededCounter from "./VotesNeededCounter";
import CommentsSection from "./CommentsSection";
import TranslatableContent from "./TranslatableContent";
import DocumentTextContent from "./DocumentTextContent";

export default function SectionCarousel({
  section,
  pendingSuggestions,
  document,
  user,
  onEditSection,
  toggleComments,
  showComments,
  getCommentsCount,
  getUserVote,
  voteMutation,
  getUserName,
  acceptedSuggestions,
  sectionIndex
}) {
  const { t, isRTL } = useLanguage();
  
  // סדר הצגה: לפי דלתא קרובה ל-0, ואז כרונולוגי
  const sortedSuggestions = [...pendingSuggestions].sort((a, b) => {
    const deltaA = Math.abs((a.proVotes || 0) - (a.conVotes || 0));
    const deltaB = Math.abs((b.proVotes || 0) - (b.conVotes || 0));
    
    if (deltaA !== deltaB) {
      return deltaA - deltaB; // דלתא קטנה יותר קודם
    }
    
    // אם הדלתא זהה, סדר כרונולוגי - האחרונה ראשונה
    return new Date(b.created_date) - new Date(a.created_date);
  });

  // רשימת כל ה"עמודים": תוכן נוכחי + הצעות ממויינות
  const allViews = [
    { type: 'current', data: section },
    ...sortedSuggestions.map(s => ({ type: 'suggestion', data: s }))
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentView = allViews[currentIndex];

  // דפדוף מעגלי
  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % allViews.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + allViews.length) % allViews.length);
  };

  const isFirstView = currentIndex === 0;
  const isLastView = currentIndex === allViews.length - 1;

  return (
    <div id={`section-${section.id}`} className="group relative p-6 border-2 border-slate-300 rounded-lg hover:border-blue-400 hover:shadow-md transition-all bg-gradient-to-br from-white to-slate-50/30">
      {/* כותרת סעיף עם אינדיקטור */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium text-slate-500">
            {t('section')} {sectionIndex + 1}
          </div>
          {allViews.length > 1 && (
            <Badge variant="outline" className="text-xs">
              {currentIndex + 1} / {allViews.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* כפתור היסטוריה - תמיד זמין */}
          <Link to={`${createPageUrl("SectionHistory")}?id=${section.id}`}>
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-blue-600"
            >
              <History className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
              {t('history')}
            </Button>
          </Link>
        </div>
      </div>

      {/* כפתורי דפדוף */}
      {allViews.length > 1 && (
        <div className={`flex items-center justify-between mb-4 pb-4 border-b border-slate-200 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            className="flex items-center gap-2"
          >
            {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            <span className="text-xs">{t('previousSuggestion')}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            className="flex items-center gap-2"
          >
            <span className="text-xs">{t('nextSuggestion')}</span>
            {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      )}

      {/* תוכן */}
      <div className="min-h-[200px]">
        {currentView.type === 'current' ? (
          // תצוגת תוכן נוכחי
          <>
            <TranslatableContent
              content={section.content}
              entity={section}
              entityType="Section"
              className="prose prose-sm max-w-none"
              renderContent={(content) => (
                <DocumentTextContent content={content} className="text-slate-800" />
              )}
            />
            <div className={`flex items-center justify-between mt-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="text-xs text-slate-400">
                {t('lastEdited')} {new Date(section.updated_date).toLocaleDateString()}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleComments(`section-${section.id}`)}
                className="text-slate-600 hover:text-blue-600"
              >
                <MessageSquare className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                {t('comments')} ({getCommentsCount('section', section.id)})
              </Button>
            </div>
            {showComments[`section-${section.id}`] && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <CommentsSection
                  entityType="section"
                  entityId={section.id}
                  user={user}
                />
              </div>
            )}
          </>
        ) : (
          // תצוגת הצעה - diff
          <>
            <div className="mb-3">
              <div className="text-sm font-semibold text-amber-900 mb-2">
                <TranslatableContent
                  content={currentView.data.title}
                  entity={currentView.data}
                  entityType="Suggestion"
                  renderContent={(content) => <span>{content}</span>}
                />
              </div>
              {currentView.data.explanation && (
                <p className="text-sm text-slate-600 mb-3">
                  <TranslatableContent
                    content={currentView.data.explanation}
                    entity={currentView.data}
                    entityType="Suggestion"
                    renderContent={(content) => <span>{content}</span>}
                  />
                </p>
              )}
            </div>
            
            {currentView.data.originalContent ? (
              <SectionDiff
                originalContent={currentView.data.originalContent}
                newContent={currentView.data.newContent}
              />
            ) : (
              <TranslatableContent
                content={currentView.data.newContent}
                entity={currentView.data}
                entityType="Suggestion"
                className="prose prose-sm max-w-none p-3 bg-green-50 rounded border border-green-200"
                renderContent={(content) => (
                  <DocumentTextContent content={content} />
                )}
              />
            )}

            {/* כפתורי הצבעה והערות */}
            <div className="flex items-center gap-4 mt-4 text-sm flex-wrap">
              {user && document?.votingButtonsEnabled ? (
                <>
                  <Button
                    variant={getUserVote(currentView.data.id)?.vote === 'pro' ? 'default' : 'outline'}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      voteMutation.mutate({
                        suggestionId: currentView.data.id,
                        vote: 'pro',
                        currentVote: getUserVote(currentView.data.id)
                      });
                    }}
                    disabled={voteMutation.isPending}
                    className={getUserVote(currentView.data.id)?.vote === 'pro' ? 'bg-green-600 hover:bg-green-700' : ''}
                  >
                    <ThumbsUp className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                    {currentView.data.proVotes || 0}
                  </Button>
                  <Button
                    variant={getUserVote(currentView.data.id)?.vote === 'con' ? 'default' : 'outline'}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      voteMutation.mutate({
                        suggestionId: currentView.data.id,
                        vote: 'con',
                        currentVote: getUserVote(currentView.data.id)
                      });
                    }}
                    disabled={voteMutation.isPending}
                    className={getUserVote(currentView.data.id)?.vote === 'con' ? 'bg-red-600 hover:bg-red-700' : ''}
                  >
                    <ThumbsDown className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                    {currentView.data.conVotes || 0}
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1 text-green-600">
                    <ThumbsUp className="w-4 h-4" />
                    <span className="font-medium">{currentView.data.proVotes || 0}</span>
                  </div>
                  <div className="flex items-center gap-1 text-red-600">
                    <ThumbsDown className="w-4 h-4" />
                    <span className="font-medium">{currentView.data.conVotes || 0}</span>
                  </div>
                </>
              )}
              <VotesNeededCounter 
                suggestion={currentView.data} 
                document={document} 
                acceptedSuggestions={acceptedSuggestions} 
              />
              <Badge variant="outline" className="text-xs">
                {t('by')} {getUserName(currentView.data.created_by)}
              </Badge>
              <Link to={`${createPageUrl("SuggestionDetail")}?id=${currentView.data.id}`}>
                <Button size="sm" variant="outline" className="text-xs">
                  {t('viewDetails')}
                </Button>
              </Link>
            </div>

            {/* תגובות להצעה */}
            <div className="mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleComments(`suggestion-${currentView.data.id}`)}
              >
                <MessageSquare className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                {t('comments')} ({getCommentsCount('suggestion', currentView.data.id)})
              </Button>
            </div>
            {showComments[`suggestion-${currentView.data.id}`] && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <CommentsSection
                  entityType="suggestion"
                  entityId={currentView.data.id}
                  user={user}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* כפתורים מרכזיים - ערוך/תגובה בתצוגה נוכחית */}
      {isFirstView && user && (
        <div className="flex justify-center gap-2 mt-4 pt-4 border-t border-slate-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEditSection(section)}
          >
            <Edit className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
            {t('editSection')}
          </Button>
        </div>
      )}
    </div>
  );
}