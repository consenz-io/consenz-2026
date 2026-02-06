import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/LanguageContext";
import { formatLocalDateTime } from "@/components/utils/dateFormatter";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function FloatingPointsBadge() {
  const { language, isRTL } = useLanguage();
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: pointsTransactions = [], isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['pointsTransactions', user?.id],
    queryFn: () => base44.entities.PointsTransaction.filter({ userId: user.id }, '-created_date'),
    enabled: !!user?.id,
    initialData: [],
    staleTime: 0,
    refetchOnMount: true,
  });

  const lastPointsVisit = user?.lastPointsVisit;

  const newPointsTransactions = React.useMemo(() => {
    if (!lastPointsVisit) return pointsTransactions;
    const lastVisitDate = new Date(lastPointsVisit);
    return pointsTransactions.filter(t => new Date(t.created_date) > lastVisitDate);
  }, [pointsTransactions, lastPointsVisit]);

  const totalNewPoints = React.useMemo(() => {
    return newPointsTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [newPointsTransactions]);

  const markAsViewedMutation = useMutation({
    mutationFn: async () => {
      await base44.auth.updateMe({ lastPointsVisit: new Date().toISOString() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });

  const hasNewPoints = totalNewPoints > 0;
  const currentPoints = user?.points || 1000;

  if (!user) return null;

  return (
    <Popover onOpenChange={(open) => {
      if (open && hasNewPoints) {
        markAsViewedMutation.mutate();
      }
    }}>
      <PopoverTrigger asChild>
        <button
          className={`bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all hover:scale-110 focus:ring-4 focus:ring-amber-300 ${hasNewPoints ? 'animate-pulse' : ''}`}
          aria-label={language === 'he' ? `${currentPoints} נקודות` : language === 'ar' ? `${currentPoints} نقاط` : `${currentPoints} points`}
        >
          <div className="flex items-center gap-1.5">
            <Coins className="w-5 h-5" aria-hidden="true" />
            <span className="font-bold text-sm">{currentPoints}</span>
          </div>
          {hasNewPoints && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-bounce">
              +{totalNewPoints > 99 ? '99' : totalNewPoints}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 max-h-96 overflow-y-auto" 
        align={isRTL ? 'start' : 'end'}
        side="top"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-semibold text-slate-900">
              {hasNewPoints 
                ? (language === 'he' ? 'נקודות חדשות' : language === 'ar' ? 'نقاط جديدة' : 'New Points')
                : (language === 'he' ? 'הנקודות שלך' : language === 'ar' ? 'نقاطك' : 'Your Points')
              }
            </h3>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-lg font-bold">
              {currentPoints}
            </Badge>
          </div>

          {hasNewPoints && (
            <>
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-3 rounded-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-800">
                    {language === 'he' ? 'נקודות חדשות' : language === 'ar' ? 'نقاط جديدة' : 'New Points'}
                  </span>
                  <span className="text-xl font-bold text-green-600">+{totalNewPoints}</span>
                </div>
              </div>
            </>
          )}

          {isLoadingTransactions && (
            <p className="text-slate-400 text-sm text-center py-4">
              {language === 'he' ? 'טוען...' : language === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}
            </p>
          )}

          {!isLoadingTransactions && newPointsTransactions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-600 uppercase">
                {language === 'he' ? 'אירועים שהובילו לנקודות' : language === 'ar' ? 'الأحداث' : 'Events'}
              </h4>
              {newPointsTransactions.slice(0, 10).map((transaction) => (
                <div 
                  key={transaction.id}
                  className={`p-3 rounded-lg border ${
                    transaction.amount > 0 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={`text-xs font-semibold ${
                          transaction.amount > 0 
                            ? 'bg-green-100 text-green-800 border-green-300' 
                            : 'bg-red-100 text-red-800 border-red-300'
                        }`}>
                          {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {formatLocalDateTime(transaction.created_date, 'DD/MM HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 font-medium">{transaction.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoadingTransactions && newPointsTransactions.length === 0 && !hasNewPoints && (
            <p className="text-slate-500 text-sm text-center py-4">
              {language === 'he' ? 'אין נקודות חדשות' : language === 'ar' ? 'لا توجد نقاط جديدة' : 'No new points'}
            </p>
          )}

          <div className="border-t pt-2">
            <Link to={createPageUrl("Profile")}>
              <Button variant="outline" className="w-full" size="sm">
                {language === 'he' ? 'צפה בכל הנקודות' : language === 'ar' ? 'عرض جميع النقاط' : 'View All Points'}
              </Button>
            </Link>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}