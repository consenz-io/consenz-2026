import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function PageHeader({ title, backUrl }) {
  const { isRTL } = useLanguage();

  if (!backUrl) {
    return (
      <div className="mb-6">
        <h1 className={`text-3xl font-bold text-slate-900 ${isRTL ? 'text-right' : ''}`}>
          {title}
        </h1>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 mb-6">
      <Link to={backUrl}>
        <Button variant="outline" size="icon">
          <ArrowRight className="w-4 h-4" />
        </Button>
      </Link>
      <h1 className={`text-3xl font-bold text-slate-900 ${isRTL ? 'text-right' : ''}`}>
        {title}
      </h1>
    </div>
  );
}