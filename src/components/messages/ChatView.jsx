import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, ArrowRight, Send, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ChatView({
  conversationId,
  recipientId,
  user,
  otherUserName,
  onBack,
  onConversationCreated,
  language,
  isRTL,
}) {
  const queryClient = useQueryClient();
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const messagesEndRef = React.useRef(null);
  const inputRef = React.useRef(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => base44.entities.Message.filter({ conversationId }, "created_date", 200),
    enabled: !!conversationId,
  });

  // Mark messages as read when conversation is opened
  React.useEffect(() => {
    if (!conversationId || !user?.id) return;
    base44.entities.Message.updateMany(
      { conversationId, recipientId: user.id, read: false },
      { $set: { read: true } }
    )
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
        queryClient.invalidateQueries({ queryKey: ["unreadMessages"] });
      })
      .catch(() => {});
  }, [conversationId, user?.id, queryClient]);

  // Auto-scroll to bottom on new messages
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || !user || !recipientId || sending) return;
    setInput("");
    setSending(true);
    try {
      const res = await base44.functions.invoke("sendMessage", { recipientId, content });
      const newConv = res.data?.conversation;
      if (newConv && !conversationId) {
        onConversationCreated?.(newConv.id);
      } else {
        queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      }
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["unreadMessages"] });
    } catch (e) {
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const initial = otherUserName?.charAt(0).toUpperCase() || "U";
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const SendIcon = Send;

  const placeholderText = language === "he" ? "כתוב הודעה..." : language === "ar" ? "اكتب رسالة..." : "Type a message...";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-slate-200 bg-white flex-shrink-0">
        <button
          onClick={onBack}
          className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Back"
        >
          <BackIcon className="w-5 h-5 text-slate-700" />
        </button>
        <Link to={`${createPageUrl("Profile")}?userId=${recipientId}`} className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900 truncate hover:text-blue-600 transition-colors">{otherUserName}</h2>
          </div>
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : messages.length === 0 && !conversationId ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm text-center px-4">
            {language === "he" ? "שלח את ההודעה הראשונה!" : language === "ar" ? "أرسل أول رسالة!" : "Send the first message!"}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm text-center px-4">
            {language === "he" ? "אין הודעות עדיין" : language === "ar" ? "لا توجد رسائل بعد" : "No messages yet"}
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                    isMine
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-white text-slate-900 border border-slate-200 rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholderText}
            rows={1}
            className="flex-1 resize-none px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:border-blue-400 text-sm max-h-32 overflow-y-auto"
            style={{ minHeight: "42px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white flex items-center justify-center transition-colors"
            aria-label="Send"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <SendIcon className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}