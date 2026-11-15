import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { subscribeToMinute } from "@/components/utils/minuteClock";

// Remaining milliseconds, as a NUMBER so React's bail-out works: setting the
// same value does not re-render. (The old object state created a new object on
// every tick, so every expired card re-rendered once a minute forever.)
const computeRemaining = (timerEndsAt) => Math.max(0, new Date(timerEndsAt) - Date.now());

export default function SuggestionCountdown({ timerEndsAt, size = "sm", status }) {
  const { language } = useLanguage();
  const [remaining, setRemaining] = useState(null);
  const isActive = status === 'pending' && !!timerEndsAt;

  useEffect(() => {
    if (!isActive) {
      setRemaining(null);
      return;
    }

    const now = computeRemaining(timerEndsAt);
    setRemaining(now);
    if (now <= 0) return; // already expired — nothing left to count down

    const unsubscribe = subscribeToMinute(() => {
      const next = computeRemaining(timerEndsAt);
      setRemaining(next); // identical value => no re-render
      if (next <= 0) unsubscribe();
    });
    return unsubscribe;
  }, [timerEndsAt, isActive]);

  if (!isActive || remaining === null) return null;

  if (remaining <= 0) {
    const expiredLabel = language === 'he' ? 'הצבעה הסתיימה' : language === 'ar' ? 'انتهى التصويت' : 'Voting ended';
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
        <Clock className="w-3 h-3" />
        {expiredLabel}
      </span>
    );
  }

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const isUrgent = remaining < 6 * 60 * 60 * 1000; // less than 6 hours

  const label = language === 'he'
    ? `${hours > 0 ? `${hours}ש׳ ` : ''}${minutes}  דקות נותרו לסגירת ההצבעה`
    : language === 'ar'
    ? `${hours > 0 ? `${hours}س ` : ''}${minutes}د متبقية`
    : `${hours > 0 ? `${hours}h ` : ''}${minutes}m left`;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${
      isUrgent ? 'text-red-600' : 'text-amber-600'
    }`}>
      <Clock className="w-3 h-3" />
      {label}
    </span>
  );
}