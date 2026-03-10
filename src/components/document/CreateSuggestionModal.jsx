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
import { AlertCircle, Sparkles, ExternalLink } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import TranslatableContent from "./TranslatableContent";
import { createPageUrl } from "@/utils";
import InsufficientPointsDialog from "../InsufficientPointsDialog";
import PointsCostConfirmDialog from "../PointsCostConfirmDialog";
import { ensureUserPublicProfile } from "../ensureUserPublicProfile";
import InlineDiff from "./InlineDiff";

const detectLanguage = (text) => {
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  
  if (hebrewPattern.test(text)) return 'he';
  if (arabicPattern.test(text)) return 'ar';
  return 'en';
};

const POINTS_COST_EDIT = 200;
const POINTS_COST_NEW = 350;

// Notifications for new suggestions are handled by the handleNewSuggestion backend automation (entity trigger on create).
// No frontend notification call needed here.

// Background function for updating contributors
const updateContributorsInBackground = async (docId) => {
  try {
    const { calculateDocumentContributors } = await import('./calculateContributors');
    const contributorsCount = await calculateDocumentContributors(docId);
    await base44.entities.Document.update(docId, {
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
  editingSuggestion,
  user, 
  onClose,
  isAdmin,
  onSuggestionCreated,
  isDeletingSuggestion
}) {
  const queryClient = useQueryClient();
  const { t, isRTL, language } = useLanguage();
  const [error, setError] = useState(null);
  const [isLoadingTranslation, setIsLoadingTranslation] = useState(false);
  const [showInsufficientPointsDialog, setShowInsufficientPointsDialog] = useState(false);
  const [showPointsConfirm, setShowPointsConfirm] = useState(false);
  const [pendingFormData, setPendingFormData] = useState(null);
  const [showDiff, setShowDiff] = useState(false);
  
  const currentUser = user;
  
  console.log('CreateSuggestionModal - currentUser:', currentUser);
  console.log('CreateSuggestionModal - currentUser.points:', currentUser?.points);
  
  const isNewSection = editingSection?.isNew;
  const isEditingSuggestion = !!editingSuggestion;
  const isDirectEdit = editingSection?.isDirectEdit || false;
  const isDeleteSection = isDeletingSuggestion || false;
  const existingSection = !isNewSection && !isEditingSuggestion ? sections.find(s => s.id === editingSection?.id) : null;

  const [formData, setFormData] = useState({
    topicId: editingSection?.topicId || topics[0]?.id || "",
    newContent: "",
    explanation: "",
  });

  const [isCreatingNewTopic, setIsCreatingNewTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");

  // Load translated content on mount
  React.useEffect(() => {
    if (isEditingSuggestion) {
        setFormData(prev => ({ 
            ...prev, 
            newContent: editingSuggestion.newContent,
            explanation: editingSuggestion.explanation,
            topicId: editingSuggestion.topicId
        }));
        return;
    }

    // אם זה סעיף חדש - אל תתרגם כלום
    if (isNewSection) {
      return;
    }

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
        // Validate content before translation
        if (!existingSection.content || existingSection.content.trim().length === 0) {
          console.warn('[TRANSLATION] Cannot translate empty content');
          setFormData(prev => ({ ...prev, newContent: '' }));
          setIsLoadingTranslation(false);
          return;
        }

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
      - Do NOT create placeholder or example content - translate ONLY what is provided

      HTML content to translate:
      ${existingSection.content}

      Return ONLY the translated HTML:`;

        const result = await base44.integrations.Core.InvokeLLM({ prompt });
        let translatedContent = typeof result === 'string' ? result : result.content || result;
        // Remove markdown code blocks
        translatedContent = translatedContent.replace(/```html\s*/gi, '').replace(/```\s*/g, '').trim();

        // Validate translated content
        if (!translatedContent || translatedContent.length === 0) {
          console.warn('[TRANSLATION] Translation returned empty content, using original');
          setFormData(prev => ({ ...prev, newContent: existingSection.content }));
          setIsLoadingTranslation(false);
          return;
        }

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
          changeDescription: data.explanation || "Admin direct edit"
        });
        
        return { isDirectEdit: true };
      }
      
      // Check if user has enough points (only if gamification is enabled)
      const currentPoints = currentUser.points || 1000;
      const gamificationEnabled = document.gamificationEnabled || false;
      const pointsCost = isDeleteSection ? POINTS_COST_EDIT : isNewSection ? POINTS_COST_NEW : POINTS_COST_EDIT;
      
      if (gamificationEnabled && currentPoints < pointsCost) {
        throw new Error('INSUFFICIENT_POINTS');
      }

      const timerEndsAt = new Date();
      timerEndsAt.setHours(timerEndsAt.getHours() + (document.defaultSuggestionLifetimeHours || 72));

      let targetTopicId = data.topicId;
      let topicTitle = '';
      let newTopicTitle = null;
      
      // Don't create new topic immediately - save title for when suggestion is accepted
      let newTopicOrder = null;
      if (isCreatingNewTopic && newTopicName.trim()) {
        topicTitle = newTopicName.trim();
        newTopicTitle = newTopicName.trim();
        targetTopicId = null; // Will be created when suggestion is accepted
        // Determine position for new topic
        if (editingSection?.topicOrder !== undefined && editingSection.topicOrder !== null) {
          // Add after current topic
          newTopicOrder = editingSection.topicOrder + 1;
        } else {
          // Default - at the end
          const maxOrder = topics.length > 0 ? Math.max(...topics.map(t => t.order)) : -1;
          newTopicOrder = maxOrder + 1;
        }
      } else {
        const topic = topics.find(t => t.id === targetTopicId);
        topicTitle = topic?.title || '';
      }

      // Generate automatic title
      const autoTitle = isDeleteSection
        ? (language === 'he' ? `הצעה למחיקת סעיף ב-${topicTitle}` : `Delete section in ${topicTitle}`)
        : isNewSection 
        ? t('newSectionIn', { topic: topicTitle })
        : t('editSectionIn', { topic: topicTitle });

      const detectedLanguage = detectLanguage(data.newContent);
      
      const suggestion = await base44.entities.Suggestion.create({
        documentId: document.id,
        sectionId: isEditingSuggestion ? editingSuggestion.sectionId : (isNewSection ? null : (existingSection?.id || editingSection?.id || null)),
        topicId: isEditingSuggestion ? editingSuggestion.topicId : targetTopicId,
        newTopicTitle: isEditingSuggestion ? editingSuggestion.newTopicTitle : newTopicTitle, // Preserve new topic title when editing suggestion
        newTopicOrder: isEditingSuggestion ? editingSuggestion.newTopicOrder : newTopicOrder, // Preserve new topic order when editing suggestion
        type: isDeleteSection ? 'delete_section' : isNewSection ? 'new_section' : (isEditingSuggestion ? 'edit_suggestion' : 'edit_section'),
        title: autoTitle,
        newContent: isDeleteSection ? '' : data.newContent,
        originalContent: isEditingSuggestion ? editingSuggestion.newContent : (isNewSection ? null : (isDeleteSection ? existingSection?.content : existingSection?.content)),
        explanation: data.explanation,
        status: 'pending',
        timerEndsAt: timerEndsAt.toISOString(),
        proVotes: 0,
        conVotes: 0,
        insertPosition: isEditingSuggestion ? editingSuggestion.insertPosition : editingSection?.insertPosition,
        parentSuggestionId: isEditingSuggestion ? editingSuggestion.id : null,
        originalLanguage: detectedLanguage,
        createdByLanguage: language, // Track language user was viewing when creating suggestion
      });

      console.log('[CREATE SUGGESTION] ===== Suggestion created:', suggestion.id, 'type:', suggestion.type, '=====');
      
      // ===== Background tasks - fire-and-forget =====
      ensureUserPublicProfile(currentUser).catch(() => {});
      
      base44.auth.updateMe({
        suggestionsCreated: (currentUser.suggestionsCreated || 0) + 1,
        ...(gamificationEnabled ? { points: currentPoints - pointsCost } : {})
      }).catch(err => console.error('[UPDATE USER]', err));
      
      if (gamificationEnabled) {
        base44.entities.PointsTransaction.create({
          userId: currentUser.id,
          amount: -pointsCost,
          action: 'suggestion_created',
          description: `${t('pointsTransactionCreated')} ${autoTitle}`,
          relatedEntityId: suggestion.id,
          relatedEntityType: 'suggestion'
        }).catch(err => console.error('[POINTS]', err));
      }
      
      updateContributorsInBackground(document.id);
      
      // Notifications are sent by handleNewSuggestion backend automation (entity trigger on create).

      return suggestion;
    },
    onSuccess: async (result) => {
      if (result?.isDirectEdit) {
        queryClient.invalidateQueries({ queryKey: ['sections'] });
        queryClient.invalidateQueries({ queryKey: ['allVersions'] });
        onClose();
        return;
      }

      // CRITICAL: Update all caches BEFORE creating auto-vote to ensure instant UI update
      if (user && result?.id) {
        // עדכון קאש ההצעות עם ההצעה החדשה כולל הצבעת בעד ראשונה
        queryClient.setQueryData(['suggestions', document.id], (old) => {
          const existing = old || [];
          // הוסף את ההצעה החדשה עם proVotes: 1
          return [...existing, { ...result, proVotes: 1, conVotes: 0 }];
        });

        // עדכון קאש הנקודות של המשתמש
        const gamificationEnabled = document.gamificationEnabled || false;
        const pointsCost = result.type === 'new_section' ? POINTS_COST_NEW : POINTS_COST_EDIT;
        if (gamificationEnabled) {
          queryClient.setQueryData(['currentUser'], (old) => {
            if (!old) return old;
            return {
              ...old,
              points: (old.points || 1000) - pointsCost,
              suggestionsCreated: (old.suggestionsCreated || 0) + 1
            };
          });
        }
        
        try {
          // Create the auto-vote
          const newVote = await base44.entities.Vote.create({
            suggestionId: result.id,
            userId: user.id,
            vote: 'pro',
          });
          
          // Update suggestion with vote count
          await base44.entities.Suggestion.update(result.id, {
            proVotes: 1,
          });
          
          // Update userVotes cache immediately with the new vote
          queryClient.setQueryData(['userVotes', document.id, user.id], (old) => {
            const existingVotes = old || [];
            return [...existingVotes, newVote];
          });
          
          console.log('[AUTO-VOTE] ✅ Auto-vote created and cache updated for suggestion:', result.id);
        } catch (error) {
          console.error("[AUTO-VOTE] ❌ Failed to auto-vote:", error);
          // Rollback optimistic update on error
          queryClient.invalidateQueries({ queryKey: ['suggestions', document.id] });
          queryClient.invalidateQueries({ queryKey: ['userVotes', document.id, user.id] });
        }
      }

      // Close modal immediately - user sees instant feedback
      onClose();
      
      // Scroll to new suggestion
      if (result?.id && onSuggestionCreated) {
        setTimeout(() => {
          onSuggestionCreated(result.id, result.sectionId, result.topicId);
        }, 100);
      }
    },
    onError: (err, variables, context) => {
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

    if (!isDeleteSection && !formData.newContent.trim()) {
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
    const pointsCost = isDeleteSection ? POINTS_COST_EDIT : isNewSection ? POINTS_COST_NEW : POINTS_COST_EDIT;
    
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
      setShowPointsConfirm(false);
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

  const pointsCost = isDeleteSection ? POINTS_COST_EDIT : isNewSection ? POINTS_COST_NEW : POINTS_COST_EDIT;

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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-labelledby="suggestion-modal-title" aria-describedby="suggestion-modal-description">
        <DialogHeader className={isRTL ? "text-start" : "text-start"}>
          <DialogTitle id="suggestion-modal-title" className="text-start">
            {isDeleteSection 
              ? (language === 'he' ? 'הצעה למחיקת סעיף' : 'Delete Section Suggestion')
              : isDirectEdit ? 'Direct Edit' : (isNewSection ? t('suggestNewSection') : t('suggestEditSection'))}
          </DialogTitle>
        </DialogHeader>

        <p id="suggestion-modal-description" className="sr-only">
          {isDirectEdit 
            ? 'Edit the section content directly as an administrator' 
            : isNewSection 
            ? 'Create a new section suggestion for the document' 
            : 'Suggest changes to an existing section'}
        </p>

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
            <a
              href={`${createPageUrl("LearnMore")}#gamification`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-2 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {t('learnMore')}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isDeleteSection && existingSection && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm font-medium text-red-800 mb-2">
                {language === 'he' ? 'סעיף שיימחק:' : 'Section to be deleted:'}
              </div>
              <div 
                className="prose prose-sm max-w-none text-slate-700"
                dangerouslySetInnerHTML={{ __html: existingSection.content }}
              />
            </div>
          )}

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
                  className={isRTL ? "text-right" : "text-left"}
                />
              ) : (
                <Select
                  value={formData.topicId}
                  onValueChange={(value) => setFormData({ ...formData, topicId: value })}
                >
                  <SelectTrigger 
                    className={isRTL ? "text-right" : "text-left"}
                    dir={isRTL ? "rtl" : "ltr"}
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir={isRTL ? "rtl" : "ltr"}>
                    {topics.map((topic) => (
                      <SelectItem 
                        key={topic.id} 
                        value={topic.id} 
                        className={isRTL ? "text-right" : "text-left"}
                        style={{ textAlign: isRTL ? 'right' : 'left', direction: isRTL ? 'rtl' : 'ltr' }}
                      >
                        {topic.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {!isDeleteSection && (
            <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="content">
                {isNewSection ? t('sectionContent') : t('proposedChanges')}
              </Label>
              {!isNewSection && existingSection && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDiff(!showDiff)}
                  className="h-8"
                >
                  {showDiff ? t('hideChanges') : t('showDiff')}
                </Button>
              )}
            </div>
            {isLoadingTranslation ? (
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 text-center text-slate-500">
                {t('translating')}
              </div>
            ) : showDiff && !isNewSection && existingSection ? (
              <div className="border border-slate-300 rounded-lg p-4 bg-white max-h-96 overflow-y-auto">
                <InlineDiff 
                  originalContent={existingSection.content}
                  newContent={formData.newContent}
                />
              </div>
            ) : (
              <>
                {document.gamificationEnabled && (currentUser?.points || 1000) < pointsCost && (
                  <div className="mb-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {language === 'he' ? 'אין לך מספיק נקודות כדי ליצור הצעה' : language === 'ar' ? 'ليس لديك نقاط كافية لإنشاء اقتراح' : 'You don\'t have enough points to create a suggestion'}
                  </div>
                )}
                <Textarea
                  id="content"
                  value={formData.newContent.replace(/<[^>]*>/g, '')}
                  onChange={(e) => setFormData({ ...formData, newContent: e.target.value })}
                  placeholder={t('enterContent')}
                  rows={8}
                  className={isRTL ? "text-right" : "text-left"}
                  disabled={document.gamificationEnabled && (currentUser?.points || 1000) < pointsCost}
                />
              </>
            )}
          </div>
          )}

          <div>
            <Label htmlFor="explanation">{t('explanation')}</Label>
            <Textarea
              id="explanation"
              value={formData.explanation}
              onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
              placeholder={t('explainChange')}
              rows={3}
              className={isRTL ? "text-right" : "text-left"}
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