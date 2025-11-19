import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown, Plus, ExternalLink } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import VotesNeededCounter from "./VotesNeededCounter";
import TranslatableContent from "./TranslatableContent";

export default function NewSectionSuggestionCard({ 
  suggestion, 
  document: doc,
  getUserName,
  acceptedSuggestions 
}) {
  const { t, isRTL } = useLanguage();

  // Truncate content for preview
  const getContentPreview = (html) => {
    const div = window.document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || div.innerText || '';
    return text.length > 150 ? text.substring(0, 150) + '...' : text;
  };

  return (
    <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-dashed border-amber-300 hover:border-amber-400 transition-all hover:shadow-lg">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
            <Plus className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                {t('newSection')}
              </Badge>
              <span className="text-xs text-slate-500">
                {t('by')} {getUserName(suggestion.created_by)}
              </span>
            </div>
            <h3 className="font-semibold text-slate-900 text-sm md:text-base mb-2 break-words">
              {typeof suggestion.title === 'string' ? suggestion.title : String(suggestion.title || '')}
            </h3>
            {suggestion.explanation && (
              <div className="text-xs md:text-sm mb-2">
                <TranslatableContent
                  content={suggestion.explanation}
                  entity={suggestion}
                  entityType="Suggestion"
                  className="text-slate-600 break-words"
                />
              </div>
            )}
            <div className="text-sm bg-white/60 p-3 rounded border border-amber-200 mb-3">
              <TranslatableContent
                content={getContentPreview(suggestion.newContent)}
                entity={suggestion}
                entityType="Suggestion"
                className="text-slate-700"
              />
            </div>
          </div>
        </div>

        <div className={`flex items-center justify-between gap-3 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1 text-green-600">
              <ThumbsUp className="w-4 h-4" />
              <span className="font-medium">{suggestion.proVotes || 0}</span>
            </div>
            <div className="flex items-center gap-1 text-red-600">
              <ThumbsDown className="w-4 h-4" />
              <span className="font-medium">{suggestion.conVotes || 0}</span>
            </div>
            <VotesNeededCounter 
              suggestion={suggestion}
              document={doc}
              acceptedSuggestions={acceptedSuggestions}
            />
          </div>
          
          <Link to={`${createPageUrl("SuggestionDetail")}?id=${suggestion.id}`}>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
              <ExternalLink className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('viewDetails')}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}