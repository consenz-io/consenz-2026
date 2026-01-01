import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ensureUserPublicProfile } from "@/components/ensureUserPublicProfile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Sparkles } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import PointsCostConfirmDialog from "../PointsCostConfirmDialog";
import InsufficientPointsDialog from "../InsufficientPointsDialog";

export default function EditTopicModal({ isOpen, onClose, topic, document, user, isAdmin }) {
  const { t, isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState(topic?.title || "");
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState(null);
  const [showPointsConfirm, setShowPointsConfirm] = useState(false);
  const [showInsufficientPoints, setShowInsufficientPoints] = useState(false);
  const [isDirectEdit, setIsDirectEdit] = useState(false);

  const SUGGESTION_COST = 100;
  const userPoints = user?.points || 1000;

  React.useEffect(() => {
    if (topic) {
      setNewTitle(topic.title);
      setExplanation("");
      setError(null);
      setIsDirectEdit(false);
    }
  }, [topic]);

  // Direct edit mutation for admin
  const directEditMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Topic.update(topic.id, {
        title: newTitle.trim()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics', document.id] });
      setNewTitle(topic?.title || "");
      setExplanation("");
      onClose();
    },
    onError: (err) => {
      setError(err.message || "שגיאה בעדכון הכותרת");
    }
  });

  const createSuggestionMutation = useMutation({
    mutationFn: async () => {
      // Deduct points if gamification enabled and not admin
      if (document.gamificationEnabled && !isAdmin) {
        const newPoints = userPoints - SUGGESTION_COST;
        await base44.auth.updateMe({ points: newPoints });
        
        await base44.entities.PointsTransaction.create({
          userId: user.id,
          amount: -SUGGESTION_COST,
          action: 'suggestion_created',
          description: `הצעת עריכה לכותרת נושא: ${topic.title}`,
          relatedEntityType: 'topic'
        });
      }

      const timerEndsAt = new Date();
      timerEndsAt.setHours(timerEndsAt.getHours() + (document.defaultSuggestionLifetimeHours || 72));

      const suggestion = await base44.entities.TopicEditSuggestion.create({
        documentId: document.id,
        topicId: topic.id,
        originalTitle: topic.title,
        newTitle: newTitle.trim(),
        explanation: explanation.trim(),
        timerEndsAt: timerEndsAt.toISOString()
      });

      // Ensure UserPublicProfile exists for display
      await ensureUserPublicProfile(user);

      if (document.gamificationEnabled && !isAdmin) {
        const currentSuggestionsCreated = user.suggestionsCreated || 0;
        await base44.auth.updateMe({
          suggestionsCreated: currentSuggestionsCreated + 1
        });
      }
      
      // Send notifications
      try {
        const followers = await base44.entities.DocumentFollow.filter({ documentId: document.id });
        const followerUserIds = followers.map(f => f.userId).filter(id => id !== user.id);
        
        if (followerUserIds.length > 0) {
          const actionUrl = `/DocumentView?id=${document.id}#topic-${topic.id}`;
          const suggestionTypeText = 'הצעת עריכה לכותרת נושא';
          
          const notifications = followerUserIds.map(userId => ({
            userId,
            type: 'new_suggestion_in_followed_document',
            title: 'הצעה חדשה במסמך',
            message: `${user.full_name} פרסם/ה ${suggestionTypeText} במסמך "${document.title}"`,
            relatedEntityId: suggestion.id,
            relatedEntityType: 'topic_edit_suggestion',
            actionUrl,
            read: false
          }));
          
          await Promise.all(
            notifications.map(notif => 
              base44.entities.Notification.create(notif)
                .catch(err => console.error('[EDIT TOPIC] Error creating notification:', err))
            )
          );
        }
      } catch (notifError) {
        console.error('[EDIT TOPIC] Error sending notifications:', notifError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topicEditSuggestions'] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      setNewTitle(topic?.title || "");
      setExplanation("");
      onClose();
    },
    onError: (err) => {
      setError(err.message || "שגיאה ביצירת ההצעה");
    }
  });

  const handleSubmit = () => {
    if (!newTitle.trim()) {
      setError("נא למלא את הכותרת החדשה");
      return;
    }

    if (newTitle.trim() === topic.title) {
      setError("הכותרת החדשה זהה לכותרת הקיימת");
      return;
    }

    // Direct edit for admin
    if (isDirectEdit && isAdmin) {
      directEditMutation.mutate();
      return;
    }

    // Check points if gamification enabled and not admin
    if (document.gamificationEnabled && !isAdmin) {
      if (userPoints < SUGGESTION_COST) {
        setShowInsufficientPoints(true);
        return;
      }
      setShowPointsConfirm(true);
    } else {
      createSuggestionMutation.mutate();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>הצעת עריכה לכותרת נושא</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {document.gamificationEnabled && !isAdmin && (
              <Alert className="bg-blue-50 border-blue-200">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
                  <div className="flex justify-between items-center">
                    <span>עלות יצירת הצעה: {SUGGESTION_COST} נקודות</span>
                    <span className="font-bold">הנקודות שלך: {userPoints}</span>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div>
              <Label>כותרת קיימת</Label>
              <div className="p-3 bg-slate-100 rounded-lg text-slate-700 mt-1">
                {topic?.title}
              </div>
            </div>

            <div>
              <Label htmlFor="newTitle">כותרת חדשה</Label>
              <Input
                id="newTitle"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="הזן כותרת חדשה..."
                dir={isRTL ? 'rtl' : 'ltr'}
              />
            </div>

            <div>
              <Label htmlFor="explanation">הסבר לשינוי</Label>
              <Textarea
                id="explanation"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="הסבר מדוע השינוי נדרש..."
                className="min-h-[100px]"
                dir={isRTL ? 'rtl' : 'ltr'}
              />
            </div>

            <div className="flex gap-2 justify-end flex-wrap">
              <Button variant="outline" onClick={onClose}>
                {t('cancel')}
              </Button>
              {isAdmin && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDirectEdit(true);
                    directEditMutation.mutate();
                  }}
                  disabled={directEditMutation.isPending || createSuggestionMutation.isPending}
                  className="border-green-300 text-green-700 hover:bg-green-50"
                >
                  {directEditMutation.isPending ? 'שומר...' : 'עריכה ישירה (אדמין)'}
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={createSuggestionMutation.isPending || directEditMutation.isPending}
                className="bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                {createSuggestionMutation.isPending ? 'יוצר...' : 'צור הצעה'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PointsCostConfirmDialog
        isOpen={showPointsConfirm}
        onClose={() => setShowPointsConfirm(false)}
        onConfirm={() => {
          setShowPointsConfirm(false);
          createSuggestionMutation.mutate();
        }}
        cost={SUGGESTION_COST}
        currentPoints={userPoints}
      />

      <InsufficientPointsDialog
        isOpen={showInsufficientPoints}
        onClose={() => setShowInsufficientPoints(false)}
        required={SUGGESTION_COST}
        current={userPoints}
      />
    </>
  );
}