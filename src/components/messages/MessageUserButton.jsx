import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { MessageSquare } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function MessageUserButton({ userId, currentUserId, size = "sm" }) {
  const { language } = useLanguage();

  if (!userId || userId === currentUserId) return null;

  const tooltip = language === "he" ? "שלח הודעה" : language === "ar" ? "إرسال رسالة" : "Send message";
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <Link
      to={`${createPageUrl("Messages")}?newRecipient=${userId}`}
      className="inline-flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors align-middle"
      title={tooltip}
      aria-label={tooltip}
    >
      <MessageSquare className={iconSize} />
    </Link>
  );
}