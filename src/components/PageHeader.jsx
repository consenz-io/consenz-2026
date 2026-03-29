import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Globe, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";

const translateTitle = (title, t, language) => {
  // Ensure title is a string
  if (typeof title !== 'string') {
    return title;
  }

  // Translate suggestion titles dynamically
  const newSectionMatch = title.match(/^New section in (.+)$/i);
  const editSectionMatch = title.match(/^Edit section in (.+)$/i);

  if (newSectionMatch) {
    return t('newSectionIn', { topic: newSectionMatch[1] });
  }
  if (editSectionMatch) {
    return t('editSectionIn', { topic: editSectionMatch[1] });
  }

  return title;
};

export default function PageHeader({ title, documentTitle }) {
  const { isRTL, t, language } = useLanguage();
  const navigate = useNavigate();
  const translatedTitle = documentTitle || translateTitle(title, t, language);
  const [translated, setTranslated] = useState(null);
  const [showTranslated, setShowTranslated] = useState(false);
  const [translating, setTranslating] = useState(false);

  const displayedTitle = documentTitle
    ? language === 'he' ? `הצעה לעריכה במסמך "${documentTitle}"` : language === 'ar' ? `اقتراح تعديل في الوثيقة "${documentTitle}"` : `Suggestion to edit document "${documentTitle}"`
    : showTranslated && translated ? translated : translatedTitle;

  const needsTranslation = !documentTitle && title && typeof title === 'string';

  const handleTranslate = async () => {
    if (showTranslated) {
      setShowTranslated(false);
      return;
    }
    if (translated) {
      setShowTranslated(true);
      return;
    }
    setTranslating(true);
    const langNames = { en: 'English', he: 'Hebrew', ar: 'Arabic' };
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Translate the following text to ${langNames[language]}. Return ONLY the translated text:\n${title}`
    });
    const text = typeof result === 'string' ? result.trim() : result;
    setTranslated(text);
    setShowTranslated(true);
    setTranslating(false);
  };

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="flex items-center mb-6 gap-3">
      <Button
        variant="outline"
        size="icon"
        onClick={handleBack}
        className="shrink-0">

        {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
      </Button>
      <h1 className="text-slate-900 text-sm font-bold text-center md:text-3xl flex-1">
        {displayedTitle}
      </h1>
      {needsTranslation ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleTranslate}
          disabled={translating}
          className="shrink-0 text-blue-600 hover:text-blue-700"
          title={showTranslated ? t('showOriginal') : t('translate')}
        >
          {translating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
        </Button>
      ) : (
        <div className="w-10 shrink-0" />
      )}
    </div>);

}