import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Plus, AlertCircle, ThumbsUp, ThumbsDown, MessageSquare, History, Languages, Loader2, GripVertical, Trash2 } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import VotesNeededCounter from "./VotesNeededCounter";
import SectionDiff from "./SectionDiff";
import CommentsSection from "./CommentsSection";
import TranslatableContent from "./TranslatableContent";
import DocumentTextContent from "./DocumentTextContent";
import SectionCarousel from "./SectionCarousel";
import NewSectionSuggestionCard from "./NewSectionSuggestionCard";
import EditTopicModal from "./EditTopicModal";

import { useLanguage } from "@/components/LanguageContext";
import { checkSuggestionConsensus, autoAcceptSuggestion } from "./suggestionAutoAccept";
import { toast } from "sonner";

export default function DocumentContent({ 
  document, 
  topics, 
  sections, 
  suggestions,
  onEditSection, 
  onNewSection,
  isAdmin,
  user,
  onDirectEdit
}) {
  const [showComments, setShowComments] = useState({});
  const [showTranslatedTopics, setShowTranslatedTopics] = useState({});
  const [editingTopic, setEditingTopic] = useState(null);
  const queryClient = useQueryClient();
  const { t, isRTL, language } = useLanguage();

  const languageNames = {
    en: "English",
    he: "עברית",
    ar: "العربية"
  };

  const languagePrompts = {
    en: "English",
    he: "Hebrew",
    ar: "Arabic"
  };

  // בדיקה ואישור אוטומטי של הצעות שעברו את רף הקונסנזוס
  const hasCheckedRef = React.useRef(new Set());
  
  React.useEffect(() => {
    if (!document || !suggestions) return;

    const checkAndAutoAccept = async () => {
      let hasChanges = false;
      
      for (const suggestion of suggestions) {
        if (suggestion.status !== 'pending') continue;
        
        // Skip if already checked this suggestion with current vote counts
        const checkKey = `${suggestion.id}-${suggestion.proVotes}-${suggestion.conVotes}`;
        if (hasCheckedRef.current.has(checkKey)) continue;
        hasCheckedRef.current.add(checkKey);

        try {
          const { shouldAccept } = await checkSuggestionConsensus(suggestion, document);
          console.log('[AUTO-ACCEPT CHECK]', { suggestionId: suggestion.id, shouldAccept, status: suggestion.status });
          
          if (shouldAccept) {
            console.log('[AUTO-ACCEPT] Auto-accepting suggestion:', suggestion.id);
            // Use suggestion creator as user if no user is logged in
            const acceptingUserId = user?.id || suggestion.created_by;
            const accepted = await autoAcceptSuggestion(suggestion, acceptingUserId, document);
            if (accepted) {
              console.log('[AUTO-ACCEPT] Successfully accepted, invalidating queries');
              hasChanges = true;
            }
          }
        } catch (err) {
          console.error('[AUTO-ACCEPT] Error checking suggestion:', err);
          // Remove from checked set on error so it can be retried
          hasCheckedRef.current.delete(checkKey);
        }
      }
      
      // Cleanup old entries periodically
      if (hasCheckedRef.current.size > 100) {
        hasCheckedRef.current.clear();
      }
      
      // Refresh data if any changes occurred
      if (hasChanges) {
        console.log('[AUTO-ACCEPT] Refreshing all queries after acceptance');
        await queryClient.invalidateQueries({ queryKey: ['suggestions', document.id] });
        await queryClient.invalidateQueries({ queryKey: ['sections', document.id] });
        await queryClient.invalidateQueries({ queryKey: ['allVersions'] });
        await queryClient.invalidateQueries({ queryKey: ['document', document.id] });
      }
    };

    checkAndAutoAccept();
  }, [suggestions, document, user, queryClient]);
  
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const { data: topicEditSuggestions } = useQuery({
    queryKey: ['topicEditSuggestions', document?.id],
    queryFn: () => base44.entities.TopicEditSuggestion.filter({ documentId: document.id }),
    enabled: !!document?.id,
    initialData: [],
  });

  const { data: topicEditVotes } = useQuery({
    queryKey: ['topicEditVotes', document?.id, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return await base44.entities.TopicEditVote.filter({ userId: user.id });
    },
    enabled: !!user?.id && !!document?.id,
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
      
      console.log('[POINTS DEBUG] Vote by:', user.email, 'on suggestion by:', suggestion.created_by);
      
      if (currentVote) {
        if (currentVote.vote === vote) {
          // Canceling existing vote
          console.log('[POINTS DEBUG] Canceling vote:', currentVote.vote);
          await base44.entities.Vote.delete(currentVote.id);
          updatedSuggestion = await base44.entities.Suggestion.update(suggestionId, {
            [vote === 'pro' ? 'proVotes' : 'conVotes']: Math.max(0, (suggestion[vote === 'pro' ? 'proVotes' : 'conVotes'] || 0) - 1)
          });
          
          // Remove 10 points from suggestion creator if it was a "pro" vote (only if gamification enabled)
          if (vote === 'pro' && document.gamificationEnabled) {
            console.log('[POINTS DEBUG] Removing -10 points from suggestion creator for canceled pro vote');
            const suggestionCreatorList = await base44.entities.User.filter({ email: suggestion.created_by });
            if (suggestionCreatorList.length > 0) {
              const suggestionCreator = suggestionCreatorList[0];
              const freshUser = await base44.entities.User.filter({ id: suggestionCreator.id }).then(u => u[0]);
              if (freshUser) {
                const newPoints = Math.max(0, (freshUser.points || 1000) - 10);
                await base44.entities.User.update(freshUser.id, { points: newPoints });
                console.log('[POINTS DEBUG] Updated user points to:', newPoints);
                
                // Create points transaction record
                await base44.entities.PointsTransaction.create({
                  userId: suggestionCreator.id,
                  amount: -10,
                  action: 'vote_canceled',
                  description: `ביטול הצבעה בעד על ההצעה: ${suggestion.title}`,
                  relatedEntityId: suggestion.id,
                  relatedEntityType: 'suggestion'
                });
              }
            }
          }
        } else {
          // Changing vote direction
          console.log('[POINTS DEBUG] Changing vote from', currentVote.vote, 'to', vote);
          await base44.entities.Vote.update(currentVote.id, { vote });
          updatedSuggestion = await base44.entities.Suggestion.update(suggestionId, {
            proVotes: suggestion.proVotes + (vote === 'pro' ? 1 : -1),
            conVotes: suggestion.conVotes + (vote === 'con' ? 1 : -1)
          });
          
          // Handle points for vote direction change (only if gamification enabled)
          if (document.gamificationEnabled) {
            const suggestionCreatorList = await base44.entities.User.filter({ email: suggestion.created_by });
            if (suggestionCreatorList.length > 0) {
              const suggestionCreator = suggestionCreatorList[0];
              const freshUser = await base44.entities.User.filter({ id: suggestionCreator.id }).then(u => u[0]);
              if (freshUser) {
                let pointsChange = 0;
                if (currentVote.vote === 'con' && vote === 'pro') {
                  pointsChange = 10;
                  console.log('[POINTS DEBUG] Changing con to pro: +10 points');
                } else if (currentVote.vote === 'pro' && vote === 'con') {
                  pointsChange = -10;
                  console.log('[POINTS DEBUG] Changing pro to con: -10 points');
                }
                
                if (pointsChange !== 0) {
                  const newPoints = Math.max(0, (freshUser.points || 1000) + pointsChange);
                  await base44.entities.User.update(freshUser.id, { points: newPoints });
                  console.log('[POINTS DEBUG] Updated user points to:', newPoints);
                  
                  // Create points transaction record
                  await base44.entities.PointsTransaction.create({
                    userId: suggestionCreator.id,
                    amount: pointsChange,
                    action: 'vote_received',
                    description: pointsChange > 0 
                      ? `קיבל הצבעה בעד על ההצעה: ${suggestion.title}`
                      : `הצבעה השתנתה מבעד לנגד על ההצעה: ${suggestion.title}`,
                    relatedEntityId: suggestion.id,
                    relatedEntityType: 'suggestion'
                  });
                }
              }
            }
          }
        }
      } else {
        // New vote
        console.log('[POINTS DEBUG] New vote:', vote);
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
          console.log('[POINTS DEBUG] Vote PRO - awarding +10 points to suggestion creator:', suggestion.created_by);
          const suggestionCreatorList = await base44.entities.User.filter({ email: suggestion.created_by });
          console.log('[POINTS DEBUG] Found creators:', suggestionCreatorList.length);
          if (suggestionCreatorList.length > 0) {
            const suggestionCreator = suggestionCreatorList[0];
            const freshUser = await base44.entities.User.filter({ id: suggestionCreator.id }).then(u => u[0]);
            console.log('[POINTS DEBUG] Fresh user points before:', freshUser?.points);
            if (freshUser) {
              const newPoints = (freshUser.points || 1000) + 10;
              await base44.entities.User.update(freshUser.id, { points: newPoints });
              console.log('[POINTS DEBUG] Updated user points to:', newPoints);
              
              // Create points transaction record
              await base44.entities.PointsTransaction.create({
                userId: suggestionCreator.id,
                amount: 10,
                action: 'vote_received',
                description: `קיבל הצבעה בעד על ההצעה: ${suggestion.title}`,
                relatedEntityId: suggestion.id,
                relatedEntityType: 'suggestion'
              });
            }
          }
        }
      }

      // בדיקה והפעלת אישור אוטומטי אם עברנו את הסף
      const { shouldAccept } = await checkSuggestionConsensus(updatedSuggestion, document);
      console.log('[POINTS DEBUG] Should accept suggestion:', shouldAccept, 'Current status:', suggestion.status);
      if (shouldAccept && suggestion.status === 'pending') {
        wasAcceptedBefore = false;
        console.log('[POINTS DEBUG] Auto-accepting suggestion...');
        const accepted = await autoAcceptSuggestion(updatedSuggestion, user.id, document);
        
        if (accepted) {
          // רענון כל הקווריות הרלוונטיות
          queryClient.invalidateQueries({ queryKey: ['sections'] });
          queryClient.invalidateQueries({ queryKey: ['allVersions'] });
          queryClient.invalidateQueries({ queryKey: ['suggestions'] });
          queryClient.invalidateQueries({ queryKey: ['document'] });
        }
        
        // Award +50 points to voter if vote influenced acceptance (only if gamification enabled)
        if (!currentVote && vote === 'pro' && document.gamificationEnabled) {
          console.log('[POINTS DEBUG] Awarding +50 points to voter who influenced acceptance');
          const currentPoints = user.points || 1000;
          const newPoints = currentPoints + 50;
          await base44.auth.updateMe({
            points: newPoints
          });
          console.log('[POINTS DEBUG] Voter points updated from', currentPoints, 'to', newPoints);
          
          // Create points transaction record
          await base44.entities.PointsTransaction.create({
            userId: user.id,
            amount: 50,
            action: 'vote_influenced_acceptance',
            description: `ההצבעה שלך השפיעה על קבלת ההצעה: ${suggestion.title}`,
            relatedEntityId: suggestion.id,
            relatedEntityType: 'suggestion'
          });
          
          // Show success toast notification
          toast.success('🎉 ההצעה התקבלה והמסמך עודכן!', {
            description: `קיבלת 50 נקודות על הצבעתך המשפיעה`,
            duration: 5000,
          });
        } else if (accepted) {
          // Show success toast even without points
          toast.success('🎉 ההצעה התקבלה והמסמך עודכן!', {
            duration: 4000,
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

  const translateTopicMutation = useMutation({
    mutationFn: async (topic) => {
      const titlePrompt = `You are a professional translator. Translate the following text to ${languagePrompts[language]}.

CRITICAL INSTRUCTIONS:
- Return ONLY the translated text, nothing else
- Do not add any explanations or comments
- Maintain exact same formatting

Text to translate:
${topic.title}

Return ONLY the translated text:`;
      
      const titleResult = await base44.integrations.Core.InvokeLLM({
        prompt: titlePrompt,
        add_context_from_internet: false,
      });
      const translatedTitle = (typeof titleResult === 'string' ? titleResult : titleResult.content || titleResult).trim();

      const newTranslations = {
        ...(topic.translations || {}),
        [language]: {
          title: translatedTitle
        }
      };

      await base44.entities.Topic.update(topic.id, {
        translations: newTranslations
      });

      return { topicId: topic.id, translations: newTranslations };
    },
    onMutate: async (topic) => {
      setShowTranslatedTopics(prev => ({ ...prev, [topic.id]: true }));
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['topics', document.id], (oldData) => {
        if (!oldData) return oldData;
        return oldData.map(t => 
          t.id === data.topicId 
            ? { ...t, translations: data.translations }
            : t
        );
      });
    }
  });

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

  const getNewSectionSuggestionsForTopic = (topicId) => {
    return suggestions.filter(s => 
      s.topicId === topicId && 
      s.type === 'new_section' && 
      s.status === 'pending'
    ).sort((a, b) => (a.insertPosition || 999) - (b.insertPosition || 999));
  };

  const reorderSectionsMutation = useMutation({
    mutationFn: async ({ topicId, reorderedSections }) => {
      // Update the order of all sections in this topic
      await Promise.all(
        reorderedSections.map((section, index) => 
          base44.entities.Section.update(section.id, { order: index })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections', document?.id] });
    },
  });

  const handleSectionDragEnd = (result, topicId) => {
    if (!result.destination || !isAdmin) return;

    const topicSections = getSectionsForTopic(topicId);
    const items = Array.from(topicSections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    reorderSectionsMutation.mutate({
      topicId,
      reorderedSections: items
    });
  };

  const reorderTopicsMutation = useMutation({
    mutationFn: async ({ reorderedTopics }) => {
      await Promise.all(
        reorderedTopics.map((topic, index) => 
          base44.entities.Topic.update(topic.id, { order: index })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics', document?.id] });
    },
  });

  const handleTopicDragEnd = (result) => {
    if (!result.destination || !isAdmin) return;

    const items = Array.from(topics);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    reorderTopicsMutation.mutate({
      reorderedTopics: items
    });
  };

  const deleteTopicMutation = useMutation({
    mutationFn: async (topicId) => {
      // Delete all sections in this topic
      const topicSections = sections.filter(s => s.topicId === topicId);
      await Promise.all(
        topicSections.map(section => base44.entities.Section.delete(section.id))
      );
      
      // Delete the topic
      await base44.entities.Topic.delete(topicId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics', document?.id] });
      queryClient.invalidateQueries({ queryKey: ['sections', document?.id] });
    },
  });

  const handleDeleteTopic = (topicId, topicTitle) => {
    if (window.confirm(`האם אתה בטוח שברצונך למחוק את הנושא "${topicTitle}" וכל הסעיפים שבו?`)) {
      deleteTopicMutation.mutate(topicId);
    }
  };

  const getTopicEditSuggestions = (topicId) => {
    return topicEditSuggestions.filter(s => s.topicId === topicId && s.status === 'pending');
  };

  const getUserTopicVote = (suggestionId) => {
    return topicEditVotes?.find(v => v.suggestionId === suggestionId);
  };

  const voteTopicEditMutation = useMutation({
    mutationFn: async ({ suggestionId, vote, currentVote }) => {
      if (!user) throw new Error("יש להתחבר כדי להצביע");

      const suggestion = topicEditSuggestions.find(s => s.id === suggestionId);
      let updatedSuggestion;

      if (currentVote) {
        if (currentVote.vote === vote) {
          // Canceling vote
          await base44.entities.TopicEditVote.delete(currentVote.id);
          updatedSuggestion = await base44.entities.TopicEditSuggestion.update(suggestionId, {
            [vote === 'pro' ? 'proVotes' : 'conVotes']: Math.max(0, (suggestion[vote === 'pro' ? 'proVotes' : 'conVotes'] || 0) - 1)
          });
        } else {
          // Changing vote
          await base44.entities.TopicEditVote.update(currentVote.id, { vote });
          updatedSuggestion = await base44.entities.TopicEditSuggestion.update(suggestionId, {
            proVotes: suggestion.proVotes + (vote === 'pro' ? 1 : -1),
            conVotes: suggestion.conVotes + (vote === 'con' ? 1 : -1)
          });
        }
      } else {
        // New vote
        await base44.entities.TopicEditVote.create({
          suggestionId,
          userId: user.id,
          vote
        });
        updatedSuggestion = await base44.entities.TopicEditSuggestion.update(suggestionId, {
          [vote === 'pro' ? 'proVotes' : 'conVotes']: (suggestion[vote === 'pro' ? 'proVotes' : 'conVotes'] || 0) + 1
        });

        // Award points for pro vote
        if (vote === 'pro' && document.gamificationEnabled) {
          const suggestionCreatorList = await base44.entities.User.filter({ email: suggestion.created_by });
          if (suggestionCreatorList.length > 0) {
            const suggestionCreator = suggestionCreatorList[0];
            const freshUser = await base44.entities.User.filter({ id: suggestionCreator.id }).then(u => u[0]);
            if (freshUser) {
              const newPoints = (freshUser.points || 1000) + 10;
              await base44.entities.User.update(freshUser.id, { points: newPoints });
              
              await base44.entities.PointsTransaction.create({
                userId: suggestionCreator.id,
                amount: 10,
                action: 'vote_received',
                description: `קיבל הצבעה בעד על הצעת עריכת כותרת`,
                relatedEntityType: 'topic'
              });
            }
          }
        }
      }

      // Check consensus and auto-accept
      const delta = updatedSuggestion.proVotes - updatedSuggestion.conVotes;
      if (delta >= document.threshold) {
        // Get current topic for version tracking
        const currentTopic = topics.find(t => t.id === suggestion.topicId);
        
        // Accept suggestion - update topic title
        await base44.entities.Topic.update(suggestion.topicId, {
          title: suggestion.newTitle
        });
        
        await base44.entities.TopicEditSuggestion.update(suggestionId, {
          status: 'accepted'
        });

        // Award points to creator
        if (document.gamificationEnabled) {
          const suggestionCreatorList = await base44.entities.User.filter({ email: suggestion.created_by });
          if (suggestionCreatorList.length > 0) {
            const suggestionCreator = suggestionCreatorList[0];
            const freshUser = await base44.entities.User.filter({ id: suggestionCreator.id }).then(u => u[0]);
            if (freshUser) {
              const newPoints = (freshUser.points || 1000) + 100;
              await base44.entities.User.update(freshUser.id, { points: newPoints });
              
              await base44.entities.PointsTransaction.create({
                userId: suggestionCreator.id,
                amount: 100,
                action: 'suggestion_accepted',
                description: `ההצעה שלך לעריכת כותרת נושא התקבלה`,
                relatedEntityType: 'topic'
              });
            }
          }
        }

        queryClient.invalidateQueries({ queryKey: ['topics', document.id] });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topicEditSuggestions'] });
      queryClient.invalidateQueries({ queryKey: ['topicEditVotes'] });
    },
  });

  return (
    <>
      <EditTopicModal
        isOpen={!!editingTopic}
        onClose={() => setEditingTopic(null)}
        topic={editingTopic}
        document={document}
        user={user}
        isAdmin={isAdmin}
      />
      
      <DragDropContext onDragEnd={handleTopicDragEnd}>
        <Droppable droppableId="topics" isDropDisabled={!isAdmin}>
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4 md:space-y-6 w-full overflow-x-hidden">
            {topics.map((topic, topicIndex) => {
              const topicSections = getSectionsForTopic(topic.id);
              
              return (
                <Draggable key={topic.id} draggableId={`topic-${topic.id}`} index={topicIndex} isDragDisabled={!isAdmin}>
                  {(topicProvided, topicSnapshot) => (
                    <div
                      ref={topicProvided.innerRef}
                      {...topicProvided.draggableProps}
                      className={topicSnapshot.isDragging ? 'opacity-70' : ''}
                    >
                      <Card className="bg-white border-slate-200 w-full overflow-hidden">
                        <CardHeader className="border-b border-slate-100 p-4 md:p-6 relative">
                          {isAdmin && (
                            <>
                              <div 
                                {...topicProvided.dragHandleProps}
                                className="absolute top-2 right-2 z-10 p-1 bg-white rounded border border-slate-300 cursor-move hover:bg-slate-50 transition-colors"
                              >
                                <GripVertical className="w-5 h-5 text-slate-400" />
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteTopic(topic.id, topic.title)}
                                className="absolute top-2 left-2 z-10 text-red-600 hover:text-red-700 hover:bg-red-50 p-1 h-8 w-8"
                                title="מחק נושא"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          <div className={`flex flex-col md:flex-row justify-between md:items-center gap-3 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
                            <div className={`flex-1 min-w-0 flex items-center gap-2 ${isRTL ? 'justify-end' : ''}`}>
                  <CardTitle className={`text-lg md:text-2xl break-words ${isRTL ? 'text-right' : 'text-left'}`}>
                    {(() => {
                      const translatedTitle = topic.translations?.[language]?.title;
                      if (showTranslatedTopics[topic.id] && typeof translatedTitle === 'string') {
                        return translatedTitle;
                      }
                      return topic.title;
                    })()}
                  </CardTitle>
                  {topic.originalLanguage && language && topic.originalLanguage !== language && (
                    translateTopicMutation.isPending && translateTopicMutation.variables?.id === topic.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600 flex-shrink-0" />
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (showTranslatedTopics[topic.id] && topic.translations?.[language]) {
                            setShowTranslatedTopics(prev => ({ ...prev, [topic.id]: false }));
                          } else if (topic.translations?.[language]) {
                            setShowTranslatedTopics(prev => ({ ...prev, [topic.id]: true }));
                          } else {
                            translateTopicMutation.mutate(topic);
                          }
                        }}
                        className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex-shrink-0"
                        title={showTranslatedTopics[topic.id] && topic.translations?.[language] ? `${languageNames[topic.originalLanguage || 'he']} (מקור)` : `תרגם ל${languageNames[language]}`}
                      >
                        <Languages className="w-4 h-4" />
                      </Button>
                    )
                  )}
                </div>
                <div className="flex gap-2">
                  {user && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingTopic(topic)}
                      className="text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                      title="הצע עריכה לכותרת"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  )}
                  {user && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNewSection(topic.id)}
                      className="w-full md:w-auto"
                    >
                      <Plus className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                      {t('addSection')}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-6 space-y-3 md:space-y-4 overflow-x-hidden">
              {/* Topic Edit Suggestions */}
              {getTopicEditSuggestions(topic.id).map((suggestion) => {
                const userVote = getUserTopicVote(suggestion.id);
                const delta = suggestion.proVotes - suggestion.conVotes;
                const votesNeeded = Math.max(0, document.threshold - delta);

                return (
                  <div key={suggestion.id} className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <Badge className="bg-amber-500 text-white mb-2">
                          הצעת עריכה לכותרת
                        </Badge>
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm text-slate-600">כותרת מוצעת:</span>
                            <p className="font-semibold text-slate-900">{suggestion.newTitle}</p>
                          </div>
                          {suggestion.explanation && (
                            <div>
                              <span className="text-sm text-slate-600">הסבר:</span>
                              <p className="text-sm text-slate-700">{suggestion.explanation}</p>
                            </div>
                          )}
                          <div className="text-xs text-slate-500">
                            {t('by')} {getUserName(suggestion.created_by)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Voting */}
                    {document.votingButtonsEnabled && user && (
                      <div className="flex items-center gap-3 pt-3 border-t border-amber-200">
                        <Button
                          size="sm"
                          variant={userVote?.vote === 'pro' ? 'default' : 'outline'}
                          onClick={() => voteTopicEditMutation.mutate({ 
                            suggestionId: suggestion.id, 
                            vote: 'pro',
                            currentVote: userVote
                          })}
                          disabled={voteTopicEditMutation.isPending}
                          className={userVote?.vote === 'pro' ? 'bg-green-600 hover:bg-green-700' : ''}
                        >
                          <ThumbsUp className="w-4 h-4 mr-1" />
                          {suggestion.proVotes || 0}
                        </Button>
                        <Button
                          size="sm"
                          variant={userVote?.vote === 'con' ? 'default' : 'outline'}
                          onClick={() => voteTopicEditMutation.mutate({ 
                            suggestionId: suggestion.id, 
                            vote: 'con',
                            currentVote: userVote
                          })}
                          disabled={voteTopicEditMutation.isPending}
                          className={userVote?.vote === 'con' ? 'bg-red-600 hover:bg-red-700' : ''}
                        >
                          <ThumbsDown className="w-4 h-4 mr-1" />
                          {suggestion.conVotes || 0}
                        </Button>
                        <div className="text-sm text-slate-600">
                          {votesNeeded > 0 ? (
                            <span>נדרשים עוד {votesNeeded} תומכים</span>
                          ) : (
                            <span className="text-green-600 font-semibold">✓ עבר את סף הקונסנזוס</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {topicSections.length === 0 ? (
                <>
                  <div className="text-center py-6 md:py-8 text-slate-500 text-sm md:text-base">
                    {t('noSectionsYet')}
                  </div>
                  {/* Show new section suggestions when there are no sections */}
                  {getNewSectionSuggestionsForTopic(topic.id).map((suggestion) => (
                    <NewSectionSuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      document={document}
                      getUserName={getUserName}
                      acceptedSuggestions={suggestions.filter(s => s.status === 'accepted')}
                      user={user}
                      getUserVote={getUserVote}
                      voteMutation={voteMutation}
                    />
                  ))}
                </>
              ) : (
                <DragDropContext onDragEnd={(result) => handleSectionDragEnd(result, topic.id)}>
                  <Droppable droppableId={`sections-${topic.id}`} isDropDisabled={!isAdmin}>
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3 md:space-y-4">
                        {topicSections.map((section, index) => {
                  const newSectionSuggestions = getNewSectionSuggestionsForTopic(topic.id);
                  const sectionSuggestions = getSuggestionsForSection(section.id);
                  
                  return (
                    <Draggable key={section.id} draggableId={section.id} index={index} isDragDisabled={!isAdmin}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={snapshot.isDragging ? 'opacity-70' : ''}
                        >
                          <React.Fragment>
                            {/* Show new section suggestions that should appear at this position */}
                            {index === 0 && newSectionSuggestions
                              .filter(s => (s.insertPosition === undefined || s.insertPosition === null || s.insertPosition === 0))
                              .map((suggestion) => (
                                <NewSectionSuggestionCard
                                  key={suggestion.id}
                                  suggestion={suggestion}
                                  document={document}
                                  getUserName={getUserName}
                                  acceptedSuggestions={suggestions.filter(s => s.status === 'accepted')}
                                  user={user}
                                  getUserVote={getUserVote}
                                  voteMutation={voteMutation}
                                />
                              ))}

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
                                      <Plus className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                                      {t('insertSectionHere')}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          <div className="space-y-3 relative group/section">
                            {user && index === 0 && (
                              <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover/section:opacity-100 transition-opacity">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onNewSection(topic.id, 0)}
                                  className="bg-white shadow-md border-blue-300 text-blue-600 hover:bg-blue-50"
                                >
                                  <Plus className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                                  {t('insertSectionHere')}
                                </Button>
                              </div>
                            )}
                            {isAdmin && (
                              <div 
                                {...provided.dragHandleProps}
                                className="absolute top-2 left-2 z-10 p-1 bg-white rounded border border-slate-300 cursor-move hover:bg-slate-50 transition-colors"
                              >
                                <GripVertical className="w-4 h-4 text-slate-400" />
                              </div>
                            )}
                            <SectionCarousel
                              section={section}
                              pendingSuggestions={sectionSuggestions}
                              document={document}
                              user={user}
                              onEditSection={onEditSection}
                              onDirectEdit={onDirectEdit}
                              toggleComments={toggleComments}
                              showComments={showComments}
                              getCommentsCount={getCommentsCount}
                              getUserVote={getUserVote}
                              voteMutation={voteMutation}
                              getUserName={getUserName}
                              acceptedSuggestions={suggestions.filter(s => s.status === 'accepted')}
                              sectionIndex={index}
                              isAdmin={isAdmin}
                              users={users}
                            />
                          </div>
                            {/* Show suggestions at the end */}
                            {index === topicSections.length - 1 && (
                              <>
                                {newSectionSuggestions
                                    .filter(s => (s.insertPosition || 999) > index)
                                    .map((suggestion) => (
                                      <NewSectionSuggestionCard
                                        key={suggestion.id}
                                        suggestion={suggestion}
                                        document={document}
                                        getUserName={getUserName}
                                        acceptedSuggestions={suggestions.filter(s => s.status === 'accepted')}
                                        user={user}
                                        getUserVote={getUserVote}
                                        voteMutation={voteMutation}
                                      />
                                    ))}
                              </>
                            )}

                            {index === topicSections.length - 1 && user && (
                              <>
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
                                <div className="opacity-0 group-hover/section:opacity-100 transition-opacity absolute -bottom-4 left-1/2 -translate-x-1/2 z-10">
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
                              </>
                            )}
                          </React.Fragment>
                        </div>
                      )}
                    </Draggable>
                    );
                    })}
                    {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
                    )}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}

            {topics.length === 0 && (
              <Card className="bg-white border-slate-200 w-full overflow-hidden">
                <CardContent className="p-6 md:p-12 text-center">
                  <p className="text-slate-500 text-sm md:text-base">{t('noTopicsYet')}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </Droppable>
    </DragDropContext>
    </>
  );
}