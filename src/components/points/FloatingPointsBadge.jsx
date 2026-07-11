import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Coins, HelpCircle, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/LanguageContext";
import { formatLocalDateTime } from "@/components/utils/dateFormatter";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import PointsInfoModal from "./PointsInfoModal";
import { resolveCommentUrl } from "@/components/profile/resolveCommentUrl";
import { translateTransactionDescription } from "./translateTransaction";

function AnimatedCounter({ value }) {
  const [displayValue, setDisplayValue] = React.useState(value);

  React.useEffect(() => {
    if (displayValue === value) return;

    const difference = value - displayValue;
    const steps = Math.min(Math.abs(difference), 20);
    const stepValue = difference / steps;
    let current = 0;

    const interval = setInterval(() => {
      current++;
      setDisplayValue(Math.round(displayValue + stepValue * current));
      if (current >= steps) {
        clearInterval(interval);
        setDisplayValue(value);
      }
    }, 20);

    return () => clearInterval(interval);
  }, [value, displayValue]);

  return <span className="font-bold text-sm tabular-nums">{displayValue}</span>;
}

export default function FloatingPointsBadge() {
  const { language, isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showInfoModal, setShowInfoModal] = React.useState(false);
  const [resolvingTxId, setResolvingTxId] = React.useState(null);

  const handleCommentClick = async (transaction) => {
    if (resolvingTxId) return;
    // Fast path — pre-computed URL from the backend
    if (transaction.actionUrl) {
      navigate(transaction.actionUrl);
      return;
    }
    // Fallback — legacy transaction without actionUrl
    if (transaction.relatedEntityType === 'comment' && transaction.relatedEntityId) {
      setResolvingTxId(transaction.id);
      try {
        const url = await resolveCommentUrl(transaction.relatedEntityId);
        if (url) navigate(url);
      } finally {
        setResolvingTxId(null);
      }
    }
  };

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
    if (!lastPointsVisit) {
      // If no last visit, show all transactions
      return pointsTransactions;
    }
    const lastVisitDate = new Date(lastPointsVisit);
    const filtered = pointsTransactions.filter(t => new Date(t.created_date) > lastVisitDate);
    // If no new transactions, fall back to showing all recent ones
    return filtered.length > 0 ? filtered : pointsTransactions;
  }, [pointsTransactions, lastPointsVisit]);

  const totalNewPoints = React.useMemo(() => {
    if (!lastPointsVisit) return 0; // Don't show badge highlight on first visit
    const lastVisitDate = new Date(lastPointsVisit);
    return pointsTransactions
      .filter(t => new Date(t.created_date) > lastVisitDate)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [pointsTransactions, lastPointsVisit]);

  const hasNewPoints = totalNewPoints > 0;
  const currentPoints = user?.points || 1000;

  React.useEffect(() => {
    if (hasNewPoints && lastPointsVisit) {
      // Show toast notification when new points are earned
      toast.success(
        language === 'he' 
          ? `🎉 קיבלת ${totalNewPoints} נקודות חדשות!` 
          : language === 'ar'
          ? `🎉 لقد حصلت على ${totalNewPoints} نقاط جديدة!`
          : `🎉 You earned ${totalNewPoints} new points!`,
        { duration: 5000 }
      );
    }
  }, [hasNewPoints, lastPointsVisit, totalNewPoints, language]);

  const markAsViewedMutation = useMutation({
    mutationFn: async () => {
      await base44.auth.updateMe({ lastPointsVisit: new Date().toISOString() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });

  if (!user) return null;

  return (
    <>
    <Popover onOpenChange={(open) => {
      if (open && hasNewPoints) {
        markAsViewedMutation.mutate();
      }
    }}>
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
        {/* Scrollable feed */}
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

          {hasNewPoints && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-3 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-800">
                  {language === 'he' ? 'נקודות חדשות' : language === 'ar' ? 'نقاط جديدة' : 'New Points'}
                </span>
                <span className="text-xl font-bold text-green-600">+{totalNewPoints}</span>
              </div>
            </div>
          )}

          {isLoadingTransactions && (
            <p className="text-slate-400 text-sm text-center py-4">
              {language === 'he' ? 'טוען...' : language === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}
            </p>
          )}

          {!isLoadingTransactions && newPointsTransactions.length > 0 && (
            <div className="space-y-2">
              {newPointsTransactions.slice(0, 10).map((transaction, index) => {
                const transactionsAfter = newPointsTransactions.slice(0, index);
                const pointsAfter = transactionsAfter.reduce((sum, t) => sum + (t.amount || 0), 0);
                const balanceAtTime = currentPoints - pointsAfter;
                
                const isCommentLike = transaction.action === 'comment_like_received' || transaction.action === 'comment_like_removed';
                const suggestionUrl = transaction.relatedEntityType === 'suggestion'
                  ? createPageUrl('suggestiondetail') + `?id=${transaction.relatedEntityId}`
                  : null;
                const commentClickable = isCommentLike && (transaction.actionUrl || (transaction.relatedEntityType === 'comment' && transaction.relatedEntityId));
                const isResolving = resolvingTxId === transaction.id;

                const itemClasses = `block p-3 rounded-lg border transition-all ${
                  (suggestionUrl || commentClickable) ? 'cursor-pointer hover:shadow-md' : ''
                } ${
                  transaction.amount > 0 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`;

                const innerContent = (
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
                        <span className="text-xs text-slate-400">
                          ({balanceAtTime})
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatLocalDateTime(transaction.created_date, 'DD/MM HH:mm')}
                        </span>
                        {isResolving && <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />}
                      </div>
                      <p className="text-sm text-slate-700 font-medium">{translateTransactionDescription(transaction, language)}</p>
                    </div>
                  </div>
                );

                if (suggestionUrl) {
                  return (
                    <Link key={transaction.id} to={suggestionUrl} className={itemClasses}>
                      {innerContent}
                    </Link>
                  );
                }
                if (commentClickable) {
                  return (
                    <div
                      key={transaction.id}
                      onClick={() => !isResolving && handleCommentClick(transaction)}
                      className={itemClasses}
                    >
                      {innerContent}
                    </div>
                  );
                }
                return (
                  <div key={transaction.id} className={itemClasses}>
                    {innerContent}
                  </div>
                );
              })}
            </div>
          )}

          {!isLoadingTransactions && newPointsTransactions.length === 0 && pointsTransactions.length === 0 && (
            <div className="block p-3 rounded-lg border bg-green-50 border-green-200">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs font-semibold bg-green-100 text-green-800 border-green-300">
                  +1000
                </Badge>
                <span className="text-xs text-slate-400">(1000)</span>
              </div>
              <p className="text-sm text-slate-700 font-medium">
                {language === 'he' ? 'מענק הצטרפות' : language === 'ar' ? 'مكافأة الانضمام' : 'Welcome bonus'}
              </p>
            </div>
          )}
        </div>

        {/* Fixed footer button */}
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