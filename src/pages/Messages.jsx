import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";
import ConversationList from "@/components/messages/ConversationList";
import ChatView from "@/components/messages/ChatView";
import NewConversationDialog from "@/components/messages/NewConversationDialog";
import { MessageSquare, PenSquare } from "lucide-react";

export default function Messages() {
  const { language, isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = React.useState(null);
  const [newRecipientId, setNewRecipientId] = React.useState(null);
  const [showNewDialog, setShowNewDialog] = React.useState(false);

  // Read conversation ID from URL on mount (for deep-linking from notifications)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convId = params.get("conversation");
    if (convId) setActiveConversationId(convId);
  }, []);

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
    staleTime: 60 * 1000,
  });

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => base44.entities.Conversation.filter({}, "-lastMessageAt", 50),
    enabled: !!user?.id,
    refetchInterval: 20000,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["allProfiles"],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    staleTime: 60 * 1000,
  });

  const { data: unreadMessages = [] } = useQuery({
    queryKey: ["unreadMessages"],
    queryFn: () => base44.entities.Message.filter({ recipientId: user.id, read: false }, "-created_date", 200),
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  // Real-time subscriptions
  React.useEffect(() => {
    const unsubMsg = base44.entities.Message.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["unreadMessages"] });
      if (activeConversationId) {
        queryClient.invalidateQueries({ queryKey: ["messages", activeConversationId] });
      }
    });
    const unsubConv = base44.entities.Conversation.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    });
    return () => {
      unsubMsg();
      unsubConv();
    };
  }, [queryClient, activeConversationId]);

  const profileMap = React.useMemo(() => {
    const map = {};
    profiles.forEach((p) => {
      map[p.userId] = p;
    });
    return map;
  }, [profiles]);

  const unreadByConversation = React.useMemo(() => {
    const map = {};
    unreadMessages.forEach((m) => {
      map[m.conversationId] = (map[m.conversationId] || 0) + 1;
    });
    return map;
  }, [unreadMessages]);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const otherUserId = activeConversation
    ? activeConversation.participants.find((p) => p !== user?.id)
    : newRecipientId;

  const otherUserName = otherUserId ? profileMap[otherUserId]?.fullName || "User" : "";
  const isActiveChat = !!(activeConversationId || newRecipientId);

  const handleSelectConversation = (id) => {
    setActiveConversationId(id);
    setNewRecipientId(null);
  };

  const handleNewConversation = (recipientId) => {
    // Check if conversation already exists
    const existing = conversations.find(
      (c) => c.participants.includes(recipientId) && c.participants.includes(user.id)
    );
    if (existing) {
      setActiveConversationId(existing.id);
      setNewRecipientId(null);
    } else {
      setNewRecipientId(recipientId);
      setActiveConversationId(null);
    }
    setShowNewDialog(false);
  };

  const handleBack = () => {
    setActiveConversationId(null);
    setNewRecipientId(null);
  };

  const handleConversationCreated = (conversationId) => {
    setActiveConversationId(conversationId);
    setNewRecipientId(null);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  const emptyStateText = language === "he" ? "בחר שיחה כדי להתחיל להודיע" : language === "ar" ? "اختر محادثة لبدء المراسلة" : "Select a conversation to start messaging";

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white">
      {/* Conversation list */}
      <div className={`w-full md:w-80 lg:w-96 ${isRTL ? "md:border-l" : "md:border-r"} border-slate-200 flex-shrink-0 ${isActiveChat ? "hidden md:flex" : "flex"} flex-col`}>
        <ConversationList
          conversations={conversations}
          loading={conversationsLoading}
          profileMap={profileMap}
          user={user}
          unreadByConversation={unreadByConversation}
          activeConversationId={activeConversationId}
          onSelect={handleSelectConversation}
          onNew={() => setShowNewDialog(true)}
          language={language}
          isRTL={isRTL}
        />
      </div>

      {/* Chat view */}
      <div className={`flex-1 ${isActiveChat ? "flex" : "hidden md:flex"} flex-col min-w-0`}>
        {isActiveChat ? (
          <ChatView
            conversationId={activeConversationId}
            recipientId={otherUserId}
            user={user}
            otherUserName={otherUserName}
            onBack={handleBack}
            onConversationCreated={handleConversationCreated}
            language={language}
            isRTL={isRTL}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
            <MessageSquare className="w-16 h-16 opacity-30" />
            <p className="text-lg font-medium">{emptyStateText}</p>
          </div>
        )}
      </div>

      <NewConversationDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        profiles={profiles}
        currentUserId={user?.id}
        onSelect={handleNewConversation}
        language={language}
      />
    </div>
  );
}