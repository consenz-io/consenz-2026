import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, X, MessageCircle, Sparkles } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";

export default function ActivityChatBot() {
  const { language, isRTL } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef(null);

  // Fetch recent activity data
  const { data: recentSuggestions = [] } = useQuery({
    queryKey: ['recentSuggestions'],
    queryFn: () => base44.entities.Suggestion.filter({ status: 'accepted' }, '-created_date', 5),
    initialData: [],
    enabled: isOpen,
  });

  const { data: recentComments = [] } = useQuery({
    queryKey: ['recentComments'],
    queryFn: () => base44.entities.Comment.list('-created_date', 10),
    initialData: [],
    enabled: isOpen,
  });

  const { data: allDocuments = [] } = useQuery({
    queryKey: ['allDocuments'],
    queryFn: () => base44.entities.Document.list(),
    initialData: [],
    enabled: isOpen,
  });

  const { data: publicProfiles = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    initialData: [],
    enabled: isOpen,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Generate initial greeting when opened
  useEffect(() => {
    if (isOpen && messages.length === 0 && recentSuggestions.length > 0) {
      generateInitialSummary();
    }
  }, [isOpen, recentSuggestions.length]);

  const getUserName = (email) => {
    const profile = publicProfiles.find(p => p.email === email);
    return profile?.fullName || email?.split('@')[0] || 'משתמש';
  };

  const getDocumentName = (docId) => {
    const doc = allDocuments.find(d => d.id === docId);
    return doc?.title || 'מסמך';
  };

  const generateInitialSummary = async () => {
    setIsGenerating(true);
    
    // Build activity summary for LLM
    const activityData = recentSuggestions.slice(0, 3).map(s => {
      const docName = getDocumentName(s.documentId);
      const userName = getUserName(s.created_by);
      const relatedComments = recentComments.filter(c => 
        c.rootEntityType === 'suggestion' && c.rootEntityId === s.id
      );
      
      return {
        document: docName,
        suggestionTitle: s.title,
        suggestionType: s.type === 'new_section' ? 'הוספת סעיף חדש' : s.type === 'edit_section' ? 'עריכת סעיף' : 'מחיקת סעיף',
        author: userName,
        proVotes: s.proVotes || 0,
        conVotes: s.conVotes || 0,
        commentsCount: relatedComments.length,
        explanation: s.explanation || ''
      };
    });

    const prompt = language === 'he' 
      ? `אתה עוזר וירטואלי ידידותי ולא רשמי של פלטפורמת Consenz - פלטפורמה ליצירת מסמכים משותפים באופן דמוקרטי.

תפקידך: לסכם את הפעילות האחרונה בפלטפורמה בצורה חמה, אישית ומעניינת. דבר כאילו אתה חבר שמעדכן חבר.

הפעילות האחרונה:
${activityData.map((activity, i) => `
${i + 1}. במסמך "${activity.document}":
   - ${activity.author} הציע ${activity.suggestionType}: "${activity.suggestionTitle}"
   ${activity.explanation ? `- ההסבר: ${activity.explanation.substring(0, 100)}` : ''}
   - התקבל ${activity.proVotes} קולות בעד ו-${activity.conVotes} קולות נגד
   ${activity.commentsCount > 0 ? `- התפתח דיון עם ${activity.commentsCount} תגובות` : ''}
`).join('\n')}

כתוב סיכום קצר (3-4 משפטים) בסגנון ידידותי ולא רשמי. השתמש בשפה פשוטה, הוסף אמוג'י אם מתאים.
סיים בעידוד חם להשתתף - לשאול שאלות, להציע הצעות חדשות או להגיב לדיונים.

חשוב: כתוב את הסיכום ישירות בעברית, בלי "הנה הסיכום" או מבואות אחרות.`
      : `You are a friendly, casual virtual assistant for Consenz - a platform for creating shared documents democratically.

Your role: Summarize recent platform activity in a warm, personal, and engaging way. Speak as if you're a friend updating a friend.

Recent activity:
${activityData.map((activity, i) => `
${i + 1}. In document "${activity.document}":
   - ${activity.author} suggested ${activity.suggestionType}: "${activity.suggestionTitle}"
   ${activity.explanation ? `- Explanation: ${activity.explanation.substring(0, 100)}` : ''}
   - Received ${activity.proVotes} pro votes and ${activity.conVotes} con votes
   ${activity.commentsCount > 0 ? `- Discussion with ${activity.commentsCount} comments` : ''}
`).join('\n')}

Write a short summary (3-4 sentences) in a friendly, casual style. Use simple language, add emojis if appropriate.
End with warm encouragement to participate - ask questions, suggest new ideas, or join discussions.

Important: Write the summary directly, no "Here's the summary" or other introductions.`;

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        add_context_from_internet: false,
      });

      const summary = typeof result === 'string' ? result : result.content || result;
      
      setMessages([{
        role: 'assistant',
        content: summary.trim()
      }]);
    } catch (error) {
      console.error('Error generating summary:', error);
      setMessages([{
        role: 'assistant',
        content: language === 'he' 
          ? '👋 שלום! אני כאן כדי לעדכן אותך על הפעילות האחרונה ולעזור לך להשתתף. מה תרצה לדעת?'
          : '👋 Hi! I\'m here to update you on recent activity and help you participate. What would you like to know?'
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const sendMessageMutation = useMutation({
    mutationFn: async (userMessage) => {
      const conversationHistory = messages.map(m => 
        `${m.role === 'user' ? 'משתמש' : 'עוזר'}: ${m.content}`
      ).join('\n');

      const prompt = language === 'he'
        ? `אתה עוזר וירטואלי ידידותי של פלטפורמת Consenz - פלטפורמה ליצירת מסמכים משותפים.

היסטוריית שיחה:
${conversationHistory}

שאלה חדשה מהמשתמש: ${userMessage}

ענה בצורה ידידותית, תמציתית ומעודדת. אם המשתמש שואל על איך להשתתף - הסבר בקצרה על הצבעות, הצעות חדשות וכתיבת תגובות.
עודד פעולה קונקרטית.

כתוב את התשובה ישירות בעברית, ללא מבואות.`
        : `You are a friendly virtual assistant for Consenz - a platform for creating shared documents.

Conversation history:
${conversationHistory}

New user question: ${userMessage}

Answer in a friendly, concise, and encouraging way. If the user asks about participation - briefly explain voting, new suggestions, and comments.
Encourage concrete action.

Write the answer directly, no introductions.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        add_context_from_internet: false,
      });

      return typeof result === 'string' ? result : result.content || result;
    },
    onMutate: (userMessage) => {
      setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
      setInput("");
      setIsGenerating(true);
    },
    onSuccess: (response) => {
      setMessages(prev => [...prev, { role: 'assistant', content: response.trim() }]);
      setIsGenerating(false);
    },
    onError: () => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: language === 'he' 
          ? 'סליחה, משהו השתבש. נסה שוב בבקשה 🙏' 
          : 'Sorry, something went wrong. Please try again 🙏'
      }]);
      setIsGenerating(false);
    }
  });

  const handleSend = () => {
    if (!input.trim() || isGenerating) return;
    sendMessageMutation.mutate(input.trim());
  };

  return (
    <>
      {/* Floating Chat Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 left-6 z-50 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all"
            aria-label={language === 'he' ? 'פתח צ\'ט פעילות' : 'Open activity chat'}
          >
            <div className="relative">
              <MessageCircle className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
              </span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 left-6 z-50 w-96 max-w-[calc(100vw-3rem)]"
          >
            <Card className="shadow-2xl border-2 border-blue-200">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    <CardTitle className="text-lg">
                      {language === 'he' ? 'מה קורה בפלטפורמה?' : 'What\'s happening?'}
                    </CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="text-white hover:bg-white/20 h-8 w-8 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Messages */}
                <div className="h-80 overflow-y-auto p-4 space-y-3 bg-slate-50">
                  {messages.length === 0 && isGenerating && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">
                        {language === 'he' ? 'מכין סיכום...' : 'Preparing summary...'}
                      </span>
                    </div>
                  )}
                  
                  {messages.map((message, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg p-3 ${
                          message.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-slate-800 shadow-sm border border-slate-200'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {message.content}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                  
                  {isGenerating && messages.length > 0 && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">
                        {language === 'he' ? 'כותב...' : 'Writing...'}
                      </span>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-3 border-t border-slate-200 bg-white">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSend();
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={language === 'he' ? 'שאל משהו...' : 'Ask something...'}
                      disabled={isGenerating}
                      className="flex-1"
                      dir={isRTL ? 'rtl' : 'ltr'}
                    />
                    <Button
                      type="submit"
                      disabled={!input.trim() || isGenerating}
                      size="icon"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}