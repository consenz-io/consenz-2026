import { useState, useEffect } from "react";
import { getDiffInLanguage, detectLanguage } from "../SmartDiffTranslationService";

export function useSectionDiffTranslation({ 
  originalContent, 
  newContent, 
  section, 
  suggestion, 
  language,
  originalVersion,
  newVersion
}) {
  const [translationResult, setTranslationResult] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);

  // Detect source languages
  const originalSourceLang = originalVersion?.originalLanguage || 
                              section?.originalLanguage || 
                              detectLanguage(originalContent || '');
  const modifiedSourceLang = newVersion?.originalLanguage || 
                              suggestion?.createdByLanguage ||
                              suggestion?.originalLanguage || 
                              detectLanguage(newContent || '');

  const needsTranslation = originalSourceLang !== language || modifiedSourceLang !== language;
  const hasTranslation = translationResult?.original && translationResult?.modified;
  const isCrossLanguageSuggestion = originalSourceLang !== modifiedSourceLang;

  // Reset state when suggestion changes
  useEffect(() => {
    setTranslationResult(null);
    setShowTranslated(false);
    setIsTranslating(false);
  }, [suggestion?.id, section?.id, originalContent, newContent]);

  // Auto-translate if user's language differs from content
  useEffect(() => {
    if (needsTranslation && !isTranslating) {
      if (!translationResult || 
          translationResult.sourceLanguages?.original !== originalSourceLang ||
          translationResult.sourceLanguages?.modified !== modifiedSourceLang) {
        handleSmartTranslate();
      }
    }
  }, [needsTranslation, originalSourceLang, modifiedSourceLang, language]);

  const handleSmartTranslate = async () => {
    if (isTranslating) return;
    
    setIsTranslating(true);
    try {
      const result = await getDiffInLanguage({
        originalContent,
        modifiedContent: newContent,
        originalEntity: originalVersion || section,
        originalEntityType: originalVersion ? 'DocumentVersion' : 'Section',
        modifiedEntity: suggestion || newVersion,
        modifiedEntityType: suggestion ? 'Suggestion' : 'DocumentVersion',
        targetLanguage: language,
        originalFieldName: 'content',
        modifiedFieldName: suggestion ? 'newContent' : 'content'
      });
      
      setTranslationResult(result);
      setShowTranslated(true);
    } catch (error) {
      console.error('Smart translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleToggleTranslation = async () => {
    if (!showTranslated && needsTranslation) {
      if (!hasTranslation) {
        await handleSmartTranslate();
        return;
      }
    }
    setShowTranslated(!showTranslated);
  };

  return {
    translationResult,
    isTranslating,
    showTranslated,
    setShowTranslated,
    needsTranslation,
    hasTranslation,
    isCrossLanguageSuggestion,
    originalSourceLang,
    modifiedSourceLang,
    handleToggleTranslation,
    displayOriginal: showTranslated && translationResult?.original 
      ? translationResult.original 
      : originalContent,
    displayNew: showTranslated && translationResult?.modified 
      ? translationResult.modified 
      : newContent,
  };
}