import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search } from "lucide-react";

export default function NewConversationDialog({
  open,
  onOpenChange,
  profiles,
  currentUserId,
  onSelect,
  language,
}) {
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    const list = profiles.filter((p) => p.userId !== currentUserId);
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (p) =>
        p.fullName?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q)
    );
  }, [profiles, currentUserId, search]);

  const title = language === "he" ? "שיחה חדשה" : language === "ar" ? "محادثة جديدة" : "New Conversation";
  const subtitle = language === "he" ? "בחר משתמש להתחלת שיחה" : language === "ar" ? "اختر مستخدمًا لبدء محادثة" : "Select a user to start a conversation";
  const searchPlaceholder = language === "he" ? "חיפוש לפי שם או אימייל..." : language === "ar" ? "بحث بالاسم أو البريد..." : "Search by name or email...";
  const emptyText = language === "he" ? "לא נמצאו משתמשים" : language === "ar" ? "لم يتم العثور على مستخدمين" : "No users found";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </DialogHeader>

        <div className="relative mt-2">
          <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" style={{ insetInlineStart: "0.75rem" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full py-2.5 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-slate-50"
            style={{ paddingInlineStart: "2.25rem" }}
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto mt-3 space-y-1 -mx-2">
          {filtered.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">{emptyText}</p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p.userId)}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-100 transition-colors text-start"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {p.fullName?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0 text-start">
                  <p className="font-medium text-slate-900 truncate">{p.fullName}</p>
                  <p className="text-xs text-slate-500 truncate">{p.email}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}