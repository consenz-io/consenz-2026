import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function ContributorsModal({ isOpen, onClose, documentId }) {
  const { t } = useLanguage();

  // Fetch all data in parallel with caching
  const { data: document } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => base44.entities.Document.filter({ id: documentId }).then(d => d[0]),
    enabled: isOpen && !!documentId,
    staleTime: 30000,
  });

  const { data: suggestions = [] } = useQuery({
    queryKey: ['suggestions', documentId],
    queryFn: () => base44.entities.Suggestion.filter({ documentId }),
    enabled: isOpen && !!documentId,
    staleTime: 30000,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['sections', documentId],
    queryFn: () => base44.entities.Section.filter({ documentId }),
    enabled: isOpen && !!documentId,
    staleTime: 30000,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    enabled: isOpen,
    staleTime: 60000,
  });

  const { data: allVotes = [] } = useQuery({
    queryKey: ['allVotes'],
    queryFn: () => base44.entities.Vote.list(),
    enabled: isOpen && suggestions.length > 0,
    staleTime: 30000,
  });

  const { data: allComments = [] } = useQuery({
    queryKey: ['allComments'],
    queryFn: () => base44.entities.Comment.list(),
    enabled: isOpen,
    staleTime: 30000,
  });

  const { data: allArguments = [] } = useQuery({
    queryKey: ['allArguments'],
    queryFn: () => base44.entities.Argument.list(),
    enabled: isOpen && suggestions.length > 0,
    staleTime: 30000,
  });

  const { contributors, loading } = useMemo(() => {
    if (!document || !allUsers.length) {
      return { contributors: [], loading: true };
    }

    const contributorEmails = new Set();
    
    // Document creator
    if (document.created_by) contributorEmails.add(document.created_by);

    // Suggestion creators
    suggestions.forEach(s => {
      if (s.created_by) contributorEmails.add(s.created_by);
    });

    // Voters - גם לפי userId וגם לפי created_by של ההצבעה
    const suggestionIds = new Set(suggestions.map(s => s.id));
    const voterIds = new Set();
    allVotes.forEach(v => {
      if (suggestionIds.has(v.suggestionId)) {
        voterIds.add(v.userId);
        // גם להוסיף את created_by של ההצבעה ישירות
        if (v.created_by) contributorEmails.add(v.created_by);
      }
    });
    allUsers.forEach(user => {
      if (voterIds.has(user.id)) contributorEmails.add(user.email);
    });

    // Argument writers
    allArguments.forEach(arg => {
      if (suggestionIds.has(arg.suggestionId) && arg.created_by) {
        contributorEmails.add(arg.created_by);
      }
    });

    // Commenters on suggestions
    allComments.forEach(c => {
      if (c.rootEntityType === 'suggestion' && suggestionIds.has(c.rootEntityId) && c.created_by) {
        contributorEmails.add(c.created_by);
      }
    });

    // Commenters on sections
    const sectionIds = new Set(sections.map(s => s.id));
    allComments.forEach(c => {
      if (c.rootEntityType === 'section' && sectionIds.has(c.rootEntityId) && c.created_by) {
        contributorEmails.add(c.created_by);
      }
    });

    // Document comments
    allComments.forEach(c => {
      if (c.rootEntityType === 'document' && c.rootEntityId === documentId && c.created_by) {
        contributorEmails.add(c.created_by);
      }
    });

    const contributorsList = allUsers.filter(user => contributorEmails.has(user.email));
    return { contributors: contributorsList, loading: false };
  }, [document, suggestions, sections, allUsers, allVotes, allComments, allArguments, documentId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            {t('contributors')} ({contributors.length})
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : contributors.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            {t('noContributors')}
          </div>
        ) : (
          <div className="space-y-2">
            {contributors.map((user) => (
              <Link
                key={user.id}
                to={`${createPageUrl("Profile")}?userId=${user.id}`}
                className="flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-medium text-sm md:text-base">
                    {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm md:text-base text-slate-900 truncate">
                    {user.full_name}
                  </p>
                </div>
                {user.role === 'admin' && (
                  <Badge variant="outline" className="text-[10px] md:text-xs">
                    {t('admin')}
                  </Badge>
                )}
              </Link>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}