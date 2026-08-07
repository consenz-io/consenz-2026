import React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Save, X } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import TranslatableContent from "@/components/document/TranslatableContent";

/**
 * Renders the explanation block for a suggestion with inline edit support.
 * Extracted from suggestiondetail.jsx to eliminate triplicated code.
 */
export default function SuggestionExplanationBlock({
  suggestion,
  user,
  isEditingExplanation,
  setIsEditingExplanation,
  editedExplanation,
  setEditedExplanation,
  updateExplanationMutation,
  queryClient,
  suggestionId,
  isRTL,
}) {
  const { t } = useLanguage();

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-700">{t('explanation')}</h3>
        {user && user.id === suggestion.created_by_id && !isEditingExplanation && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditedExplanation(suggestion.explanation || "");
              setIsEditingExplanation(true);
            }}
            className="h-7 px-2"
          >
            <Edit2 className="w-3 h-3" />
          </Button>
        )}
      </div>
      {isEditingExplanation ? (
        <div className="space-y-2">
          <Textarea
            value={editedExplanation}
            onChange={(e) => setEditedExplanation(e.target.value)}
            placeholder={t('explainChange')}
            rows={3}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => updateExplanationMutation.mutate(editedExplanation)}
              disabled={updateExplanationMutation.isPending}
            >
              <Save className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
              {t('saveChanges')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsEditingExplanation(false)}>
              <X className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
              {t('cancel')}
            </Button>
          </div>
        </div>
      ) : suggestion.explanation && typeof suggestion.explanation === 'string' ? (
        <TranslatableContent
          content={suggestion.explanation}
          entity={suggestion}
          entityType="Suggestion"
          fieldName="explanation"
          onUpdate={(updated) => queryClient.setQueryData(['suggestion', suggestionId], updated)}
          className="text-slate-600"
        />
      ) : (
        <p className="text-slate-400 text-sm italic">{t('noDescription')}</p>
      )}
    </div>
  );
}