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
import TranslatableContent from "./TranslatableContent";
import { createPageUrl } from "@/utils";
import InsufficientPointsDialog from "../InsufficientPointsDialog";
import PointsCostConfirmDialog from "../PointsCostConfirmDialog";

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
  onClose,
  isAdmin
}) {
  const queryClient = useQueryClient();
  const { t, isRTL, language } = useLanguage();
  const [error, setError] = useState(null);
  const [isLoadingTranslation, setIsLoadingTranslation] = useState(false);
  const [showInsufficientPointsDialog, setShowInsufficientPointsDialog] = useState(false);
  const [showPointsConfirm, setShowPointsConfirm] = useState(false);
  const [pendingFormData, setPendingFormData] = useState(null);
  
  const currentUser = user;
  
  console.log('CreateSuggestionModal - currentUser:', currentUser);
  console.log('CreateSuggestionModal - currentUser.points:', currentUser?.points);
  
  const isNewSection = editingSection?.isNew;
  const isDirectEdit = editingSection?.isDirectEdit || false;
  const existingSection = !isNewSection ? sections.find(s => s.id === editingSection?.id) : null;

  const [formData, setFormData] = useState({
    topicId: editingSection?.topicId || topics[0]?.id || "",
    newContent: "",
    explanation: "",
  });

  const [isCreatingNewTopic, setIsCreatingNewTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");

  // Load translated content on mount
  React.useEffect(() => {
    const loadContent = async () => {
      if (!existingSection) return;
      
      const sectionOriginalLang = existingSection.originalLanguage || 'he';
      
      // If viewing in same language as original, use original content
      if (sectionOriginalLang === language) {
        setFormData(prev => ({ ...prev, newContent: existingSection.content }));
        return;
      }
      
      // If translation exists, use it
      if (existingSection.translations?.[language]) {
        setFormData(prev => ({ ...prev, newContent: existingSection.translations[language] }));
        return;
      }
      
      // Otherwise, translate
      setIsLoadingTranslation(true);
      try {
        const languageNames = { en: 'English', he: 'Hebrew', ar: 'Arabic' };
        const targetLangName = languageNames[language];
        
        const prompt = `You are a professional translator. Translate the following HTML content to ${targetLangName}.

CRITICAL INSTRUCTIONS:
- Keep ALL HTML tags exactly as they are (including <p>, <strong>, <em>, <ul>, <li>, etc.)
- Only translate the TEXT CONTENT between the tags
- Return ONLY the translated HTML, nothing else
- Do not add any explanations or comments
- Do not escape HTML characters
- Maintain exact same structure and formatting

HTML content to translate:
${existingSection.content}

Return ONLY the translated HTML:`;

        const result = await base44.integrations.Core.InvokeLLM({ prompt });
        let translatedContent = typeof result === 'string' ? result : result.content || result;
        // Remove markdown code blocks
        translatedContent = translatedContent.replace(/```html\s*/gi, '').replace(/```\s*/g, '').trim();
        
        setFormData(prev => ({ ...prev, newContent: translatedContent }));
        
        // Save translation to cache
        const updatedTranslations = { ...existingSection.translations, [language]: translatedContent };
        await base44.entities.Section.update(existingSection.id, {
          translations: updatedTranslations
        });
      } catch (err) {
        console.error('Translation error:', err);
        setFormData(prev => ({ ...prev, newContent: existingSection.content }));
      } finally {
        setIsLoadingTranslation(false);
      }
    };
    
    loadContent();
  }, [existingSection?.id, language]);

  const createSuggestionMutation = useMutation({
    mutationFn: async (data) => {
      // If direct edit, save immediately without creating suggestion
      if (isDirectEdit && existingSection) {
        const user = await base44.auth.me();
        
        // Get the max version number for this section
        const existingVersions = await base44.entities.DocumentVersion.filter({
          documentId: existingSection.documentId,
          sectionId: existingSection.id
        });
        const maxVersion = existingVersions.length > 0 
          ? Math.max(...existingVersions.map(v => v.version)) 
          : 0;

        // Create version with OLD content (before change)
        await base44.entities.DocumentVersion.create({
          documentId: existingSection.documentId,
          sectionId: existingSection.id,
          content: existingSection.content,
          version: maxVersion + 1,
          changeType: "direct_edit",
          changeDescription: `לפני: ${data.explanation || "עריכה ישירה של אדמין"}`
        });

        // Update the section
        await base44.entities.Section.update(existingSection.id, {
          content: data.newContent,
          lastEditedBy: user.id
        });

        // Create version with NEW content (after change)
        await base44.entities.DocumentVersion.create({
          documentId: existingSection.documentId,
          sectionId: existingSection.id,
          content: data.newContent,
          version: maxVersion + 2,
          changeType: "direct_edit",
          changeDescription: data.explanation || "עריכה ישירה של אדמין"
        });
        
        return { isDirectEdit: true };
      }
      
      // Check if user has enough points (only if gamification is enabled)
      const currentPoints = currentUser.points || 1000;
      const gamificationEnabled = document.gamificationEnabled || false;
      
      if (gamificationEnabled && currentPoints < POINTS_COST) {
        throw new Error('INSUFFICIENT_POINTS');
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
        ? t('newSectionIn', { topic: topicTitle })
        : t('editSectionIn', { topic: topicTitle });

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

      // שליחת התראות לכל המשתמשים שהגיבו או הצביעו במסמך
      try {
        const interactions = await base44.entities.UserInteraction.filter({ documentId: document.id });
        const interactedUserIds = interactions.map(i => i.userId).filter(id => id !== currentUser.id);
        
        if (interactedUserIds.length > 0) {
          const uniqueUserIds = [...new Set(interactedUserIds)];
          const suggestionUrl = `${createPageUrl("SuggestionDetail")}?id=${suggestion.id}`;
          
          for (const userId of uniqueUserIds) {
            await base44.entities.Notification.create({
              userId: userId,
              type: 'vote_on_suggestion',
              title: 'הצעה חדשה במסמך שעקבת אחריו',
              message: `${currentUser.full_name} הוסיף הצעה חדשה במסמך "${document.title}"`,
              relatedEntityId: suggestion.id,
              relatedEntityType: 'suggestion',
              actionUrl: suggestionUrl,
              read: false
            });
          }
        }
      } catch (err) {
        console.error('Error sending notifications:', err);
      }

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
    onSuccess: (result) => {
      if (result?.isDirectEdit) {
        queryClient.invalidateQueries({ queryKey: ['sections'] });
        queryClient.invalidateQueries({ queryKey: ['allVersions'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['suggestions', document.id] });
        queryClient.invalidateQueries({ queryKey: ['currentUser'] });
        queryClient.invalidateQueries({ queryKey: ['document', document.id] });
        queryClient.invalidateQueries({ queryKey: ['topics', document.id] });
      }
      onClose();
    },
    onError: (err) => {
      if (err.message === 'INSUFFICIENT_POINTS') {
        setShowInsufficientPointsDialog(true);
      } else {
        setError(err.message || "Failed to create suggestion");
      }
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

    // Skip points check if direct edit
    if (isDirectEdit) {
      createSuggestionMutation.mutate(formData);
      return;
    }
    
    // Check if should show points confirmation dialog
    const gamificationEnabled = document.gamificationEnabled || false;
    const skipConfirm = localStorage.getItem('consenz_skip_points_confirm_suggestion') === 'true';
    
    if (gamificationEnabled && !skipConfirm) {
      const currentPoints = currentUser.points || 1000;
      if (currentPoints >= POINTS_COST) {
        setPendingFormData(formData);
        setShowPointsConfirm(true);
        return;
      }
    }

    createSuggestionMutation.mutate(formData);
  };

  const handleConfirmPoints = () => {
    if (pendingFormData) {
      createSuggestionMutation.mutate(pendingFormData);
      setPendingFormData(null);
    }
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
    <>
      <InsufficientPointsDialog
        isOpen={showInsufficientPointsDialog}
        onClose={() => {
          setShowInsufficientPointsDialog(false);
          onClose();
        }}
        requiredPoints={POINTS_COST}
        currentPoints={currentUser?.points || 1000}
        actionType="suggestion"
      />

      <PointsCostConfirmDialog
        isOpen={showPointsConfirm}
        onClose={() => {
          setShowPointsConfirm(false);
          setPendingFormData(null);
        }}
        onConfirm={handleConfirmPoints}
        cost={POINTS_COST}
        currentPoints={currentUser?.points || 1000}
        actionType="suggestion"
      />
      
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isDirectEdit ? 'עריכה ישירה' : (isNewSection ? t('suggestNewSection') : t('suggestEditSection'))}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {document.gamificationEnabled && !isDirectEdit && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-700">{t('costToCreate')}</span>
              <span className="font-bold text-blue-600">{POINTS_COST} {t('points')}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-slate-700">{t('yourPoints')}</span>
              <span className={`font-bold ${(currentUser?.points || 1000) >= POINTS_COST ? 'text-green-600' : 'text-red-600'}`}>
                {currentUser?.points || 1000} {t('points')}
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

          {!isNewSection && existingSection && (
            <div>
              <Label>{t('originalContent')}</Label>
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 mt-2">
                <TranslatableContent
                  content={existingSection.content}
                  entity={existingSection}
                  entityType="Section"
                  className="prose prose-sm max-w-none"
                />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="content">
              {isNewSection ? t('sectionContent') : t('proposedChanges')}
            </Label>
            {isLoadingTranslation ? (
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 text-center text-slate-500">
                {t('translating')}
              </div>
            ) : (
              <Textarea
                id="content"
                value={formData.newContent}
                onChange={(e) => setFormData({ ...formData, newContent: e.target.value })}
                placeholder={t('enterContent')}
                rows={8}
              />
            )}
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
              className={isDirectEdit ? "bg-purple-600 hover:bg-purple-700" : "bg-gradient-to-r from-blue-600 to-indigo-600"}
            >
              {createSuggestionMutation.isPending 
                ? t('saving') 
                : (isDirectEdit ? t('saveChanges') : t('createSuggestion'))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}