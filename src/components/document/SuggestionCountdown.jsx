import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function SuggestionCountdown({ timerEndsAt, size = "sm" }) {
  const { language } = useLanguage();
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!timerEndsAt) return;

    const calculate = () => {
      const diff = new Date(timerEndsAt) - new Date();
      if (diff <= 0) {
        setTimeLeft({ expired: true });
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft({ hours, minutes, diff });
    };

    calculate();
    const interval = setInterval(calculate, 60000);
    return () => clearInterval(interval);
  }, [timerEndsAt]);

  if (!timerEndsAt || !timeLeft) return null;

  const isUrgent = timeLeft.diff < 6 * 60 * 60 * 1000; // less than 6 hours

  const label = language === 'he'
    ? `${timeLeft.hours > 0 ? `${timeLeft.hours}ש׳ ` : ''}${timeLeft.minutes}ד׳ נותרו`
    : language === 'ar'
    ? `${timeLeft.hours > 0 ? `${timeLeft.hours}س ` : ''}${timeLeft.minutes}د متبقية`
    : `${timeLeft.hours > 0 ? `${timeLeft.hours}h ` : ''}${timeLeft.minutes}m left`;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${
      isUrgent ? 'text-red-600' : 'text-amber-600'
    }`}>
      <Clock className="w-3 h-3" />
      {label}
    </span>
  );
}