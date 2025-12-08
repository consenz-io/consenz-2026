import React from "react";
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
import { Loader2, Users } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function ContributorsModal({ isOpen, onClose, documentId = null }) {
  const { t } = useLanguage();

  // Fetch all public profiles
  const { data: allProfiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    enabled: isOpen,
    staleTime: 60000,
  });

  // If documentId is provided, fetch document-specific data
  const { data: suggestions = [] } = useQuery({
    queryKey: ['suggestions', documentId],
    queryFn: () => base44.entities.Suggestion.filter({ documentId }),
    enabled: isOpen && !!documentId,
    initialData: [],
  });

  const { data: allVotes = [] } = useQuery({
    queryKey: ['allVotes'],
    queryFn: () => base44.entities.Vote.list(),
    enabled: isOpen && !!documentId,
    staleTime: 30000,
  });

  const { data: allComments = [] } = useQuery({
    queryKey: ['allComments'],
    queryFn: () => base44.entities.Comment.list(),
    enabled: isOpen && !!documentId,
    staleTime: 30000,
  });

  const { data: allArguments = [] } = useQuery({
    queryKey: ['allArguments'],
    queryFn: () => base44.entities.Argument.list(),
    enabled: isOpen && !!documentId,
    staleTime: 30000,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['sections', documentId],
    queryFn: () => base44.entities.Section.filter({ documentId }),
    enabled: isOpen && !!documentId,
    initialData: [],
  });

  const contributors = React.useMemo(() => {
    if (profilesLoading) return [];

    if (!documentId) {
      // Show all registered users
      return allProfiles
        .map(p => ({
          id: p.userId,
          name: p.fullName || 'User',
          email: p.email
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    // Calculate document-specific contributors
    const contributorEmails = new Set();

    // Suggestion creators
    suggestions.forEach(s => {
      if (s.created_by) contributorEmails.add(s.created_by);
    });

    // Voters
    const suggestionIds = new Set(suggestions.map(s => s.id));
    allVotes.forEach(v => {
      if (suggestionIds.has(v.suggestionId) && v.created_by) {
        contributorEmails.add(v.created_by);
      }
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

    // Match emails to profiles
    const emailToProfile = {};
    allProfiles.forEach(p => { emailToProfile[p.email] = p; });

    const list = Array.from(contributorEmails)
      .map(email => {
        const profile = emailToProfile[email];
        return profile ? {
          id: profile.userId,
          name: profile.fullName || 'User',
          email: profile.email
        } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));

    return list;
  }, [allProfiles, profilesLoading, documentId, suggestions, allVotes, allArguments, allComments, sections]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            {documentId ? t('contributors') : (t('collaborators') || 'Participants')} ({contributors.length})
          </DialogTitle>
        </DialogHeader>

        {profilesLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : contributors.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            {t('noContributors')}
          </div>
        ) : (
          <div className="space-y-2">
            {contributors.map((contributor) => (
              <Link
                key={contributor.id}
                to={`${createPageUrl("Profile")}?userId=${contributor.id}`}
                className="flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-medium text-sm md:text-base">
                    {contributor.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm md:text-base text-slate-900 truncate">
                    {contributor.name}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}