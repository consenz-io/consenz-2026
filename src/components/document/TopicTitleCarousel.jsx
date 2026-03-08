import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, ThumbsUp, ThumbsDown, Languages, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

const TopicTitleCarousel = React.memo(function TopicTitleCarousel({
  topic,
  topicEditSuggestions,
  document,
  user,
  getUserTopicVote,
  voteTopicEditMutation,
  getUserName,
  isAdmin,
  users,
  publicProfiles,
  showTranslatedTopics,
  setShowTranslatedTopics,
  translateTopicMutation,
  setEditingTopic,
  language,
  isRTL
}) {
  const { t } = useLanguage();
  
  // המחרוזת הנוכחית היא הכותרת, וההצעות הן הצעות שינוי
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // סדר הצגה: כותרת נוכחית + הצעות
  const allViews = [
    { type: 'current', data: topic, id: 'current' },
    ...topicEditSuggestions.map(s => ({ type: 'suggestion', data: s, id: s.id }))
  ];

  // אפס index אם הוא חורג מהגבולות (למשל כשהצעה נמחקת)
  const safeIndex = currentIndex >= allViews.length ? 0 : currentIndex;
  const currentView = allViews[safeIndex];
  
  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % allViews.length);
  };
  
  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + allViews.length) % allViews.length);
  };
  
  const isFirstView = currentIndex === 0;
  
  const languageNames = {
    en: "English",
    he: "עברית",
    ar: "العربية"
  };
  
  // threshold - זהה ל-VotesNeededCounter: משתמשים ב-document.threshold הקבוע
  const threshold = Math.max(2, document.threshold || 2);
  
  return (
    <div className="flex items-center gap-2 w-full">
      {/* כפתור previous */}
      {allViews.length > 1 && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrev}
          className="flex-shrink-0 h-8 w-8"
        >
          {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      )}
      
      {/* תוכן */}
      <div className="flex-1 min-w-0">
        {isFirstView ? (
          // הכותרת הנוכחית
          <div className="flex items-center gap-2">
            <h3 className={`text-lg md:text-2xl font-semibold break-words ${isRTL ? 'text-right' : 'text-left'}`}>
              {(() => {
                const translatedTitle = topic.translations?.[language]?.title;
                if (showTranslatedTopics[topic.id] && typeof translatedTitle === 'string') {
                  return translatedTitle;
                }
                return topic.title;
              })()}
            </h3>
            {allViews.length > 1 && (
              <Badge variant="outline" className="text-xs flex-shrink-0">
                {topicEditSuggestions.length} הצעות
              </Badge>
            )}
          </div>
        ) : (
          // הצעת שינוי
          <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <Badge className="bg-amber-500 text-white mb-2 text-xs">
                  הצעת עריכה לכותרת
                </Badge>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs text-slate-600">כותרת מוצעת:</span>
                    <p className="font-semibold text-slate-900 break-words">{currentView.data.newTitle}</p>
                  </div>
                  {currentView.data.explanation && (
                    <div>
                      <span className="text-xs text-slate-600">הסבר:</span>
                      <p className="text-xs text-slate-700">{currentView.data.explanation}</p>
                    </div>
                  )}
                  <div className="text-xs text-slate-500">
                    {t('by')} {getUserName(currentView.data.created_by)}
                  </div>
                </div>
              </div>
            </div>
            
            {/* הצבעה */}
            {document.votingButtonsEnabled && (
              <div className="flex items-center gap-2 pt-2 border-t border-amber-200 flex-wrap">
                <Button
                  size="sm"
                  variant={getUserTopicVote(currentView.data.id)?.vote === 'pro' ? 'default' : 'outline'}
                  onClick={() => {
                    if (!user) {
                      base44.auth.redirectToLogin(window.location.href);
                      return;
                    }
                    voteTopicEditMutation.mutate({
                      suggestionId: currentView.data.id,
                      vote: 'pro',
                      currentVote: getUserTopicVote(currentView.data.id),
                    });
                  }}
                  disabled={voteTopicEditMutation.isPending}
                  className={`text-xs h-7 ${getUserTopicVote(currentView.data.id)?.vote === 'pro' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                >
                  <ThumbsUp className="w-3 h-3 mr-1" />
                  {currentView.data.proVotes || 0}
                </Button>
                <Button
                  size="sm"
                  variant={getUserTopicVote(currentView.data.id)?.vote === 'con' ? 'default' : 'outline'}
                  onClick={() => {
                    if (!user) {
                      base44.auth.redirectToLogin(window.location.href);
                      return;
                    }
                    voteTopicEditMutation.mutate({
                      suggestionId: currentView.data.id,
                      vote: 'con',
                      currentVote: getUserTopicVote(currentView.data.id)
                    });
                  }}
                  disabled={voteTopicEditMutation.isPending}
                  className={`text-xs h-7 ${getUserTopicVote(currentView.data.id)?.vote === 'con' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                >
                  <ThumbsDown className="w-3 h-3 mr-1" />
                  {currentView.data.conVotes || 0}
                </Button>
                <div className="text-xs text-slate-600">
                  {(() => {
                    const delta = (currentView.data.proVotes || 0) - (currentView.data.conVotes || 0);
                    const votesNeeded = Math.max(0, threshold - delta);
                    return votesNeeded > 0 ? (
                      <span>נדרשים עוד {votesNeeded} תומכים</span>
                    ) : (
                      <span className="text-green-600 font-semibold">✓ עבר את סף הקונצנזוס</span>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* כפתור next */}
      {allViews.length > 1 && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNext}
          className="flex-shrink-0 h-8 w-8"
        >
          {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </Button>
      )}
    </div>
  );
});

export default TopicTitleCarousel;