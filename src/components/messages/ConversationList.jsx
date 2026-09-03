import React from "react";
import { PenSquare, MessageSquare, Search } from "lucide-react";

function formatRelativeTime(dateStr, language) {
  if (!dateStr) return "";
  const date = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (language === "he") {
    if (diffMin < 1) return "עכשיו";
    if (diffMin < 60) return `לפני ${diffMin} דק׳`;
    if (diffHr < 24) return `לפני ${diffHr} שע׳`;
    if (diffDay < 7) return `לפני ${diffDay} ימים`;
    return date.toLocaleDateString("he-IL");
  }
  if (language === "ar") {
    if (diffMin < 1) return "الآن";
    if (diffMin < 60) return `قبل ${diffMin} د`;
    if (diffHr < 24) return `قبل ${diffHr} س`;
    if (diffDay < 7) return `قبل ${diffDay} أيام`;
    return date.toLocaleDateString("ar");
  }
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US");
}

export default function ConversationList({
  conversations,
  loading,
  profileMap,
  user,
  unreadByConversation,
  activeConversationId,
  onSelect,
  onNew,
  language,
  isRTL,
}) {
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => {
      const otherId = c.participants.find((p) => p !== user?.id);
      const name = profileMap[otherId]?.fullName || "";
      return name.toLowerCase().includes(q);
    });
  }, [conversations, search, profileMap, user]);

  const titleText = language === "he" ? "הודעות" : language === "ar" ? "الرسائل" : "Messages";
  const newText = language === "he" ? "חדש" : language === "ar" ? "جديد" : "New";
  const searchPlaceholder = language === "he" ? "חיפוש..." : language === "ar" ? "بحث..." : "Search...";
  const emptyText = language === "he" ? "אין שיחות עדיין" : language === "ar" ? "لا توجد محادثات بعد" : "No conversations yet";

  return (
    <>
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            {titleText}
          </h1>
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            <PenSquare className="w-4 h-4" />
            {newText}
          </button>
        </div>
        <div className="relative">
          <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" style={{ insetInlineStart: "0.75rem" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full py-2 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-slate-50"
            style={{ paddingInlineStart: "2.25rem" }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/2 bg-slate-200 rounded" />
                  <div className="h-3 w-3/4 bg-slate-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
            <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">{emptyText}</p>
          </div>
        ) : (
          filtered.map((conv) => {
            const otherId = conv.participants.find((p) => p !== user?.id);
            const profile = profileMap[otherId];
            const name = profile?.fullName || "User";
            const initial = name.charAt(0).toUpperCase();
            const unreadCount = unreadByConversation[conv.id] || 0;
            const isActive = conv.id === activeConversationId;

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors text-start border-b border-slate-100 ${
                  isActive ? "bg-blue-50" : ""
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {initial}
                </div>
                <div className="flex-1 min-w-0 text-start">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 truncate">{name}</span>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {formatRelativeTime(conv.lastMessageAt, language)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-sm text-slate-500 truncate">
                      {conv.lastMessageSenderId === user?.id ? "› " : ""}
                      {conv.lastMessagePreview || ""}
                    </p>
                    {unreadCount > 0 && (
                      <span className="flex-shrink-0 bg-blue-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}