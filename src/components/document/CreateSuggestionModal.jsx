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
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
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

const POINTS_COST_EDIT = 200;
const POINTS_COST_NEW = 350;

// Background function for sending notifications
const sendNotificationsInBackground = async (document, suggestion, currentUser) => {
  try {
    const { notifyNewSuggestion } = await import('@/components/notifications/createNotification');
    await notifyNewSuggestion({
      suggestion,
      document,
      currentUser
    });
  } catch (err) {
    console.error('Error sending notifications:', err);
  }
};

// Background function for updating contributors
const updateContributorsInBackground = async (documentId) => {
  try {
    const { calculateDocumentContributors } = await import('./calculateContributors');
    const contributorsCount = await calculateDocumentContributors(documentId);
    await base44.entities.Document.update(documentId, {
      totalUsersInteracted: contributorsCount,
    });
  } catch (err) {
    console.error('Error updating contributors:', err);
  }
};

export default function CreateSuggestionModal({ 
  document, 
  topics, 
  sections, 
  editingSection, 
  user, 
  onClose,
  isAdmin,
  onSuggestionCreated
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
    onMutate: async (data) => {
      // Optimistic update - close modal immediately for non-direct edits
      if (!isDirectEdit) {
        onClose();
        
        // Cancel outgoing queries
        await queryClient.cancelQueries({ queryKey: ['suggestions', document.id] });
        
        // Snapshot previous state
        const previousSuggestions = queryClient.getQueryData(['suggestions', document.id]);
        
        // Create temporary suggestion for immediate UI feedback
        const targetTopic = isCreatingNewTopic 
          ? { title: newTopicName }
          : topics.find(t => t.id === data.topicId);
        
        const autoTitle = isNewSection 
          ? t('newSectionIn', { topic: targetTopic?.title || '' })
          : t('editSectionIn', { topic: targetTopic?.title || '' });
        
        const tempSuggestion = {
          id: `temp-${Date.now()}`,
          documentId: document.id,
          sectionId: isNewSection ? null : editingSection?.id,
          topicId: data.topicId,
          type: isNewSection ? 'new_section' : 'edit_section',
          title: autoTitle,
          newContent: data.newContent,
          explanation: data.explanation,
          status: 'pending',
          proVotes: 0,
          conVotes: 0,
          created_date: new Date().toISOString(),
          created_by: currentUser.email,
          _isOptimistic: true
        };
        
        // Update UI immediately
        queryClient.setQueryData(['suggestions', document.id], (old = []) => {
          return [...old, tempSuggestion];
        });
        
        return { previousSuggestions };
      }
    },
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

        // Update the section
        await base44.entities.Section.update(existingSection.id, {
          content: data.newContent,
          lastEditedBy: user.id
        });

        // Create version with NEW content
        await base44.entities.DocumentVersion.create({
          documentId: existingSection.documentId,
          sectionId: existingSection.id,
          content: data.newContent,
          version: maxVersion + 1,
          changeType: "direct_edit",
          changeDescription: data.explanation || "עריכה ישירה של אדמין"
        });
        
        return { isDirectEdit: true };
      }
      
      // Check if user has enough points (only if gamification is enabled)
      const currentPoints = currentUser.points || 1000;
      const gamificationEnabled = document.gamificationEnabled || false;
      const pointsCost = isNewSection ? POINTS_COST_NEW : POINTS_COST_EDIT;
      
      if (gamificationEnabled && currentPoints < pointsCost) {
        throw new Error('INSUFFICIENT_POINTS');
      }

      const timerEndsAt = new Date();
      timerEndsAt.setHours(timerEndsAt.getHours() + (document.defaultSuggestionLifetimeHours || 72));

      let targetTopicId = data.topicId;
      let topicTitle = '';
      let newTopicTitle = null;
      
      // Don't create new topic immediately - save title for when suggestion is accepted
      if (isCreatingNewTopic && newTopicName.trim()) {
        topicTitle = newTopicName.trim();
        newTopicTitle = newTopicName.trim();
        targetTopicId = null; // Will be created when suggestion is accepted
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
        newTopicTitle: newTopicTitle, // Save new topic title if creating one
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
        createdByLanguage: language, // Track language user was viewing when creating suggestion
      });

      // Ensure UserPublicProfile exists for display
      await ensureUserPublicProfile(currentUser);

      // שליחת התראות ברקע (ללא המתנה)
      sendNotificationsInBackground(document, suggestion, currentUser);

      // Deduct points for creating suggestion (only if gamification enabled)
      const updateData = {
        suggestionsCreated: (currentUser.suggestionsCreated || 0) + 1
      };
      
      if (gamificationEnabled) {
        updateData.points = currentPoints - pointsCost;
      }
      
      await base44.auth.updateMe(updateData);
      
      // Create points transaction in background (non-blocking)
      if (gamificationEnabled) {
        base44.entities.PointsTransaction.create({
          userId: currentUser.id,
          amount: -pointsCost,
          action: 'suggestion_created',
          description: `${t('pointsTransactionCreated')} ${autoTitle}`,
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion'
        }).catch(err => console.error('Error creating points transaction:', err));
      }

      // עדכון מספר התורמים ברקע (ללא המתנה)
      updateContributorsInBackground(document.id);

      return suggestion;
    },
    onSuccess: (result) => {
      if (result?.isDirectEdit) {
        queryClient.invalidateQueries({ queryKey: ['sections'] });
        queryClient.invalidateQueries({ queryKey: ['allVersions'] });
        onClose();
      } else {
        // Refresh data after successful creation
        queryClient.invalidateQueries({ queryKey: ['suggestions', document.id] });
        queryClient.invalidateQueries({ queryKey: ['currentUser'] });
        queryClient.invalidateQueries({ queryKey: ['document', document.id] });
        queryClient.invalidateQueries({ queryKey: ['topics', document.id] });
        
        // Notify parent to scroll to the new suggestion - wait for DOM update
        if (result?.id && onSuggestionCreated) {
          setTimeout(() => {
            onSuggestionCreated(result.id, result.sectionId, result.topicId);
          }, 500);
        }
      }
    },
    onError: (err, variables, context) => {
      // Restore previous state on error
      if (context?.previousSuggestions) {
        queryClient.setQueryData(['suggestions', document.id], context.previousSuggestions);
      }
      
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
    const pointsCost = isNewSection ? POINTS_COST_NEW : POINTS_COST_EDIT;
    
    if (gamificationEnabled && !skipConfirm) {
      const currentPoints = currentUser.points || 1000;
      if (currentPoints >= pointsCost) {
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

  const pointsCost = isNewSection ? POINTS_COST_NEW : POINTS_COST_EDIT;

  return (
    <>
      <InsufficientPointsDialog
        isOpen={showInsufficientPointsDialog}
        onClose={() => {
          setShowInsufficientPointsDialog(false);
          onClose();
        }}
        requiredPoints={pointsCost}
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
        cost={pointsCost}
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
              <span className="font-bold text-blue-600">{pointsCost} {t('points')}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-slate-700">{t('yourPoints')}</span>
              <span className={`font-bold ${(currentUser?.points || 1000) >= pointsCost ? 'text-green-600' : 'text-red-600'}`}>
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
                  <SelectTrigger className={isRTL ? "text-right" : "text-left"}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {topics.map((topic) => (
                      <SelectItem key={topic.id} value={topic.id} className={isRTL ? "text-right" : "text-left"}>
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
            {isLoadingTranslation ? (
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 text-center text-slate-500">
                {t('translating')}
              </div>
            ) : (
              <Textarea
                id="content"
                value={formData.newContent.replace(/<[^>]*>/g, '')}
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