import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Plus, AlertCircle, ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";
import VotesNeededCounter from "./VotesNeededCounter";
import SectionDiff from "./SectionDiff";
import CommentsSection from "./CommentsSection";
import TranslatableContent from "./TranslatableContent";
import { useLanguage } from "@/components/LanguageContext";
import { checkSuggestionConsensus, autoAcceptSuggestion } from "./suggestionAutoAccept";

export default function DocumentContent({ 
  document, 
  topics, 
  sections, 
  suggestions,
  onEditSection, 
  onNewSection,
  isAdmin,
  user 
}) {
  const [showComments, setShowComments] = useState({});
  const queryClient = useQueryClient();
  const { t, isRTL } = useLanguage();

  // הסרתי את ה-useEffect - אישור אוטומטי מתבצע רק דרך voteMutation
  
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const { data: sectionComments } = useQuery({
    queryKey: ['sectionComments', document?.id],
    queryFn: () => base44.entities.Comment.filter({ rootEntityType: 'section' }),
    initialData: [],
    enabled: !!document?.id,
  });

  const { data: suggestionComments } = useQuery({
    queryKey: ['suggestionComments', document?.id],
    queryFn: () => base44.entities.Comment.filter({ rootEntityType: 'suggestion' }),
    initialData: [],
    enabled: !!document?.id,
  });

  const getCommentsCount = (entityType, entityId) => {
    const comments = entityType === 'section' ? sectionComments : suggestionComments;
    return comments.filter(c => c.rootEntityId === entityId).length;
  };

  const { data: userVotes } = useQuery({
    queryKey: ['userVotes', document?.id, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const allVotes = await base44.entities.Vote.filter({ userId: user.id });
      return allVotes.filter(v => 
        suggestions.some(s => s.id === v.suggestionId)
      );
    },
    enabled: !!user?.id && suggestions.length > 0,
    initialData: [],
  });

  const getUserVote = (suggestionId) => {
    return userVotes?.find(v => v.suggestionId === suggestionId);
  };

  const voteMutation = useMutation({
    mutationFn: async ({ suggestionId, vote, currentVote }) => {
      if (!user) throw new Error("יש להתחבר כדי להצביע");

      const suggestion = suggestions.find(s => s.id === suggestionId);
      const section = sections.find(s => s.id === suggestion?.sectionId);
      
      let updatedSuggestion;
      let wasAcceptedBefore = false;
      
      if (currentVote) {
        if (currentVote.vote === vote) {
          await base44.entities.Vote.delete(currentVote.id);
          updatedSuggestion = await base44.entities.Suggestion.update(suggestionId, {
            [vote === 'pro' ? 'proVotes' : 'conVotes']: Math.max(0, (suggestion[vote === 'pro' ? 'proVotes' : 'conVotes'] || 0) - 1)
          });
        } else {
          await base44.entities.Vote.update(currentVote.id, { vote });
          updatedSuggestion = await base44.entities.Suggestion.update(suggestionId, {
            proVotes: suggestion.proVotes + (vote === 'pro' ? 1 : -1),
            conVotes: suggestion.conVotes + (vote === 'con' ? 1 : -1)
          });
        }
      } else {
        await base44.entities.Vote.create({
          suggestionId,
          userId: user.id,
          vote
        });
        updatedSuggestion = await base44.entities.Suggestion.update(suggestionId, {
          [vote === 'pro' ? 'proVotes' : 'conVotes']: (suggestion[vote === 'pro' ? 'proVotes' : 'conVotes'] || 0) + 1
        });

        // Award +10 points to suggestion creator for each "pro" vote (only if gamification enabled)
        if (vote === 'pro' && document.gamificationEnabled) {
          const suggestionCreator = await base44.entities.User.filter({ email: suggestion.created_by }).then(u => u[0]);
          if (suggestionCreator) {
            await base44.entities.User.update(suggestionCreator.id, {
              points: (suggestionCreator.points || 1000) + 10
            });
          }
        }
      }

      // בדיקה והפעלת אישור אוטומטי אם עברנו את הסף
      const { shouldAccept } = checkSuggestionConsensus(updatedSuggestion, document);
      if (shouldAccept && suggestion.status === 'pending') {
        wasAcceptedBefore = false;
        await autoAcceptSuggestion(updatedSuggestion, user.id, document);
        
        // Award +50 points to voter if vote influenced acceptance (only if gamification enabled)
        if (!currentVote && vote === 'pro' && document.gamificationEnabled) {
          await base44.auth.updateMe({
            points: (user.points || 1000) + 50
          });
        }
      } else if (suggestion.status === 'accepted') {
        wasAcceptedBefore = true;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions', document?.id] });
      queryClient.invalidateQueries({ queryKey: ['userVotes'] });
      queryClient.invalidateQueries({ queryKey: ['sections', document?.id] });
      queryClient.invalidateQueries({ queryKey: ['versions'] });
    },
  });

  const getUserName = (email) => {
    const user = users.find(u => u.email === email);
    return user?.full_name || email;
  };

  const toggleComments = (id) => {
    setShowComments(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getSectionsForTopic = (topicId) => {
    return sections.filter(s => s.topicId === topicId).sort((a, b) => a.order - b.order);
  };

  const getSuggestionsForSection = (sectionId) => {
    return suggestions.filter(s => 
      s.sectionId === sectionId && 
      s.type === 'edit_section' && 
      s.status === 'pending'
    );
  };

  return (
    <div className="space-y-6">
      {topics.map((topic) => {
        const topicSections = getSectionsForTopic(topic.id);
        
        return (
          <Card key={topic.id} className="bg-white border-slate-200">
            <CardHeader className="border-b border-slate-100">
              <div className={`flex justify-between items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                <CardTitle className="text-2xl">{topic.title}</CardTitle>
                {user && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNewSection(topic.id)}
                  >
                    <Plus className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('addSection')}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {topicSections.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  {t('noSectionsYet')}
                </div>
              ) : (
                topicSections.map((section, index) => {
                  const sectionSuggestions = getSuggestionsForSection(section.id);
                  
                  return (
                    <React.Fragment key={section.id}>
                      {index > 0 && user && (
                        <div className="group relative h-4 flex items-center justify-center -my-2">
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="h-full flex items-center justify-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onNewSection(topic.id, index)}
                                className="bg-white shadow-md border-blue-300 text-blue-600 hover:bg-blue-50"
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                הוסף סעיף כאן
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    <div key={section.id} className="space-y-3">
                      <div id={`section-${section.id}`} className="group relative p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all">
                        <div className={`flex justify-between items-start gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-500 mb-2">
                              Section {index + 1}
                            </div>
                            <TranslatableContent
                              content={section.content}
                              entity={section}
                              entityType="Section"
                              className="prose prose-sm max-w-none text-slate-700"
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
                          </div>
                          {user && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEditSection(section)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
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
                      </div>

                      {sectionSuggestions.length > 0 && (
                        <div className="space-y-3 ml-8">
                          {sectionSuggestions.map(suggestion => {
                            return (
                              <Card key={suggestion.id} className="bg-amber-50/50 border-amber-200">
                                <CardContent className="p-4">
                                <div className={`flex items-start justify-between gap-3 mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                  <div className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-amber-600" />
                                    <span className="text-sm font-semibold text-amber-900">
                                      {t('pendingEditSuggestion')}
                                    </span>
                                  </div>
                                  <Link to={`${createPageUrl("SuggestionDetail")}?id=${suggestion.id}`}>
                                    <Button size="sm" variant="outline">
                                      {t('viewDetails')}
                                    </Button>
                                  </Link>
                                </div>
                                
                                <div className="text-sm text-slate-700 mb-3" style={{ direction: isRTL ? 'rtl' : 'ltr', textAlign: isRTL ? 'right' : 'left' }}>
                                  <strong>{suggestion.title}</strong>
                                  {suggestion.explanation && (
                                    <p className="text-slate-600 mt-1">{suggestion.explanation}</p>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <div className="text-xs font-semibold text-slate-500 mb-1">תוכן מוצע:</div>
                                  <TranslatableContent
                                    content={suggestion.newContent}
                                    entity={suggestion}
                                    entityType="Suggestion"
                                    className="prose prose-sm max-w-none p-3 bg-green-50 rounded border border-green-200"
                                  />
                                </div>

                                <div className="flex items-center gap-4 mt-3 text-sm flex-wrap">
                                  {user && document?.votingButtonsEnabled ? (
                                    <>
                                      <Button
                                        variant={getUserVote(suggestion.id)?.vote === 'pro' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          voteMutation.mutate({
                                            suggestionId: suggestion.id,
                                            vote: 'pro',
                                            currentVote: getUserVote(suggestion.id)
                                          });
                                        }}
                                        disabled={voteMutation.isPending}
                                        className={getUserVote(suggestion.id)?.vote === 'pro' ? 'bg-green-600 hover:bg-green-700' : ''}
                                      >
                                        <ThumbsUp className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                                        {suggestion.proVotes || 0}
                                      </Button>
                                      <Button
                                        variant={getUserVote(suggestion.id)?.vote === 'con' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          voteMutation.mutate({
                                            suggestionId: suggestion.id,
                                            vote: 'con',
                                            currentVote: getUserVote(suggestion.id)
                                          });
                                        }}
                                        disabled={voteMutation.isPending}
                                        className={getUserVote(suggestion.id)?.vote === 'con' ? 'bg-red-600 hover:bg-red-700' : ''}
                                      >
                                        <ThumbsDown className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                                        {suggestion.conVotes || 0}
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-1 text-green-600">
                                        <ThumbsUp className="w-4 h-4" />
                                        <span className="font-medium">{suggestion.proVotes || 0}</span>
                                      </div>
                                      <div className="flex items-center gap-1 text-red-600">
                                        <ThumbsDown className="w-4 h-4" />
                                        <span className="font-medium">{suggestion.conVotes || 0}</span>
                                      </div>
                                    </>
                                  )}
                                  <VotesNeededCounter suggestion={suggestion} document={document} />
                                  <Badge variant="outline" className="text-xs">
                                    {t('by')} {getUserName(suggestion.created_by)}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleComments(`suggestion-${suggestion.id}`)}
                                    className={isRTL ? 'ml-auto' : 'mr-auto'}
                                  >
                                    <MessageSquare className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                                    {t('comments')} ({getCommentsCount('suggestion', suggestion.id)})
                                  </Button>
                                </div>

                                {showComments[`suggestion-${suggestion.id}`] && (
                                  <div className="mt-4 pt-4 border-t border-amber-300">
                                    <CommentsSection
                                      entityType="suggestion"
                                      entityId={suggestion.id}
                                      user={user}
                                    />
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {index === topicSections.length - 1 && user && (
                      <div className="group relative h-4 flex items-center justify-center mt-2">
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="h-full flex items-center justify-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onNewSection(topic.id, index + 1)}
                              className="bg-white shadow-md border-blue-300 text-blue-600 hover:bg-blue-50"
                            >
                              <Plus className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                              {t('insertSectionHere')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    </React.Fragment>
                  );
                })
              )}
            </CardContent>
          </Card>
        );
      })}

      {topics.length === 0 && (
        <Card className="bg-white border-slate-200">
          <CardContent className="p-12 text-center">
            <p className="text-slate-500">{t('noTopicsYet')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}