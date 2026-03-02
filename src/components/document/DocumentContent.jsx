import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ensureUserPublicProfile } from "@/components/ensureUserPublicProfile";
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
import DeleteSectionSuggestionCard from "./DeleteSectionSuggestionCard";
import EditTopicModal from "./EditTopicModal";
import TopicTitleCarousel from "./TopicTitleCarousel";

import { useLanguage } from "@/components/LanguageContext";
import { autoAcceptTopicEditSuggestion, checkTopicEditConsensus } from "./suggestionAutoAccept";
import { votingQueue } from "./VotingQueue";
import { useVoteMutation } from "./hooks/useVoteMutation";
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
  onDirectEdit,
  onOpenSuggestionSidebar,
  newlyCreatedSuggestion,
  onClearNewlyCreated,
  targetSuggestionId,
  onEditSuggestion
}) {
  const [showComments, setShowComments] = useState({});
  const [showTranslatedTopics, setShowTranslatedTopics] = useState({});
  const [editingTopic, setEditingTopic] = useState(null);
  const [autoAcceptingIds, setAutoAcceptingIds] = useState({});
  const queryClient = useQueryClient();
  const { t, isRTL, language: rawLanguage } = useLanguage();
  const language = rawLanguage || 'he';

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

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const { data: publicProfiles } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
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

  // מעקב לשימוש ב-hook של הצבעה
  const hasCheckedRef = React.useRef(new Set());

  // Scroll to newly created suggestion
  React.useEffect(() => {
    if (newlyCreatedSuggestion?.suggestionId && typeof window !== 'undefined') {
      const { suggestionId } = newlyCreatedSuggestion;
      
      const scrollToElement = () => {
        const element = window.document.getElementById(`suggestion-${suggestionId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-4', 'ring-green-500', 'ring-offset-4', 'bg-green-50');
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-green-500', 'ring-offset-4', 'bg-green-50');
            onClearNewlyCreated();
          }, 3000);
          return true;
        }
        return false;
      };
      
      // נסה מספר פעמים עד שנמצא את האלמנט
      let attempts = 0;
      const maxAttempts = 10;
      const tryScroll = () => {
        if (scrollToElement() || attempts >= maxAttempts) {
          return;
        }
        attempts++;
        setTimeout(tryScroll, 500);
      };
      
      setTimeout(tryScroll, 300);
    }
  }, [newlyCreatedSuggestion, onClearNewlyCreated, suggestions, topics]);

  // Auto-accept for section suggestions is handled entirely by the backend (voteOnSuggestion → processAcceptance).
  // Frontend only handles topic-edit suggestions auto-accept (no backend equivalent for those).
  React.useEffect(() => {
    if (!document || !topicEditSuggestions || topicEditSuggestions.length === 0) return;

    const checkTopicSuggestions = async () => {
      for (const topicSuggestion of topicEditSuggestions) {
        if (topicSuggestion.status !== 'pending') continue;

        const checkKey = `topic-${topicSuggestion.id}-${topicSuggestion.proVotes}-${topicSuggestion.conVotes}`;
        if (hasCheckedRef.current.has(checkKey)) continue;
        hasCheckedRef.current.add(checkKey);

        try {
          const { shouldAccept } = await checkTopicEditConsensus(topicSuggestion, document);
          if (shouldAccept) {
            console.log('[AUTO-ACCEPT TOPIC] Auto-accepting topic suggestion:', topicSuggestion.id);
            const acceptingUserId = user?.id || topicSuggestion.created_by;
            const accepted = await autoAcceptTopicEditSuggestion(topicSuggestion, acceptingUserId, document);
            if (accepted) {
              Promise.all([
                queryClient.invalidateQueries({ queryKey: ['topics', document.id] }),
                queryClient.invalidateQueries({ queryKey: ['topicEditSuggestions', document.id] }),
                queryClient.invalidateQueries({ queryKey: ['document', document.id] })
              ]);
            }
          }
        } catch (err) {
          console.error('[AUTO-ACCEPT TOPIC] Error:', err);
          hasCheckedRef.current.delete(checkKey);
        }
      }

      if (hasCheckedRef.current.size > 100) {
        hasCheckedRef.current.clear();
      }
    };

    checkTopicSuggestions();
  }, [topicEditSuggestions, document, user, queryClient]);

  // Fetch all comments for this document's suggestions and sections to show counts
  const { data: allDocumentComments = [] } = useQuery({
    queryKey: ['allDocumentComments', document?.id],
    queryFn: async () => {
      const suggestionIds = suggestions.map(s => s.id);
      const sectionIds = sections.map(s => s.id);
      return await base44.entities.Comment.filter({
        $or: [
          { rootEntityType: 'suggestion', rootEntityId: { $in: suggestionIds } },
          { rootEntityType: 'section', rootEntityId: { $in: sectionIds } },
        ]
      });
    },
    enabled: !!document?.id && suggestions.length > 0,
    initialData: [],
    staleTime: 60 * 1000,
  });

  const getCommentsCount = React.useCallback((entityType, entityId) => {
    return allDocumentComments.filter(
      c => c.rootEntityType === entityType && c.rootEntityId === entityId
    ).length;
  }, [allDocumentComments]);

  const { data: userVotes = [] } = useQuery({
    queryKey: ['userVotes', document?.id, user?.id],
    queryFn: async () => {
      if (!user?.id || !document?.id) return [];
      try {
        const allVotes = await base44.entities.Vote.filter({ userId: user.id });
        // מחזיר רק הצבעות על הצעות במסמך הזה
        const relevantVotes = allVotes.filter(v => 
          suggestions.some(s => s.id === v.suggestionId)
        );
        // מסיר כפילויות - שומר רק את ההצבעה האחרונה לכל הצעה
        const uniqueVotes = [];
        const seenSuggestionIds = new Set();
        for (const vote of relevantVotes.reverse()) {
          if (!seenSuggestionIds.has(vote.suggestionId)) {
            seenSuggestionIds.add(vote.suggestionId);
            uniqueVotes.push(vote);
          }
        }
        return uniqueVotes;
      } catch (err) {
        console.error('[USER VOTES QUERY ERROR]', err);
        return [];
      }
    },
    enabled: !!user?.id && !!document?.id && suggestions.length > 0,
    staleTime: 0,
    retry: 1,
  });

  const getUserVote = React.useCallback((suggestionId) => {
    // מחזיר את ההצבעה האחרונה עבור ההצעה הספציפית
    const votesForSuggestion = userVotes?.filter(v => v.suggestionId === suggestionId) || [];
    // אם יש כפילויות (לא אמור לקרות), נחזיר את האחרונה
    return votesForSuggestion[votesForSuggestion.length - 1] || null;
  }, [userVotes]);



  // Use optimized vote hook
  const voteMutation = useVoteMutation(document, user, suggestions, hasCheckedRef);
      


  const getUserName = React.useCallback((email) => {
    // Try public profile first (accessible to everyone)
    const profile = publicProfiles?.find(p => p.email === email);
    if (profile?.fullName) return profile.fullName;
    
    // Fallback to User entity (admins only)
    const user = users?.find(u => u.email === email);
    if (user?.full_name) return user.full_name;
    
    // User hasn't completed profile yet
    return 'User';
  }, [publicProfiles, users]);

  const toggleComments = React.useCallback((id) => {
    setShowComments(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  }, []);

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

  const getSectionsForTopic = React.useCallback((topicId) => {
    return sections.filter(s => s.topicId === topicId).sort((a, b) => a.order - b.order);
  }, [sections]);

  const getSuggestionsForSection = React.useCallback((sectionId) => {
    return suggestions.filter(s => 
      s.sectionId === sectionId && 
      (s.type === 'edit_section' || s.type === 'delete_section') && 
      s.status === 'pending'
    );
  }, [suggestions]);

  const getNewSectionSuggestionsForTopic = React.useCallback((topicId) => {
    return suggestions.filter(s => {
      // רק הצעות לסעיפים חדשים שהן ROOT (אין להן parent)
      if (s.type !== 'new_section') return false;
      if (s.parentSuggestionId) return false; // דלג על הצעות עריכה - נציג אותן בקרוסלה
      
      // דלג על הצעות שכבר התקבלו והסעיף נוצר (בודקים את ה-type שהוא עכשיו edit_section)
      // כאשר new_section מתקבלת, היא הופכת ל-edit_section, לכן לא צריכה להופיע כאן
      if (s.status === 'accepted' && s.type === 'edit_section') return false;
      
      // דלג גם על pending שכבר יש להן sectionId (הסעיף נוצר אבל הן עדיין pending)
      if (s.type === 'new_section' && s.sectionId) return false;
      
      // אם ההצעה מיועדת לנושא קיים - בדוק לפי topicId
      if (s.topicId) {
        return s.topicId === topicId;
      }
      
      // אם ההצעה מיועדת לנושא חדש שעדיין לא נוצר - לא מציגים אותה בשום נושא
      return false;
    }).sort((a, b) => (a.insertPosition || 999) - (b.insertPosition || 999));
  }, [suggestions]);

  // פונקציה נפרדת להצעות לנושאים חדשים שעדיין לא נוצרו
  const getNewTopicSuggestions = React.useCallback(() => {
    return suggestions.filter(s => {
      // רק הצעות new_section (לא edit_section)
      if (s.type !== 'new_section') return false;
      // לא topicId - כלומר נושא חדש
      if (s.topicId) return false;
      // חייב newTopicTitle
      if (!s.newTopicTitle) return false;
      // רק ROOT suggestions
      if (s.parentSuggestionId) return false;
      // רק pending או accepted שעדיין לא נוצר הסעיף
      if (s.status === 'accepted' && s.type === 'edit_section') return false;
      if (s.sectionId) return false;
      
      return true;
    }).sort((a, b) => (a.newTopicOrder || 999) - (b.newTopicOrder || 999));
  }, [suggestions]);

  // פונקציה להצעות נושאים חדשים שצריכות להופיע אחרי נושא מסוים
  const getNewTopicSuggestionsAfterTopic = React.useCallback((topicOrder) => {
    const newTopicSuggestions = getNewTopicSuggestions();
    return newTopicSuggestions.filter(s => 
      s.newTopicOrder !== undefined && 
      s.newTopicOrder !== null && 
      s.newTopicOrder === topicOrder + 1
    );
  }, [getNewTopicSuggestions]);

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

  const getTopicEditSuggestions = React.useCallback((topicId) => {
    return topicEditSuggestions.filter(s => s.topicId === topicId && s.status === 'pending');
  }, [topicEditSuggestions]);

  const getUserTopicVote = React.useCallback((suggestionId) => {
    return topicEditVotes?.find(v => v.suggestionId === suggestionId);
  }, [topicEditVotes]);

  // מעקב אחרי הצבעות על כותרות נושאים למניעת race conditions
  const topicVotingInProgressRef = React.useRef(new Set());
  
  const voteTopicEditMutation = useMutation({
    mutationFn: async ({ suggestionId, vote, currentVote }) => {
      if (!user) throw new Error("יש להתחבר כדי להצביע");

      // מניעת הצבעות כפולות על אותה הצעה
      if (topicVotingInProgressRef.current.has(suggestionId)) {
        console.log('[TOPIC VOTE] Already voting on this suggestion, ignoring');
        throw new Error("ההצבעה בתהליך, אנא המתן");
      }
      topicVotingInProgressRef.current.add(suggestionId);

      try {
        const topicSuggestion = topicEditSuggestions.find(s => s.id === suggestionId);
        
        // שלב 1: קריאת המצב העדכני מהשרת (source of truth)
        const [freshVotes, freshSuggestions] = await Promise.all([
          base44.entities.TopicEditVote.filter({ suggestionId, userId: user.id }),
          base44.entities.TopicEditSuggestion.filter({ id: suggestionId })
        ]);
        
        const serverVote = freshVotes[0];
        const freshSuggestion = freshSuggestions[0];
        
        if (!freshSuggestion) {
          throw new Error("ההצעה לא נמצאה");
        }
        
        let newProVotes = freshSuggestion.proVotes || 0;
        let newConVotes = freshSuggestion.conVotes || 0;
        let updatedSuggestion;

        if (serverVote) {
          if (serverVote.vote === vote) {
            // Canceling vote
            await base44.entities.TopicEditVote.delete(serverVote.id);
            if (vote === 'pro') newProVotes = Math.max(0, newProVotes - 1);
            else newConVotes = Math.max(0, newConVotes - 1);
          } else {
            // Changing vote
            await base44.entities.TopicEditVote.update(serverVote.id, { vote });
            if (vote === 'pro') {
              newProVotes += 1;
              newConVotes = Math.max(0, newConVotes - 1);
            } else {
              newConVotes += 1;
              newProVotes = Math.max(0, newProVotes - 1);
            }
          }
        } else {
          // בדיקה כפולה לפני יצירת הצבעה חדשה
          const doubleCheck = await base44.entities.TopicEditVote.filter({ suggestionId, userId: user.id });
          if (doubleCheck.length > 0) {
            const existingVote = doubleCheck[0];
            if (existingVote.vote !== vote) {
              await base44.entities.TopicEditVote.update(existingVote.id, { vote });
              if (vote === 'pro') {
                newProVotes += 1;
                newConVotes = Math.max(0, newConVotes - 1);
              } else {
                newConVotes += 1;
                newProVotes = Math.max(0, newProVotes - 1);
              }
            } else {
              await base44.entities.TopicEditVote.delete(existingVote.id);
              if (vote === 'pro') newProVotes = Math.max(0, newProVotes - 1);
              else newConVotes = Math.max(0, newConVotes - 1);
            }
          } else {
            // באמת הצבעה חדשה
            await base44.entities.TopicEditVote.create({
              suggestionId,
              userId: user.id,
              vote
            });
            
            // Ensure UserPublicProfile exists for display
            await ensureUserPublicProfile(user);
            
            if (vote === 'pro') newProVotes += 1;
            else newConVotes += 1;

            // Award points for pro vote
            if (vote === 'pro' && document.gamificationEnabled && topicSuggestion) {
              const suggestionCreatorList = await base44.entities.User.filter({ email: topicSuggestion.created_by });
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
        }
        
        // עדכון ההצעה עם הערכים החדשים
        updatedSuggestion = await base44.entities.TopicEditSuggestion.update(suggestionId, {
          proVotes: newProVotes,
          conVotes: newConVotes
        });

      // Check consensus and auto-accept - שימוש בחישוב דינמי של הסף
      const delta = updatedSuggestion.proVotes - updatedSuggestion.conVotes;
      const consensuses = document.consensuses || [];
      const totalUsers = document.totalUsersInteracted || 1;
      let dynamicThreshold;
      if (consensuses.length > 0) {
        const consensusMeterAverage = consensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / consensuses.length;
        dynamicThreshold = Math.max(2, Math.round(consensusMeterAverage * totalUsers));
      } else {
        dynamicThreshold = Math.max(2, document.threshold || 2);
      }
      
      if (delta >= dynamicThreshold && topicSuggestion) {
        // Get current topic for version tracking
        const currentTopic = topics.find(t => t.id === topicSuggestion.topicId);
        
        // Accept suggestion - update topic title
        await base44.entities.Topic.update(topicSuggestion.topicId, {
          title: topicSuggestion.newTitle
        });
        
        // שינויי כותרות נושאים לא נספרים במד הקונצנזוס - רק עריכות תוכן סעיפים
        console.log('[TOPIC VOTE ACCEPTANCE] Skipping consensus meter update for topic title changes');
        
        await base44.entities.TopicEditSuggestion.update(suggestionId, {
          status: 'accepted'
        });

        // Award points to creator
        if (document.gamificationEnabled) {
          const suggestionCreatorList = await base44.entities.User.filter({ email: topicSuggestion.created_by });
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

        // Show success notification immediately
        toast.success('🎉 ההצעה לעריכת כותרת התקבלה!', {
          description: 'הכותרת עודכנה במסמך',
          duration: 4000,
        });
        
        // Refresh all relevant queries in parallel - don't await
        Promise.all([
          queryClient.invalidateQueries({ queryKey: ['topics', document.id] }),
          queryClient.invalidateQueries({ queryKey: ['topicEditSuggestions', document.id] }),
          queryClient.invalidateQueries({ queryKey: ['document', document.id] }),
          queryClient.invalidateQueries({ queryKey: ['allVersions'] }),
          queryClient.invalidateQueries({ queryKey: ['versions', document.id] })
        ]);
      }
      } catch (err) {
        throw err;
      } finally {
        // מסירים מהרשימה אחרי שהפעולה הסתיימה
        topicVotingInProgressRef.current.delete(suggestionId);
      }
    },
    onSuccess: () => {
      // רענון מיידי במקביל
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['topicEditSuggestions'] }),
        queryClient.invalidateQueries({ queryKey: ['topicEditVotes'] })
      ]);
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
                        <CardHeader className="border-b border-slate-100 p-4 md:p-6">
                          <div className={`flex items-start gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            {/* Drag handle - only for admin */}
                            {isAdmin && (
                              <div 
                                {...topicProvided.dragHandleProps}
                                className="p-1 bg-white rounded border border-slate-300 cursor-move hover:bg-slate-50 transition-colors flex-shrink-0 mt-1"
                              >
                                <GripVertical className="w-5 h-5 text-slate-400" />
                              </div>
                            )}
                            
                            {/* Title with carousel for suggestions */}
                            <div className="flex-1 min-w-0">
                              <TopicTitleCarousel
                                topic={topic}
                                topicEditSuggestions={getTopicEditSuggestions(topic.id)}
                                document={document}
                                user={user}
                                getUserTopicVote={getUserTopicVote}
                                voteTopicEditMutation={voteTopicEditMutation}
                                getUserName={getUserName}
                                isAdmin={isAdmin}
                                users={users}
                                publicProfiles={publicProfiles}
                                showTranslatedTopics={showTranslatedTopics}
                                setShowTranslatedTopics={setShowTranslatedTopics}
                                translateTopicMutation={translateTopicMutation}
                                setEditingTopic={setEditingTopic}
                                language={language}
                                isRTL={isRTL}
                              />
                            </div>
                            
                            {/* Action buttons - fixed on the side */}
                            <div className={`flex items-center gap-1 flex-shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              {/* Translate button - always visible */}
                              {translateTopicMutation.isPending && translateTopicMutation.variables?.id === topic.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-blue-600 flex-shrink-0" />
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (showTranslatedTopics[topic.id] && topic.translations?.[language]?.title) {
                                      setShowTranslatedTopics(prev => ({ ...prev, [topic.id]: false }));
                                    } else if (topic.translations?.[language]?.title) {
                                      setShowTranslatedTopics(prev => ({ ...prev, [topic.id]: true }));
                                    } else {
                                      translateTopicMutation.mutate(topic);
                                    }
                                  }}
                                  className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  title={showTranslatedTopics[topic.id] ? t('showOriginal') : t('translate')}
                                >
                                  <Languages className="w-4 h-4" />
                                </Button>
                              )}
                              
                              {/* Edit button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (!user) {
                                    base44.auth.redirectToLogin(window.location.href);
                                    return;
                                  }
                                  setEditingTopic(topic);
                                }}
                                className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                                title="הצע עריכה לכותרת"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              
                              {/* Delete button - only for admin */}
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteTopic(topic.id, topic.title)}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title="מחק נושא"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
            <CardContent className="p-3 md:p-6 space-y-3 md:space-y-4 overflow-x-hidden">

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
                     onOpenSidebar={onOpenSuggestionSidebar}
                     getCommentsCount={getCommentsCount}
                     toggleComments={toggleComments}
                     showComments={showComments}
                     isAdmin={isAdmin}
                     onEditSuggestion={onEditSuggestion}
                     allDocumentSuggestions={suggestions}
                     isAutoAccepting={!!autoAcceptingIds[suggestion.id]}
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
                        const allSectionSuggestions = getSuggestionsForSection(section.id);
                  
                  return (
                    <Draggable key={section.id} draggableId={section.id} index={index} isDragDisabled={!isAdmin}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={snapshot.isDragging ? 'opacity-70' : ''}
                        >
                          <React.Fragment>
                            {/* Show new section suggestions that should appear before this section */}
                            {newSectionSuggestions
                              .filter(s => {
                                const pos = s.insertPosition;
                                // Show suggestions with insertPosition matching this section's order
                                return pos !== undefined && pos !== null && pos === section.order;
                              })
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
                                  onOpenSidebar={onOpenSuggestionSidebar}
                                  getCommentsCount={getCommentsCount}
                                  toggleComments={toggleComments}
                                  showComments={showComments}
                                  isAdmin={isAdmin}
                                  onEditSuggestion={onEditSuggestion}
                                  allDocumentSuggestions={suggestions}
                                  isAutoAccepting={!!autoAcceptingIds[suggestion.id]}
                                  targetSuggestionId={targetSuggestionId}
                                />
                              ))}

                            {index > 0 && (
                              <div className="group relative h-4 flex items-center justify-center -my-2 -mb-4 z-10">
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="h-full flex items-center justify-center">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        if (!user) {
                                          base44.auth.redirectToLogin(window.location.href);
                                          return;
                                        }
                                        onNewSection(topic.id, section.order);
                                      }}
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
                            {index === 0 && (
                              <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover/section:opacity-100 transition-opacity">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (!user) {
                                      base44.auth.redirectToLogin(window.location.href);
                                      return;
                                    }
                                    onNewSection(topic.id, section.order);
                                  }}
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
                              pendingSuggestions={allSectionSuggestions}
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
                              onOpenSuggestionSidebar={onOpenSuggestionSidebar}
                              newlyCreatedSuggestionId={newlyCreatedSuggestion?.sectionId === section.id ? newlyCreatedSuggestion?.suggestionId : null}
                              onClearNewlyCreated={onClearNewlyCreated}
                              targetSuggestionId={targetSuggestionId}
                              publicProfiles={publicProfiles}
                              allDocumentSuggestions={suggestions}
                            />
                          </div>
                            {/* Show suggestions after the last section */}
                            {index === topicSections.length - 1 && (
                              <>
                                {newSectionSuggestions
                                    .filter(s => {
                                      const pos = s.insertPosition;
                                      // Show suggestions with insertPosition > last section order, or undefined/null (default to end)
                                      return (pos !== undefined && pos !== null && pos > section.order) || (pos === undefined || pos === null);
                                    })
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
                                                      onOpenSidebar={onOpenSuggestionSidebar}
                                                      getCommentsCount={getCommentsCount}
                                                      toggleComments={toggleComments}
                                                      showComments={showComments}
                                                      isAdmin={isAdmin}
                                                      onEditSuggestion={onEditSuggestion}
                                                      allDocumentSuggestions={suggestions}
                                                      targetSuggestionId={targetSuggestionId}
                                                    />
                                    ))}
                              </>
                            )}

                            {index === topicSections.length - 1 && (
                              <>
                                <div className="group relative h-4 flex items-center justify-center mt-2">
                                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="h-full flex items-center justify-center">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          if (!user) {
                                            base44.auth.redirectToLogin(window.location.href);
                                            return;
                                          }
                                          onNewSection(topic.id, section.order + 1);
                                        }}
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
                                    onClick={() => {
                                      if (!user) {
                                        base44.auth.redirectToLogin(window.location.href);
                                        return;
                                      }
                                      onNewSection(topic.id, section.order + 1);
                                    }}
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

                      {/* הצעות לנושאים חדשים שאמורות להופיע אחרי נושא זה */}
                      {getNewTopicSuggestionsAfterTopic(topic.order).map((suggestion) => (
                        <Card key={suggestion.id} className="bg-white border-slate-200 w-full overflow-hidden mt-4">
                          <CardHeader className="border-b border-slate-100 p-4 md:p-6 bg-purple-50">
                            <div className={`flex items-start gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              <CardTitle className={`text-lg md:text-2xl break-words flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                                {suggestion.newTopicTitle} <Badge className="ml-2 bg-purple-600 text-white">נושא חדש מוצע</Badge>
                              </CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent className="p-3 md:p-6 space-y-3 md:space-y-4 overflow-x-hidden">
                            <NewSectionSuggestionCard
                              suggestion={suggestion}
                              document={document}
                              getUserName={getUserName}
                              acceptedSuggestions={suggestions.filter(s => s.status === 'accepted')}
                              user={user}
                              getUserVote={getUserVote}
                              voteMutation={voteMutation}
                              onOpenSidebar={onOpenSuggestionSidebar}
                              getCommentsCount={getCommentsCount}
                              toggleComments={toggleComments}
                              showComments={showComments}
                              isAdmin={isAdmin}
                              onEditSuggestion={onEditSuggestion}
                              allDocumentSuggestions={suggestions}
                              isAutoAccepting={!!autoAcceptingIds[suggestion.id]}
                              targetSuggestionId={targetSuggestionId}
                            />
                            </CardContent>
                            </Card>
                            ))}
                            </div>
                            )}
                            </Draggable>
                            );
                            })}
                            {provided.placeholder}

                            {/* הצעות לנושאים חדשים בסוף (שלא שויכו לנושא מסוים) */}
                            {getNewTopicSuggestions()
                            .filter(s => {
                            // אם אין newTopicOrder - הצג בסוף
                            if (!s.newTopicOrder && s.newTopicOrder !== 0) return true;

                            // אם יש נושאים - הצג רק הצעות שמעבר לנושא האחרון
                            if (topics.length > 0) {
                            const maxTopicOrder = Math.max(...topics.map(t => t.order));
                            // הצג רק אם newTopicOrder גדול מ-maxTopicOrder+1 (כלומר לא מוצג אחרי נושא קיים)
                            return s.newTopicOrder > maxTopicOrder + 1;
                            }

                            // אם אין נושאים - הצג הכל
                            return true;
                            })
                            .map((suggestion) => (
                            <Card key={suggestion.id} className="bg-white border-slate-200 w-full overflow-hidden">
                            <CardHeader className="border-b border-slate-100 p-4 md:p-6 bg-purple-50">
                            <div className={`flex items-start gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <CardTitle className={`text-lg md:text-2xl break-words flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                            {suggestion.newTopicTitle} <Badge className="ml-2 bg-purple-600 text-white">נושא חדש מוצע</Badge>
                            </CardTitle>
                            </div>
                            </CardHeader>
                            <CardContent className="p-3 md:p-6 space-y-3 md:space-y-4 overflow-x-hidden">
                              <NewSectionSuggestionCard
                                suggestion={suggestion}
                                document={document}
                                getUserName={getUserName}
                                acceptedSuggestions={suggestions.filter(s => s.status === 'accepted')}
                                user={user}
                                getUserVote={getUserVote}
                                voteMutation={voteMutation}
                                onOpenSidebar={onOpenSuggestionSidebar}
                                getCommentsCount={getCommentsCount}
                                toggleComments={toggleComments}
                                showComments={showComments}
                                isAdmin={isAdmin}
                                onEditSuggestion={onEditSuggestion}
                                allDocumentSuggestions={suggestions}
                                isAutoAccepting={!!autoAcceptingIds[suggestion.id]}
                                targetSuggestionId={targetSuggestionId}
                              />
                            </CardContent>
                            </Card>
                            ))}

            {topics.length === 0 && getNewTopicSuggestions().length === 0 && (
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