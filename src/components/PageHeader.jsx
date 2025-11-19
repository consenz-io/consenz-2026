import React from "react";
import { Link } from "react-router-dom";
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

export default function PageHeader({ title, backUrl }) {
  const { isRTL, t, language } = useLanguage();
  const translatedTitle = translateTitle(title, t, language);

  if (!backUrl) {
    return (
      <div className="mb-6">
        <h1 className={`text-3xl font-bold text-slate-900 ${isRTL ? 'text-right' : ''}`}>
          {translatedTitle}
        </h1>
      </div>
    );
  }

  return (
    <div className="flex items-center mb-6 relative">
      <h1 className="text-3xl font-bold text-slate-900 text-center flex-1">
        {translatedTitle}
      </h1>
      <Link to={backUrl} className="absolute right-0">
        <Button variant="outline" size="icon">
          <ArrowRight className="w-4 h-4" />
        </Button>
      </Link>
    </div>
  );
}