import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Sparkles } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

const detectLanguage = (text) => {
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  
  if (hebrewPattern.test(text)) return 'he';
  if (arabicPattern.test(text)) return 'ar';
  return 'en';
};

const POINTS_COST = 200;

export default function CreateSuggestionModal({ 
  document, 
  topics, 
  sections, 
  editingSection, 
  user, 
  onClose 
}) {
  const queryClient = useQueryClient();
  const { t, isRTL } = useLanguage();
  const [error, setError] = useState(null);
  
  const currentUser = user;
  
  console.log('CreateSuggestionModal - currentUser:', currentUser);
  console.log('CreateSuggestionModal - currentUser.points:', currentUser?.points);
  
  const isNewSection = editingSection?.isNew;
  const existingSection = !isNewSection ? sections.find(s => s.id === editingSection?.id) : null;

  const [formData, setFormData] = useState({
    topicId: editingSection?.topicId || topics[0]?.id || "",
    newContent: existingSection?.content || "",
    explanation: "",
  });

  const [isCreatingNewTopic, setIsCreatingNewTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");

  const createSuggestionMutation = useMutation({
    mutationFn: async (data) => {
      // Check if user has enough points (only if gamification is enabled)
      const currentPoints = currentUser.points || 1000;
      const gamificationEnabled = document.gamificationEnabled || false;
      
      if (gamificationEnabled && currentPoints < POINTS_COST) {
        throw new Error(`אין מספיק נקודות ליצירת הצעה (נדרשות ${POINTS_COST} נקודות, יש לך ${currentPoints})`);
      }

      const timerEndsAt = new Date();
      timerEndsAt.setHours(timerEndsAt.getHours() + (document.defaultSuggestionLifetimeHours || 72));

      let targetTopicId = data.topicId;
      let topicTitle = '';
      
      // Create new topic if needed
      if (isCreatingNewTopic && newTopicName.trim()) {
        const existingTopics = await base44.entities.Topic.filter({ documentId: document.id }, 'order');
        const maxOrder = existingTopics.length > 0 ? Math.max(...existingTopics.map(t => t.order)) : -1;
        
        const newTopic = await base44.entities.Topic.create({
          documentId: document.id,
          title: newTopicName.trim(),
          order: maxOrder + 1
        });
        
        targetTopicId = newTopic.id;
        topicTitle = newTopicName.trim();
      } else {
        const topic = topics.find(t => t.id === targetTopicId);
        topicTitle = topic?.title || '';
      }

      // Generate automatic title
      const autoTitle = isNewSection 
        ? `New section in ${topicTitle}`
        : `Edit section in ${topicTitle}`;

      const detectedLanguage = detectLanguage(data.newContent);
      
      const suggestion = await base44.entities.Suggestion.create({
        documentId: document.id,
        sectionId: isNewSection ? null : editingSection.id,
        topicId: targetTopicId,
        type: isNewSection ? 'new_section' : 'edit_section',
        title: autoTitle,
        newContent: data.newContent,
        originalContent: isNewSection ? null : existingSection?.content,
        explanation: data.explanation,
        status: 'pending',
        timerEndsAt: timerEndsAt.toISOString(),
        proVotes: 0,
        conVotes: 0,
        insertPosition: editingSection?.insertPosition,
        originalLanguage: detectedLanguage,
      });

      // Deduct 200 points for creating suggestion (only if gamification enabled)
      const updateData = {
        suggestionsCreated: (currentUser.suggestionsCreated || 0) + 1
      };
      
      if (gamificationEnabled) {
        updateData.points = currentPoints - POINTS_COST;
        
        // Create points transaction record
        await base44.entities.PointsTransaction.create({
          userId: currentUser.id,
          amount: -POINTS_COST,
          action: 'suggestion_created',
          description: `יצירת הצעה: ${autoTitle}`,
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion'
        });
      }
      
      await base44.auth.updateMe(updateData);

      const interactions = await base44.entities.UserInteraction.filter({ 
        documentId: document.id, 
        userId: currentUser.id 
      });
      
      if (interactions.length === 0) {
        await base44.entities.UserInteraction.create({
          documentId: document.id,
          userId: currentUser.id,
          firstInteractionAt: new Date().toISOString(),
        });

        await base44.entities.Document.update(document.id, {
          totalUsersInteracted: (document.totalUsersInteracted || 0) + 1,
        });
      }

      return suggestion;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions', document.id] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['document', document.id] });
      queryClient.invalidateQueries({ queryKey: ['topics', document.id] });
      onClose();
    },
    onError: (err) => {
      setError(err.message || "Failed to create suggestion");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.newContent.trim()) {
      setError(t('content'));
      return;
    }

    if (isCreatingNewTopic && !newTopicName.trim()) {
      setError(t('topic'));
      return;
    }

    createSuggestionMutation.mutate(formData);
  };

  if (!currentUser) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="py-8 text-center">{t('loading')}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isNewSection ? t('suggestNewSection') : t('suggestEditSection')}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {document.gamificationEnabled && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-700">עלות יצירת הצעה:</span>
              <span className="font-bold text-blue-600">{POINTS_COST} נקודות</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-slate-700">הנקודות שלך:</span>
              <span className={`font-bold ${(currentUser?.points || 1000) >= POINTS_COST ? 'text-green-600' : 'text-red-600'}`}>
                {currentUser?.points || 1000} נקודות
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isNewSection && (
            <div className="space-y-2">
              <Label htmlFor="topic">{t('topic')}</Label>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="newTopic"
                  checked={isCreatingNewTopic}
                  onChange={(e) => setIsCreatingNewTopic(e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="newTopic" className="text-sm font-normal cursor-pointer">
                  {t('createNewTopic')}
                </Label>
              </div>
              {isCreatingNewTopic ? (
                <Input
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  placeholder={t('enterNewTopicName')}
                />
              ) : (
                <Select
                  value={formData.topicId}
                  onValueChange={(value) => setFormData({ ...formData, topicId: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {topics.map((topic) => (
                      <SelectItem key={topic.id} value={topic.id}>
                        {topic.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="content">
              {isNewSection ? t('sectionContent') : t('proposedChanges')}
            </Label>
            <Textarea
              id="content"
              value={formData.newContent}
              onChange={(e) => setFormData({ ...formData, newContent: e.target.value })}
              placeholder={t('enterContent')}
              rows={8}
            />
          </div>

          <div>
            <Label htmlFor="explanation">{t('explanation')}</Label>
            <Textarea
              id="explanation"
              value={formData.explanation}
              onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
              placeholder={t('explainChange')}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button 
              type="submit" 
              disabled={createSuggestionMutation.isPending}
              className="bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              {createSuggestionMutation.isPending ? t('creating') : t('createSuggestion')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}