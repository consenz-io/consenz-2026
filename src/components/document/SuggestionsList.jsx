import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, MessageSquare, ArrowRight } from "lucide-react";
import VotesNeededCounter from "./VotesNeededCounter";
import TranslatableContent from "./TranslatableContent";
import { useLanguage } from "@/components/LanguageContext";
import SuggestionCountdown from "./SuggestionCountdown";

export default function SuggestionsList({ suggestions, document, user, isAdmin }) {
  const { t, isRTL, language } = useLanguage();
  const { data: publicProfiles } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    initialData: [],
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      try {
        return await base44.entities.User.list();
      } catch (error) {
        // Expected for non-admins
        return [];
      }
    },
    initialData: [],
    retry: false,
  });

  const getUserName = (email) => {
    // Try public profile first (accessible to everyone)
    const profile = publicProfiles?.find(p => p.email === email);
    if (profile?.fullName) return profile.fullName;
    
    // Fallback to User entity (admins only)
    const user = users?.find(u => u.email === email);
    if (user?.full_name) return user.full_name;
    
    // Last resort
    return 'User';
  };
  const getStatusColor = (status, timerEndsAt) => {
    if (status === 'pending' && timerEndsAt && new Date(timerEndsAt) <= new Date()) {
      return 'bg-slate-100 text-slate-500 border-slate-200'; // expired-pending
    }
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'accepted':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="space-y-4">
      {suggestions.length === 0 ? (
        <Card className="bg-white border-slate-200">
          <CardContent className="p-12 text-center">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">{t('noSuggestionsYet')}</h3>
            <p className="text-slate-600">{t('beFirstToSuggest')}</p>
          </CardContent>
        </Card>
      ) : (
        suggestions.map((suggestion) => (
          <Link key={suggestion.id} to={`${createPageUrl("SuggestionDetail")}?id=${suggestion.id}`}>
            <Card className="bg-white border-slate-200 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer">
              <CardHeader>
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={getStatusColor(suggestion.status, suggestion.timerEndsAt)}>
                        {suggestion.status === 'pending' && suggestion.timerEndsAt && new Date(suggestion.timerEndsAt) <= new Date()
                          ? (language === 'he' ? 'פג תוקף' : language === 'ar' ? 'انتهت' : 'Expired')
                          : t(suggestion.status)}
                      </Badge>
                      <Badge variant="outline">
                        {suggestion.type === 'new_section' ? t('newSection') : t('editSection')}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{suggestion.title}</CardTitle>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {suggestion.explanation && typeof suggestion.explanation === 'string' && (
                    <div className="text-sm text-slate-600 line-clamp-2">
                      <TranslatableContent
                        content={suggestion.explanation}
                        entity={suggestion}
                        entityType="Suggestion"
                        className="text-sm"
                      />
                    </div>
                  )}
                  {suggestion.newContent && (
                    <div className="bg-slate-50 p-3 rounded border border-slate-200">
                      <TranslatableContent
                        content={suggestion.newContent}
                        entity={suggestion}
                        entityType="Suggestion"
                        className="text-sm text-slate-700 line-clamp-3"
                      />
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-4 text-sm items-center">
                    <div className="flex items-center gap-2 text-green-600">
                      <ThumbsUp className="w-4 h-4" />
                      <span className="font-medium">{suggestion.proVotes || 0}</span>
                    </div>
                    <div className="flex items-center gap-2 text-red-600">
                      <ThumbsDown className="w-4 h-4" />
                      <span className="font-medium">{suggestion.conVotes || 0}</span>
                    </div>
                    {suggestion.timerEndsAt && (
                      <SuggestionCountdown timerEndsAt={suggestion.timerEndsAt} size="xs" />
                    )}
                    <VotesNeededCounter suggestion={suggestion} document={document} />
                  </div>

                  <div className="text-xs text-slate-400">
                    {t('created')} {new Date(suggestion.created_date).toLocaleDateString()} {t('by')} {getUserName(suggestion.created_by)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}