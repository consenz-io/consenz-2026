import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Coins, HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/LanguageContext";
import { formatLocalDateTime } from "@/components/utils/dateFormatter";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import PointsInfoModal from "./PointsInfoModal";
import { useCurrentUser } from "@/hooks/useCurrentUser";

/**
 * OPTIMIZATION: FloatingPointsBadge refactored to:
 * 1. Use shared useCurrentUser hook
 * 2. Memoize transaction description translation
 * 3. Use useCallback for event handlers (prevent child re-renders)
 * 4. Memoize transaction filtering to avoid recalculation
 */

const extractTitle = (description) => description.split(':').slice(1).join(':').trim() || '';

const getTransactionLabel = (transaction, language) => {
  const action = transaction?.action;
  
  if (action === 'suggestion_created') {
    return language === 'he' ? 'יצירת הצעה חדשה' : language === 'ar' ? 'تم إنشاء اقتراح' : 'Created suggestion';
  }
  if (action === 'suggestion_accepted') {
    return language === 'he' ? 'הצעתך התקבלה' : language === 'ar' ? 'تم قبول اقتراحك' : 'Your suggestion was accepted';
  }
  if (action === 'vote_received') {
    return language === 'he' ? 'קיבלת הצבעה בעד' : language === 'ar' ? 'تلقيت تصويتًا مع' : 'Received a pro vote';
  }
  return transaction?.description || '';
};

function AnimatedCounter({ value }) {
  const [displayValue, setDisplayValue] = React.useState(value);
  const displayValueRef = React.useRef(displayValue);

  React.useEffect(() => {
    if (displayValueRef.current === value) return;

    const difference = value - displayValueRef.current;
    const steps = Math.min(Math.abs(difference), 20);
    const stepValue = difference / steps;
    let current = 0;

    const interval = setInterval(() => {
      current++;
      const nextValue = Math.round(displayValueRef.current + stepValue * current);
      setDisplayValue(nextValue);
      if (current >= steps) {
        clearInterval(interval);
        displayValueRef.current = value;
        setDisplayValue(value);
      }
    }, 20);

    return () => clearInterval(interval);
  }, [value]);

  return <span className="font-bold text-sm tabular-nums">{displayValue}</span>;
}

export default function FloatingPointsBadgeOptimized() {
  const { language, isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Use shared hook
  const { data: user } = useCurrentUser();

  // Transactions with pagination (first 50)
  const { data: pointsTransactions = [] } = useQuery({
    queryKey: ['pointsTransactions', user?.id],
    queryFn: () => base44.entities.PointsTransaction.filter({ userId: user.id }, '-created_date', 50),
    enabled: !!user?.id,
    staleTime: 60 * 1000, // Cache for 1 min
    gcTime: 5 * 60 * 1000,
  });

  // OPTIMIZATION: Memoize filtering to avoid recalculation on every render
  const { newTransactions, totalNewPoints } = useMemo(() => {
    const lastVisitDate = user?.lastPointsVisit ? new Date(user.lastPointsVisit) : null;
    const filtered = lastVisitDate
      ? pointsTransactions.filter(t => new Date(t.created_date) > lastVisitDate)
      : pointsTransactions;
    
    const total = lastVisitDate
      ? pointsTransactions
          .filter(t => new Date(t.created_date) > lastVisitDate)
          .reduce((sum, t) => sum + (t.amount || 0), 0)
      : 0;

    return {
      newTransactions: filtered.length > 0 ? filtered : pointsTransactions,
      totalNewPoints: total,
    };
  }, [pointsTransactions, user?.lastPointsVisit]);

  const hasNewPoints = totalNewPoints > 0;
  const currentPoints = user?.points || 1000;

  React.useEffect(() => {
    if (hasNewPoints && user?.lastPointsVisit) {
      toast.success(
        language === 'he' 
          ? `🎉 קיבלת ${totalNewPoints} נקודות חדשות!` 
          : language === 'ar'
          ? `🎉 لقد حصلت على ${totalNewPoints} نقاط جديدة!`
          : `🎉 You earned ${totalNewPoints} new points!`,
        { duration: 5000 }
      );
    }
  }, [hasNewPoints, user?.lastPointsVisit, totalNewPoints, language]);

  const markAsViewedMutation = useMutation({
    mutationFn: async () => {
      await base44.auth.updateMe({ lastPointsVisit: new Date().toISOString() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });

  // OPTIMIZATION: useCallback to prevent re-renders on popover open
  const handleOpenChange = useCallback((open) => {
    if (open && hasNewPoints) {
      markAsViewedMutation.mutate();
    }
  }, [hasNewPoints, markAsViewedMutation]);

  if (!user) return null;

  return (
    <>
      <Popover onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            className={`user-points-badge bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all hover:scale-110 focus:ring-4 focus:ring-amber-300 ${hasNewPoints ? 'animate-pulse scale-110' : ''}`}
            aria-label={language === 'he' ? `${currentPoints} נקודות` : language === 'ar' ? `${currentPoints} نقاط` : `${currentPoints} points`}
          >
            <div className="flex items-center gap-1.5">
              <Coins className="w-5 h-5" aria-hidden="true" />
              <AnimatedCounter value={currentPoints} />
            </div>
            {hasNewPoints && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-bounce">
                +{totalNewPoints > 99 ? '99' : totalNewPoints}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-80 p-0 flex flex-col" 
          style={{ maxHeight: '24rem' }}
          align={isRTL ? 'start' : 'end'}
          side="top"
        >
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
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

            {newTransactions.slice(0, 10).map((transaction, index) => (
              <div
                key={transaction.id}
                className={`block p-3 rounded-lg border transition-all ${
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
                    <p className="text-sm text-slate-700 font-medium">
                      {getTransactionLabel(transaction, language)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t p-2 bg-white shrink-0">
            <Button
              variant="outline"
              className="w-full"
              size="sm"
              onClick={() => setShowInfoModal(true)}
            >
              <HelpCircle className="w-4 h-4 mr-1" />
              {language === 'he' ? 'איך צוברים נקודות?' : language === 'ar' ? 'كيف تكسب النقاط؟' : 'How to Earn Points?'}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <PointsInfoModal open={showInfoModal} onClose={() => setShowInfoModal(false)} />
    </>
  );
}