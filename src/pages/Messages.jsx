import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";
import ConversationList from "@/components/messages/ConversationList";
import ChatView from "@/components/messages/ChatView";
import NewConversationDialog from "@/components/messages/NewConversationDialog";
import { MessageSquare } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

export default function Messages() {
  const { language, isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = React.useState(null);
  const [newRecipientId, setNewRecipientId] = React.useState(null);
  const [showNewDialog, setShowNewDialog] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
    staleTime: 60 * 1000,
  });

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => base44.entities.Conversation.filter({}, "-lastMessageAt", 50),
    enabled: !!user?.id,
    // Real-time subscriptions already deliver new messages; polling is only a safety net.
    refetchInterval: 60000,
  });

  // Resolve the URL once per link: a conversation link opens that conversation, and
  // a "send message" link (from a user profile) opens the conversation with that
  // person if one already exists — otherwise a new, empty one. Resolving against
  // the loaded list also prevents a previously opened conversation from showing.
  const resolvedSearchRef = React.useRef(null);
  React.useEffect(() => {
    if (!user?.id) return;
    const params = new URLSearchParams(location.search);
    const convId = params.get("conversation");
    const recipientId = params.get("newRecipient");

    if (convId) {
      resolvedSearchRef.current = location.search;
      setActiveConversationId(convId);
      setNewRecipientId(null);
      return;
    }

    if (!recipientId || resolvedSearchRef.current === location.search) return;
    if (conversationsLoading) return;

    const existing = conversations.find(
      (c) => c.participants.includes(recipientId) && c.participants.includes(user.id)
    );
    resolvedSearchRef.current = location.search;
    if (existing) {
      setActiveConversationId(existing.id);
      setNewRecipientId(null);
    } else {
      setActiveConversationId(null);
      setNewRecipientId(recipientId);
    }
  }, [location.search, conversations, conversationsLoading, user?.id]);

  // Every real account, so a conversation can be started with anyone and every
  // participant resolves to a display name. Only admins may list accounts, so
  // this is best-effort and used just to recognise deleted accounts.
  const { data: accountIds = [] } = useQuery({
    queryKey: ["messagingAccountIds"],
    queryFn: async () => {
      try {
        const accounts = await base44.entities.User.list("-created_date", 500);
        return accounts.map((a) => a.id);
      } catch (e) {
        return [];
      }
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["messagingProfiles"],
    queryFn: () => base44.entities.UserPublicProfile.list("-created_date", 500),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: unreadMessages = [] } = useQuery({
    queryKey: ["unreadMessages"],
    queryFn: () => base44.entities.Message.filter({ recipientId: user.id, read: false }, "-created_date", 200),
    enabled: !!user?.id,
    refetchInterval: 60000,
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
    allProfiles.forEach((p) => {
      map[p.userId] = p;
    });
    return map;
  }, [allProfiles]);

  const deletedUserLabel = language === "he" ? "משתמש שנמחק" : language === "ar" ? "مستخدم محذوف" : "Deleted user";
  const unknownUserLabel = language === "he" ? "משתמש" : language === "ar" ? "مستخدم" : "User";

  // Display name for any user id: the name they chose in their profile, then
  // the deleted-account label when the account no longer exists.
  const nameFor = React.useCallback((id) => {
    if (!id) return "";
    const name = profileMap[id]?.fullName;
    if (name) return name;
    if (accountIds.length > 0 && !accountIds.includes(id)) return deletedUserLabel;
    return unknownUserLabel;
  }, [profileMap, accountIds, deletedUserLabel, unknownUserLabel]);

  // People a conversation can be started with — never the current user and
  // never an account that no longer exists.
  const people = React.useMemo(
    () => allProfiles
      .filter((p) => p.userId !== user?.id)
      .filter((p) => (accountIds.length > 0 ? accountIds.includes(p.userId) : true))
      .map((p) => ({ userId: p.userId, fullName: p.fullName }))
      .filter((p) => p.fullName),
    [allProfiles, accountIds, user?.id]
  );

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

  const otherUserName = otherUserId ? nameFor(otherUserId) : "";
  const isActiveChat = !!(activeConversationId || newRecipientId);

  const handleSelectConversation = (id) => {
    setActiveConversationId(id);
    setNewRecipientId(null);
  };

  const handleNewConversation = (recipientId) => {
    const id = typeof recipientId === "string" ? recipientId : recipientId?.userId;
    setShowNewDialog(false);
    if (!id) return;

    // Drop any leftover deep-link parameters so the picker's choice wins.
    if (location.search) navigate("/Messages", { replace: true });

    // Open the existing conversation with that person, or a new empty one.
    const existing = conversations.find(
      (c) => (c.participants || []).includes(id) && (c.participants || []).includes(user?.id)
    );
    if (existing) {
      setActiveConversationId(existing.id);
      setNewRecipientId(null);
    } else {
      setActiveConversationId(null);
      setNewRecipientId(id);
    }
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
          nameFor={nameFor}
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
        profiles={people}
        currentUserId={user?.id}
        onSelect={handleNewConversation}
        language={language}
      />
    </div>
  );
}