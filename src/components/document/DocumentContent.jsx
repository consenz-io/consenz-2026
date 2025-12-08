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
import { checkSuggestionConsensus, autoAcceptSuggestion, autoAcceptTopicEditSuggestion, checkTopicEditConsensus } from "./suggestionAutoAccept";
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
  onClearNewlyCreated
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

  // Polling interval for live sync (10 seconds for better responsiveness)
  const SYNC_INTERVAL = 10000;
  
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
    refetchInterval: SYNC_INTERVAL,
    refetchIntervalInBackground: false,
  });

  const { data: topicEditVotes } = useQuery({
    queryKey: ['topicEditVotes', document?.id, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return await base44.entities.TopicEditVote.filter({ userId: user.id });
    },
    enabled: !!user?.id && !!document?.id,
    initialData: [],
    refetchInterval: SYNC_INTERVAL,
    refetchIntervalInBackground: false,
  });

  // בדיקה ואישור אוטומטי של הצעות שעברו את רף הקונסנזוס
  const hasCheckedRef = React.useRef(new Set());
  // מעקב אחרי הצעות שכבר ראינו כ-accepted כדי להציג toast רק פעם אחת
  const shownAcceptedToastsRef = React.useRef(new Set());

  React.useEffect(() => {
    if (!document || !suggestions) return;

    // בדיקה אם יש הצעות שהתקבלו שעדיין לא הצגנו עליהן toast (רק אם לא הצגנו כבר מה-optimistic update)
    suggestions.forEach(suggestion => {
      if (suggestion.status === 'accepted' && !shownAcceptedToastsRef.current.has(suggestion.id)) {
        shownAcceptedToastsRef.current.add(suggestion.id);
        // לא מציגים toast כאן - זה יגיע מה-optimistic update
      }
    });

    const checkAndAutoAccept = async () => {
      // בדיקת הצעות סעיפים שעברו את הסף אבל לא התקבלו - רק עבור edit_section
      const pendingSuggestions = suggestions.filter(s => s.status === 'pending' && s.type === 'edit_section');
      for (const suggestion of pendingSuggestions) {
        const consensuses = document.consensuses || [];
        let threshold;
        if (consensuses.length > 0) {
          const consensusMeterAverage = consensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / consensuses.length;
          threshold = Math.max(1, Math.round(consensusMeterAverage * (document.totalUsersInteracted || 1)));
        } else {
          threshold = document.threshold || 2;
        }
        const delta = (suggestion.proVotes || 0) - (suggestion.conVotes || 0);
        const shouldAccept = delta >= threshold;

        if (shouldAccept && !hasCheckedRef.current.has(`${suggestion.id}-accepted`)) {
          console.log('[AUTO-ACCEPT SECTION] Auto-accepting section suggestion:', suggestion.id);
          hasCheckedRef.current.add(`${suggestion.id}-accepted`);
          
          try {
            const acceptingUserId = user?.id || suggestion.created_by;
            const accepted = await autoAcceptSuggestion(suggestion, acceptingUserId, document);
            if (accepted) {
              // הצגת הודעה
              toast.success('🎉 ההצעה התקבלה והמסמך עודכן!', {
                duration: 4000,
              });
              
              // רענון הסעיפים אחרי 7 שניות (אחרי שהאנימציה נעלמה לגמרי)
              setTimeout(() => {
                Promise.all([
                  queryClient.invalidateQueries({ queryKey: ['sections', document.id] }),
                  queryClient.invalidateQueries({ queryKey: ['allVersions'] }),
                  queryClient.invalidateQueries({ queryKey: ['versions', document.id] })
                ]);
              }, 7000);
              
              // רענון הצעות והמסמך מיד (כדי שהאנימציה תתחיל)
              queryClient.invalidateQueries({ queryKey: ['suggestions', document.id] });
              queryClient.invalidateQueries({ queryKey: ['document', document.id] });
              queryClient.invalidateQueries({ queryKey: ['topics', document.id] });
            }
          } catch (err) {
            console.error('[AUTO-ACCEPT SECTION] Error:', err);
            hasCheckedRef.current.delete(`${suggestion.id}-accepted`);
          }
        }
      }
      
      // בדיקת הצעות עריכת כותרות נושאים
      if (topicEditSuggestions && topicEditSuggestions.length > 0) {
        for (const topicSuggestion of topicEditSuggestions) {
          if (topicSuggestion.status !== 'pending') continue;

          const checkKey = `topic-${topicSuggestion.id}-${topicSuggestion.proVotes}-${topicSuggestion.conVotes}`;
          if (hasCheckedRef.current.has(checkKey)) continue;
          hasCheckedRef.current.add(checkKey);

          try {
            const { shouldAccept, threshold } = checkTopicEditConsensus(topicSuggestion, document);

            if (shouldAccept) {
              console.log('[AUTO-ACCEPT TOPIC] Auto-accepting topic suggestion:', topicSuggestion.id);
              const acceptingUserId = user?.id || topicSuggestion.created_by;
              const accepted = await autoAcceptTopicEditSuggestion(topicSuggestion, acceptingUserId, document);
              if (accepted) {
                // רענון מיידי במקביל
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
      }

      // ניקוי תקופתי
      if (hasCheckedRef.current.size > 100) {
        hasCheckedRef.current.clear();
      }
    };

    checkAndAutoAccept();
  }, [topicEditSuggestions, document, user, queryClient, suggestions]);

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
      // מחזיר רק הצבעות על הצעות במסמך הזה, וממפה לפי suggestionId
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
    },
    enabled: !!user?.id && suggestions.length > 0,
    initialData: [],
    staleTime: 0, // תמיד רענן כשיש שינוי
    refetchInterval: SYNC_INTERVAL,
    refetchIntervalInBackground: false,
  });

  const getUserVote = React.useCallback((suggestionId) => {
    // מחזיר את ההצבעה האחרונה עבור ההצעה הספציפית
    const votesForSuggestion = userVotes?.filter(v => v.suggestionId === suggestionId) || [];
    // אם יש כפילויות (לא אמור לקרות), נחזיר את האחרונה
    return votesForSuggestion[votesForSuggestion.length - 1] || null;
  }, [userVotes]);

  // פונקציית עזר לעדכון נקודות ברקע (לא חוסמת את ה-UI)
  const handlePointsInBackground = async (action, suggestion, vote, currentVote) => {
    if (!document.gamificationEnabled) return;
    
    try {
      let pointsChange = 0;
      let description = '';
      
      if (action === 'cancel' && vote === 'pro') {
        pointsChange = -10;
        description = `ביטול הצבעה בעד על ההצעה: ${suggestion.title}`;
      } else if (action === 'change') {
        if (currentVote?.vote === 'con' && vote === 'pro') {
          pointsChange = 10;
          description = `קיבל הצבעה בעד על ההצעה: ${suggestion.title}`;
        } else if (currentVote?.vote === 'pro' && vote === 'con') {
          pointsChange = -10;
          description = `הצבעה השתנתה מבעד לנגד על ההצעה: ${suggestion.title}`;
        }
      } else if (action === 'new' && vote === 'pro') {
        pointsChange = 10;
        description = `קיבל הצבעה בעד על ההצעה: ${suggestion.title}`;
      }
      
      if (pointsChange !== 0) {
        const suggestionCreatorList = await base44.entities.User.filter({ email: suggestion.created_by });
        if (suggestionCreatorList.length > 0) {
          const suggestionCreator = suggestionCreatorList[0];
          const newPoints = Math.max(0, (suggestionCreator.points || 1000) + pointsChange);
          await base44.entities.User.update(suggestionCreator.id, { points: newPoints });
          await base44.entities.PointsTransaction.create({
            userId: suggestionCreator.id,
            amount: pointsChange,
            action: pointsChange > 0 ? 'vote_received' : 'vote_canceled',
            description,
            relatedEntityId: suggestion.id,
            relatedEntityType: 'suggestion'
          });
        }
      }
    } catch (err) {
      console.error('[POINTS] Error handling points:', err);
    }
  };

  // מעקב אחרי הצבעות בתהליך למניעת race conditions
  const votingInProgressRef = React.useRef(new Set());
  
  const voteMutation = useMutation({
    mutationFn: async ({ suggestionId, vote, currentVote, willBeAccepted }) => {
      if (!user) throw new Error("יש להתחבר כדי להצביע");

      // מניעת הצבעות כפולות על אותה הצעה
      if (votingInProgressRef.current.has(suggestionId)) {
        console.log('[VOTE] Already voting on this suggestion, ignoring');
        throw new Error("ההצבעה בתהליך, אנא המתן");
      }
      votingInProgressRef.current.add(suggestionId);

      try {
        const suggestion = suggestions.find(s => s.id === suggestionId);
        
        // שלב 1: קריאת המצב העדכני מהשרת (source of truth)
        const [freshVotes, freshSuggestions] = await Promise.all([
          base44.entities.Vote.filter({ suggestionId, userId: user.id }),
          base44.entities.Suggestion.filter({ id: suggestionId })
        ]);
        
        const serverVote = freshVotes[0]; // ההצבעה האמיתית מהשרת
        const freshSuggestion = freshSuggestions[0];
        
        if (!freshSuggestion) {
          throw new Error("ההצעה לא נמצאה");
        }
        
        // שימוש בערכים מהשרת, לא מהקאש
        let newProVotes = freshSuggestion.proVotes || 0;
        let newConVotes = freshSuggestion.conVotes || 0;
        let pointsAction = null;
        
        // שלב 2: ביצוע הפעולות על בסיס המצב האמיתי מהשרת
        if (serverVote) {
          if (serverVote.vote === vote) {
            // ביטול הצבעה
            await base44.entities.Vote.delete(serverVote.id);
            if (vote === 'pro') newProVotes = Math.max(0, newProVotes - 1);
            else newConVotes = Math.max(0, newConVotes - 1);
            pointsAction = 'cancel';
          } else {
            // שינוי כיוון הצבעה
            await base44.entities.Vote.update(serverVote.id, { vote });
            if (vote === 'pro') {
              newProVotes += 1;
              newConVotes = Math.max(0, newConVotes - 1);
            } else {
              newConVotes += 1;
              newProVotes = Math.max(0, newProVotes - 1);
            }
            pointsAction = 'change';
          }
        } else {
          // הצבעה חדשה - בודקים שוב שאין הצבעה קיימת
          const doubleCheck = await base44.entities.Vote.filter({ suggestionId, userId: user.id });
          if (doubleCheck.length > 0) {
            // כבר קיימת הצבעה - משתמשים בה במקום ליצור חדשה
            const existingVote = doubleCheck[0];
            if (existingVote.vote !== vote) {
              await base44.entities.Vote.update(existingVote.id, { vote });
              if (vote === 'pro') {
                newProVotes += 1;
                newConVotes = Math.max(0, newConVotes - 1);
              } else {
                newConVotes += 1;
                newProVotes = Math.max(0, newProVotes - 1);
              }
              pointsAction = 'change';
            }
            // אם אותה הצבעה - מבטלים
            else {
              await base44.entities.Vote.delete(existingVote.id);
              if (vote === 'pro') newProVotes = Math.max(0, newProVotes - 1);
              else newConVotes = Math.max(0, newConVotes - 1);
              pointsAction = 'cancel';
            }
          } else {
            // באמת הצבעה חדשה
            await base44.entities.Vote.create({
              suggestionId,
              userId: user.id,
              vote
            });
            if (vote === 'pro') newProVotes += 1;
            else newConVotes += 1;
            pointsAction = 'new';
          }
        }
        
        // שלב 3: עדכון ההצעה עם הערכים החדשים
        await base44.entities.Suggestion.update(suggestionId, {
          proVotes: newProVotes,
          conVotes: newConVotes
        });
        
        // טיפול בנקודות ברקע - לא חוסם את ה-UI
        handlePointsInBackground(pointsAction, suggestion, vote, serverVote);

      // חישוב מחדש האם ההצעה תתקבל על בסיס הערכים העדכניים
      const consensuses = document.consensuses || [];
      let threshold;
      if (consensuses.length > 0) {
        const consensusMeterAverage = consensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / consensuses.length;
        threshold = Math.max(1, Math.round(consensusMeterAverage * (document.totalUsersInteracted || 1)));
      } else {
        threshold = document.threshold || 2;
      }
      const shouldAccept = freshSuggestion.status === 'pending' && (newProVotes - newConVotes) >= threshold;
      
      // אם ההצעה צריכה להתקבל - מפעילים את האישור מיידית
      if (shouldAccept) {
        // מסמנים בקאש שההצעה התקבלה למנוע כפילויות
        hasCheckedRef.current.add(`${suggestionId}-accepted`);
        
        // מפעילים את האישור מיד - לא מחכים אבל מעדכנים UI מהר
        autoAcceptSuggestion({ ...freshSuggestion, proVotes: newProVotes, conVotes: newConVotes }, user.id, document)
          .then(accepted => {
            if (accepted) {
              // רענון הסעיפים אחרי 7 שניות (אחרי שהאנימציה נעלמה לגמרי)
              setTimeout(() => {
                Promise.all([
                  queryClient.invalidateQueries({ queryKey: ['sections', document?.id] }),
                  queryClient.invalidateQueries({ queryKey: ['allVersions'] }),
                  queryClient.invalidateQueries({ queryKey: ['versions', document?.id] })
                ]);
              }, 7000);
              
              // רענון הצעות והמסמך מיד (כדי שהאנימציה תתחיל)
              queryClient.invalidateQueries({ queryKey: ['suggestions', document?.id] });
              queryClient.invalidateQueries({ queryKey: ['document', document?.id] });
              queryClient.invalidateQueries({ queryKey: ['topics', document?.id] });
              
              // טיפול בנקודות ברקע - לא חוסם
              if (!serverVote && vote === 'pro' && document.gamificationEnabled) {
                base44.auth.updateMe({ points: (user.points || 1000) + 50 }).catch(() => {});
                base44.entities.PointsTransaction.create({
                  userId: user.id,
                  amount: 50,
                  action: 'vote_influenced_acceptance',
                  description: `ההצבעה שלך השפיעה על קבלת ההצעה: ${suggestion.title}`,
                  relatedEntityId: suggestion.id,
                  relatedEntityType: 'suggestion'
                }).catch(() => {});
              }
            }
          })
          .catch(err => console.error('[AUTO-ACCEPT ERROR]', err));
        
        return { accepted: true, newProVotes, newConVotes };
      }
      
      return { accepted: false, newProVotes, newConVotes };
      } catch (err) {
        throw err;
      } finally {
        // מסירים מהרשימה אחרי שהפעולה הסתיימה
        votingInProgressRef.current.delete(suggestionId);
      }
    },
    // Optimistic update - עדכון ה-UI מיידית לפני שהשרת מגיב
    onMutate: async ({ suggestionId, vote, currentVote }) => {
      // ביטול קריאות קודמות
      await queryClient.cancelQueries({ queryKey: ['suggestions', document?.id] });
      await queryClient.cancelQueries({ queryKey: ['userVotes', document?.id, user?.id] });
      
      // שמירת המצב הקודם
      const previousSuggestions = queryClient.getQueryData(['suggestions', document?.id]);
      const previousVotes = queryClient.getQueryData(['userVotes', document?.id, user?.id]);
      
      // חישוב הקולות החדשים
      const suggestion = suggestions.find(s => s.id === suggestionId);
      let newProVotes = suggestion?.proVotes || 0;
      let newConVotes = suggestion?.conVotes || 0;
      
      if (currentVote) {
        if (currentVote.vote === vote) {
          if (vote === 'pro') newProVotes = Math.max(0, newProVotes - 1);
          else newConVotes = Math.max(0, newConVotes - 1);
        } else {
          if (vote === 'pro') {
            newProVotes += 1;
            newConVotes = Math.max(0, newConVotes - 1);
          } else {
            newConVotes += 1;
            newProVotes = Math.max(0, newProVotes - 1);
          }
        }
      } else {
        if (vote === 'pro') newProVotes += 1;
        else newConVotes += 1;
      }
      
      // חישוב האם ההצעה תתקבל
      const consensuses = document.consensuses || [];
      let threshold;
      if (consensuses.length > 0) {
        // מגבילים כל ערך ל-1 מקסימום (כי consensuses אמורים להיות בין 0 ל-1)
        const consensusMeterAverage = consensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / consensuses.length;
        threshold = Math.max(1, Math.round(consensusMeterAverage * (document.totalUsersInteracted || 1)));
      } else {
        threshold = document.threshold || 2;
      }
      const willBeAccepted = suggestion?.status === 'pending' && (newProVotes - newConVotes) >= threshold;
      
      // עדכון אופטימיסטי של ההצעות
      queryClient.setQueryData(['suggestions', document?.id], (old) => {
        if (!old) return old;
        return old.map(s => {
          if (s.id !== suggestionId) return s;
          
          return { 
            ...s, 
            proVotes: newProVotes, 
            conVotes: newConVotes,
            // אם ההצעה תתקבל, מעדכנים את הסטטוס מיידית
            status: willBeAccepted ? 'accepted' : s.status
          };
        });
      });
      
      // אם ההצעה תתקבל, מציגים הודעה אחרי שניה (כדי שהאנימציה תתחיל קודם)
      if (willBeAccepted) {
        setTimeout(() => {
          toast.success('🎉 ההצעה התקבלה והמסמך עודכן!', {
            duration: 4000,
          });
        }, 1000);
      }
      
      // עדכון אופטימיסטי של ההצבעות - מטפל רק בהצעה הספציפית
      queryClient.setQueryData(['userVotes', document?.id, user?.id], (old) => {
        if (!old) old = [];
        
        // מסננים תחילה את כל ההצבעות שלא קשורות להצעה הנוכחית
        const otherVotes = old.filter(v => v.suggestionId !== suggestionId);
        
        if (currentVote) {
          if (currentVote.vote === vote) {
            // ביטול הצבעה - מחזירים רק את ההצבעות האחרות
            return otherVotes;
          } else {
            // שינוי הצבעה - מוסיפים את ההצבעה המעודכנת
            return [...otherVotes, { ...currentVote, vote }];
          }
        } else {
          // הצבעה חדשה - מוסיפים הצבעה חדשה
          return [...otherVotes, { id: 'temp-' + Date.now() + '-' + suggestionId, suggestionId, userId: user.id, vote }];
        }
      });
      
      return { previousSuggestions, previousVotes, willBeAccepted };
    },
    onError: (err, variables, context) => {
      // שחזור המצב הקודם במקרה של שגיאה
      if (context?.previousSuggestions) {
        queryClient.setQueryData(['suggestions', document?.id], context.previousSuggestions);
      }
      if (context?.previousVotes) {
        queryClient.setQueryData(['userVotes', document?.id, user?.id], context.previousVotes);
      }
      toast.error('שגיאה בהצבעה, נסה שוב');
    },
    onSuccess: (data, variables, context) => {
      // עדכון הקאש עם הערכים האמיתיים מהשרת
      if (data?.newProVotes !== undefined) {
        queryClient.setQueryData(['suggestions', document?.id], (old) => {
          if (!old) return old;
          return old.map(s => {
            if (s.id !== variables.suggestionId) return s;
            return { 
              ...s, 
              proVotes: data.newProVotes, 
              conVotes: data.newConVotes,
              status: data.accepted ? 'accepted' : s.status
            };
          });
        });
      }
      
      // רענון מיידי במקביל - לא מחכים
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['userVotes', document?.id, user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['suggestions', document?.id] })
      ]);
    },
  });

  const getUserName = (email) => {
    // First try public profile (accessible to all)
    const profile = publicProfiles.find(p => p.email === email);
    if (profile?.fullName) {
      return profile.fullName;
    }
    
    // Fallback to User entity
    const user = users.find(u => u.email === email);
    if (user?.full_name && user.full_name.trim()) {
      return user.full_name;
    }
    
    // Last resort
    return email?.split('@')[0] || email || 'Unknown User';
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
      s.type === 'new_section'
      // מציג גם pending וגם accepted (האנימציה תטפל בהעלמה)
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
        const suggestion = topicEditSuggestions.find(s => s.id === suggestionId);
        
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
            if (vote === 'pro') newProVotes += 1;
            else newConVotes += 1;

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
        dynamicThreshold = Math.max(1, Math.round(consensusMeterAverage * totalUsers));
      } else {
        dynamicThreshold = document.threshold || 2;
      }
      
      if (delta >= dynamicThreshold) {
        // Get current topic for version tracking
        const currentTopic = topics.find(t => t.id === suggestion.topicId);
        
        // Accept suggestion - update topic title
        await base44.entities.Topic.update(suggestion.topicId, {
          title: suggestion.newTitle
        });
        
        // שינויי כותרות נושאים לא נספרים במד הקונצנזוס - רק עריכות תוכן סעיפים
        console.log('[TOPIC VOTE ACCEPTANCE] Skipping consensus meter update for topic title changes');
        
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
                            
                            {/* Title - flexible width */}
                            <CardTitle className={`text-lg md:text-2xl break-words flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                              {(() => {
                                const translatedTitle = topic.translations?.[language]?.title;
                                if (showTranslatedTopics[topic.id] && typeof translatedTitle === 'string') {
                                  return translatedTitle;
                                }
                                return topic.title;
                              })()}
                            </CardTitle>
                            
                            {/* Action buttons - fixed on the side */}
                            <div className={`flex items-center gap-1 flex-shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              {/* Translate button */}
                              {(() => {
                                const detectLanguage = (text) => {
                                  const hebrewPattern = /[\u0590-\u05FF]/;
                                  const arabicPattern = /[\u0600-\u06FF]/;
                                  if (hebrewPattern.test(text)) return 'he';
                                  if (arabicPattern.test(text)) return 'ar';
                                  return 'en';
                                };
                                const topicOriginalLang = topic.originalLanguage || detectLanguage(topic.title);
                                const needsTranslation = topicOriginalLang !== language;
                                
                                if (!needsTranslation) return null;
                                
                                if (translateTopicMutation.isPending && translateTopicMutation.variables?.id === topic.id) {
                                  return <Loader2 className="w-4 h-4 animate-spin text-blue-600 flex-shrink-0" />;
                                }
                                
                                return (
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
                                    title={showTranslatedTopics[topic.id] && topic.translations?.[language]?.title ? `${languageNames[topicOriginalLang]} (מקור)` : `תרגם ל${languageNames[language]}`}
                                  >
                                    <Languages className="w-4 h-4" />
                                  </Button>
                                );
                              })()}
                              
                              {/* Edit button */}
                              {user && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingTopic(topic)}
                                  className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                                  title="הצע עריכה לכותרת"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              )}
                              
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
              {/* Topic Edit Suggestions */}
              {getTopicEditSuggestions(topic.id).map((suggestion) => {
                const userVote = getUserTopicVote(suggestion.id);
                const delta = (suggestion.proVotes || 0) - (suggestion.conVotes || 0);
                
                // חישוב threshold דינמי - זהה לחישוב של הצעות סעיפים
                const consensuses = document.consensuses || [];
                const totalUsers = document.totalUsersInteracted || 1;
                let threshold;
                if (consensuses.length > 0) {
                  const consensusMeterAverage = consensuses.reduce((sum, val) => sum + Math.min(1, val), 0) / consensuses.length;
                  threshold = Math.max(1, Math.round(consensusMeterAverage * totalUsers));
                } else {
                  threshold = document.threshold || 2;
                }
                const votesNeeded = Math.max(0, threshold - delta);

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
                          {suggestion.explanation && typeof suggestion.explanation === 'string' && (
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
                            currentVote: userVote,
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
                     onOpenSidebar={onOpenSuggestionSidebar}
                     getCommentsCount={getCommentsCount}
                     toggleComments={toggleComments}
                     showComments={showComments}
                     isAdmin={isAdmin}
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
                                />
                              ))}

                            {index > 0 && user && (
                              <div className="group relative h-4 flex items-center justify-center -my-2">
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="h-full flex items-center justify-center">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => onNewSection(topic.id, section.order)}
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
                                  onClick={() => onNewSection(topic.id, section.order)}
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
                              onOpenSuggestionSidebar={onOpenSuggestionSidebar}
                              newlyCreatedSuggestionId={newlyCreatedSuggestion?.sectionId === section.id ? newlyCreatedSuggestion?.suggestionId : null}
                              onClearNewlyCreated={onClearNewlyCreated}
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
                                        onClick={() => onNewSection(topic.id, section.order + 1)}
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
                                    onClick={() => onNewSection(topic.id, section.order + 1)}
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