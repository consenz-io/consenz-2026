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

  const suggestionIds = useMemo(() => suggestions.map(s => s.id), [suggestions]);
  const sectionIds = useMemo(() => sections.map(s => s.id), [sections]);

  const { data: relevantVotes = [] } = useQuery({
    queryKey: ['documentVotes', documentId],
    queryFn: async () => {
      if (suggestionIds.length === 0) return [];
      const allVotes = await base44.entities.Vote.list();
      return allVotes.filter(v => suggestionIds.includes(v.suggestionId));
    },
    enabled: isOpen && suggestionIds.length > 0,
    staleTime: 30000,
  });

  const { data: relevantComments = [] } = useQuery({
    queryKey: ['documentComments', documentId],
    queryFn: async () => {
      const comments = [];
      if (suggestionIds.length > 0) {
        const suggComments = await base44.entities.Comment.filter({ rootEntityType: 'suggestion' });
        comments.push(...suggComments.filter(c => suggestionIds.includes(c.rootEntityId)));
      }
      if (sectionIds.length > 0) {
        const sectComments = await base44.entities.Comment.filter({ rootEntityType: 'section' });
        comments.push(...sectComments.filter(c => sectionIds.includes(c.rootEntityId)));
      }
      const docComments = await base44.entities.Comment.filter({ 
        rootEntityType: 'document',
        rootEntityId: documentId 
      });
      comments.push(...docComments);
      return comments;
    },
    enabled: isOpen,
    staleTime: 30000,
  });

  const { data: relevantArguments = [] } = useQuery({
    queryKey: ['documentArguments', documentId],
    queryFn: async () => {
      if (suggestionIds.length === 0) return [];
      const allArgs = await base44.entities.Argument.list();
      return allArgs.filter(arg => suggestionIds.includes(arg.suggestionId));
    },
    enabled: isOpen && suggestionIds.length > 0,
    staleTime: 30000,
  });

  const { contributors, loading } = useMemo(() => {
    if (!document) {
      return { contributors: [], loading: true };
    }

    // Map: email -> { full_name, email }
    const contributorMap = new Map();
    
    // Helper to add contributor with name priority from entity fields
    const addContributor = (email, name) => {
      if (!email) return;
      const existing = contributorMap.get(email);
      if (!existing || (!existing.full_name && name)) {
        contributorMap.set(email, {
          email,
          full_name: name || existing?.full_name || null
        });
      }
    };

    // Document creator (no name stored in document entity)
    if (document.created_by) {
      addContributor(document.created_by, null);
    }

    // Suggestion creators
    suggestions.forEach(s => {
      addContributor(s.created_by, s.createdByFullName);
    });

    // Section editors
    sections.forEach(s => {
      addContributor(s.created_by, s.lastEditedByFullName);
      if (s.lastEditedBy && s.lastEditedBy.includes('@')) {
        addContributor(s.lastEditedBy, s.lastEditedByFullName);
      }
    });

    // Voters
    relevantVotes.forEach(v => {
      addContributor(v.created_by, v.voterFullName);
    });

    // Argument writers
    relevantArguments.forEach(arg => {
      addContributor(arg.created_by, arg.createdByFullName);
    });

    // Commenters
    relevantComments.forEach(c => {
      addContributor(c.created_by, c.createdByFullName);
    });

    // Build final list - use stored names or fallback to Anonymous
    const contributorsList = Array.from(contributorMap.values()).map(({ email, full_name }) => ({
      id: email,
      email: email,
      full_name: full_name?.trim() || 'Anonymous',
      role: 'user'
    }));
    
    return { contributors: contributorsList, loading: false };
  }, [document, suggestions, sections, relevantVotes, relevantComments, relevantArguments]);

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
            {contributors.map((contributor) => (
              <Link
                key={contributor.id}
                to={`${createPageUrl("Profile")}?userId=${contributor.id}`}
                className="flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-medium text-sm md:text-base">
                    {contributor.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm md:text-base text-slate-900 truncate">
                    {contributor.full_name}
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