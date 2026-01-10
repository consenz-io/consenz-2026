import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Eye, ThumbsUp, ThumbsDown, MessageCircle, User, Edit2, Save, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/components/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import VotesNeededCounter from "./VotesNeededCounter";
import CommentsSection from "./CommentsSection";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function DeleteSectionSuggestionCard({ 
  suggestion, 
  section,
  document,
  onVote,
  userVote,
  currentUser,
  isAdmin,
  publicProfiles
}) {
  const { t, isRTL, language } = useLanguage();
  const [showComments, setShowComments] = useState(false);
  const [animationPhase, setAnimationPhase] = useState(null);
  const [isEditingExplanation, setIsEditingExplanation] = useState(false);
  const [editedExplanation, setEditedExplanation] = useState(suggestion.explanation || '');
  const queryClient = useQueryClient();

  const deleteSuggestionMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Suggestion.delete(suggestion.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
    }
  });

  const updateExplanationMutation = useMutation({
    mutationFn: async (newExplanation) => {
      await base44.entities.Suggestion.update(suggestion.id, {
        explanation: newExplanation
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      setIsEditingExplanation(false);
    }
  });

  useEffect(() => {
    if (suggestion.status === 'accepted' && !animationPhase) {
      setAnimationPhase('celebrating');
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      setTimeout(() => setAnimationPhase('transitioning'), 2000);
      setTimeout(() => setAnimationPhase('fading'), 3000);
    }
  }, [suggestion.status, animationPhase]);

  const creatorProfile = publicProfiles?.find(p => p.email === suggestion.created_by);
  const creatorName = creatorProfile?.fullName || suggestion.created_by?.split('@')[0] || 'Unknown';

  const canDelete = isAdmin || currentUser?.email === suggestion.created_by;
  const isCreator = currentUser?.email === suggestion.created_by;

  // Celebration animation
  if (animationPhase === 'celebrating') {
    return (
      <motion.div
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 0.5 }}
        className="my-4"
      >
        <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300">
          <div className="text-center space-y-3">
            <div className="text-4xl">🎉</div>
            <h3 className="text-xl font-bold text-green-800">{t('suggestionAccepted')}</h3>
            <p className="text-green-700">{t('sectionDeleted')}</p>
          </div>
        </Card>
      </motion.div>
    );
  }

  // Fade out animation
  if (animationPhase === 'transitioning' || animationPhase === 'fading') {
    return (
      <motion.div
        initial={{ opacity: 1, height: 'auto' }}
        animate={{ opacity: 0, height: 0 }}
        transition={{ duration: 1 }}
      />
    );
  }

  const handleDelete = async () => {
    if (confirm(t('confirmDeleteSuggestion'))) {
      await deleteSuggestionMutation.mutateAsync();
    }
  };

  return (
    <Card className="my-4 p-4 md:p-6 bg-gradient-to-br from-red-50 to-orange-50 border-red-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">{suggestion.title}</h3>
            <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
              <User className="w-3 h-3" />
              <span>{creatorName}</span>
              <span>•</span>
              <span>{format(new Date(suggestion.created_date), 'dd/MM/yyyy HH:mm')}</span>
            </div>
          </div>
        </div>
        <Badge variant="destructive" className="bg-red-100 text-red-800">
          {t('delete')}
        </Badge>
      </div>

      {/* Explanation */}
      {(suggestion.explanation || isEditingExplanation) && (
        <div className="mb-4 p-3 bg-white/60 rounded-lg border border-red-100 group relative">
          <div className="text-sm font-bold text-slate-700 mb-1">{t('explanation')}:</div>
          {isEditingExplanation ? (
            <div className="space-y-2">
              <Textarea
                value={editedExplanation}
                onChange={(e) => setEditedExplanation(e.target.value)}
                className="min-h-[100px]"
                placeholder={t('explainChange')}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => updateExplanationMutation.mutate(editedExplanation)}
                  disabled={updateExplanationMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-1" />
                  {t('saveChanges')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsEditingExplanation(false);
                    setEditedExplanation(suggestion.explanation || '');
                  }}
                >
                  <X className="w-4 h-4 mr-1" />
                  {t('cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-slate-700 whitespace-pre-wrap">{suggestion.explanation}</p>
              {isCreator && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingExplanation(true)}
                  className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* Section to be deleted */}
      <div className="mb-4 p-3 md:p-4 bg-white/80 rounded border border-red-200">
        <div className="text-sm font-bold text-red-700 mb-2">
          {language === 'he' ? 'סעיף שמוצע למחיקה:' : language === 'ar' ? 'القسم المقترح حذفه:' : 'Section to be deleted:'}
        </div>
        <div 
          className="prose prose-sm max-w-none text-slate-700 line-through opacity-60"
          dangerouslySetInnerHTML={{ __html: section?.content || suggestion.originalContent }}
        />
      </div>

      {/* Voting Section */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Button
          size="sm"
          variant={userVote === 'pro' ? 'default' : 'outline'}
          onClick={() => onVote(suggestion, 'pro')}
          disabled={!currentUser}
          className={userVote === 'pro' ? 'bg-green-600 hover:bg-green-700' : ''}
        >
          <ThumbsUp className="w-4 h-4 mr-1" />
          {suggestion.proVotes || 0}
        </Button>
        <Button
          size="sm"
          variant={userVote === 'con' ? 'default' : 'outline'}
          onClick={() => onVote(suggestion, 'con')}
          disabled={!currentUser}
          className={userVote === 'con' ? 'bg-red-600 hover:bg-red-700' : ''}
        >
          <ThumbsDown className="w-4 h-4 mr-1" />
          {suggestion.conVotes || 0}
        </Button>
        <VotesNeededCounter
          suggestion={suggestion}
          document={document}
          compact={true}
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-3 border-t border-red-100">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowComments(!showComments)}
          className="gap-2"
        >
          <MessageCircle className="w-4 h-4" />
          {t('comments')}
        </Button>
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            disabled={deleteSuggestionMutation.isPending}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            {t('delete')}
          </Button>
        )}
      </div>

      {/* Comments section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-4 pt-4 border-t border-red-100"
          >
            <CommentsSection
              entityType="suggestion"
              entityId={suggestion.id}
              user={currentUser}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}