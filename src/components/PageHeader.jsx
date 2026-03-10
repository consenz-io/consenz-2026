import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
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
      <h1 className="text-slate-900 text-sm font-bold text-center md:text-3xl flex-1" style={{ fontFamily: "'Times New Roman', 'David Libre', 'Noto Serif', Georgia, serif" }}>
        {documentTitle ? language === 'he' ? `הצעה לעריכה במסמך "${documentTitle}"` : language === 'ar' ? `اقتراح تعديل في الوثيقة "${documentTitle}"` : `Suggestion to edit document "${documentTitle}"` : translatedTitle}
      </h1>
      <div className="w-10 shrink-0" /> {/* Spacer to balance the button */}
    </div>);

}