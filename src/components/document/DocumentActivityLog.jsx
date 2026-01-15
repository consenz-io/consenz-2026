import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, 
  MessageSquare, 
  CheckCircle, 
  XCircle, 
  ThumbsUp, 
  Eye, 
  UserPlus, 
  UserMinus,
  FileSignature,
  Trash2,
  Edit,
  Plus,
  Clock
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

const eventIcons = {
  suggestion_created: Plus,
  suggestion_accepted: CheckCircle,
  suggestion_rejected: XCircle,
  section_created: FileText,
  section_updated: Edit,
  section_deleted: Trash2,
  comment_created: MessageSquare,
  vote_cast: ThumbsUp,
  user_followed_document: Eye,
  user_unfollowed_document: UserMinus,
  document_signed: FileSignature,
  document_unsigned: UserMinus,
  topic_created: Plus,
  topic_updated: Edit,
};

const eventColors = {
  suggestion_created: "text-blue-600 bg-blue-50",
  suggestion_accepted: "text-green-600 bg-green-50",
  suggestion_rejected: "text-red-600 bg-red-50",
  section_created: "text-purple-600 bg-purple-50",
  section_updated: "text-amber-600 bg-amber-50",
  section_deleted: "text-red-600 bg-red-50",
  comment_created: "text-slate-600 bg-slate-50",
  vote_cast: "text-blue-600 bg-blue-50",
  user_followed_document: "text-teal-600 bg-teal-50",
  user_unfollowed_document: "text-slate-600 bg-slate-50",
  document_signed: "text-green-600 bg-green-50",
  document_unsigned: "text-slate-600 bg-slate-50",
  topic_created: "text-indigo-600 bg-indigo-50",
  topic_updated: "text-amber-600 bg-amber-50",
};

export default function DocumentActivityLog({ documentId, isOpen, onClose }) {
  const { t, isRTL } = useLanguage();
  const [filterType, setFilterType] = useState("all");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['documentEvents', documentId],
    queryFn: () => base44.entities.DocumentEvent.filter({ documentId }, '-created_date', 100),
    enabled: !!documentId && isOpen,
    initialData: [],
  });

  const filteredEvents = filterType === "all" 
    ? events 
    : events.filter(e => e.eventType.includes(filterType));

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return isRTL ? 'עכשיו' : 'now';
    if (diffMins < 60) return isRTL ? `לפני ${diffMins} דקות` : `${diffMins}m ago`;
    if (diffHours < 24) return isRTL ? `לפני ${diffHours} שעות` : `${diffHours}h ago`;
    if (diffDays < 7) return isRTL ? `לפני ${diffDays} ימים` : `${diffDays}d ago`;
    return date.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEventLink = (event) => {
    if (event.relatedEntityType === 'suggestion' && event.relatedEntityId) {
      return `${createPageUrl("SuggestionDetail")}?id=${event.relatedEntityId}`;
    }
    if (event.relatedEntityType === 'section' && event.relatedEntityId) {
      return `${createPageUrl("SectionHistory")}?id=${event.relatedEntityId}`;
    }
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {isRTL ? 'יומן אירועים' : 'Activity Log'}
          </DialogTitle>
          <DialogDescription>
            {isRTL 
              ? 'היסטוריה מלאה של כל הפעולות במסמך זה'
              : 'Complete history of all actions in this document'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 flex-wrap mb-4">
          <Button
            variant={filterType === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("all")}
          >
            {isRTL ? 'הכל' : 'All'}
          </Button>
          <Button
            variant={filterType === "suggestion" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("suggestion")}
          >
            {isRTL ? 'הצעות' : 'Suggestions'}
          </Button>
          <Button
            variant={filterType === "section" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("section")}
          >
            {isRTL ? 'סעיפים' : 'Sections'}
          </Button>
          <Button
            variant={filterType === "comment" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("comment")}
          >
            {isRTL ? 'תגובות' : 'Comments'}
          </Button>
        </div>

        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="text-center py-8 text-slate-500">
              {isRTL ? 'טוען...' : 'Loading...'}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              {isRTL ? 'אין אירועים להצגה' : 'No events to display'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents.map((event) => {
                const Icon = eventIcons[event.eventType] || Clock;
                const colorClass = eventColors[event.eventType] || "text-slate-600 bg-slate-50";
                const eventLink = getEventLink(event);

                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <div className={`p-2 rounded-lg ${colorClass} shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          {eventLink ? (
                            <Link 
                              to={eventLink}
                              onClick={onClose}
                              className="text-sm font-medium text-slate-900 hover:text-blue-600 hover:underline"
                            >
                              {event.summary}
                            </Link>
                          ) : (
                            <p className="text-sm font-medium text-slate-900">
                              {event.summary}
                            </p>
                          )}
                          <p className="text-xs text-slate-500 mt-1">
                            {isRTL ? 'על ידי' : 'by'} {event.userName}
                          </p>
                        </div>
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {getTimeAgo(event.created_date)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}