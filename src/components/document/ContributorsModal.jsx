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

  // Fetch only relevant votes/comments/arguments for this document's suggestions/sections
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

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    enabled: isOpen,
    staleTime: 60000,
  });

  const { contributors, loading } = useMemo(() => {
    if (!document) {
      return { contributors: [], loading: true };
    }

    const contributorMap = new Map(); // email -> { email, name }
    
    // Document creator
    if (document.created_by) {
      contributorMap.set(document.created_by, {
        email: document.created_by,
        name: null
      });
    }

    // Suggestion creators
    suggestions.forEach(s => {
      if (s.created_by) {
        contributorMap.set(s.created_by, {
          email: s.created_by,
          name: s.createdByFullName || contributorMap.get(s.created_by)?.name || null
        });
      }
    });

    // Section editors
    sections.forEach(s => {
      if (s.created_by) {
        contributorMap.set(s.created_by, {
          email: s.created_by,
          name: s.lastEditedByFullName || contributorMap.get(s.created_by)?.name || null
        });
      }
      if (s.lastEditedBy && s.lastEditedByFullName) {
        // Try to map userId to email from allUsers
        const user = allUsers.find(u => u.id === s.lastEditedBy);
        if (user) {
          contributorMap.set(user.email, {
            email: user.email,
            name: s.lastEditedByFullName || contributorMap.get(user.email)?.name || null
          });
        }
      }
    });

    // Voters
    relevantVotes.forEach(v => {
      // Try to get email from userId
      const user = allUsers.find(u => u.id === v.userId);
      if (user) {
        contributorMap.set(user.email, {
          email: user.email,
          name: v.voterFullName || contributorMap.get(user.email)?.name || null
        });
      }
      // Also add from created_by if exists
      if (v.created_by) {
        contributorMap.set(v.created_by, {
          email: v.created_by,
          name: v.voterFullName || contributorMap.get(v.created_by)?.name || null
        });
      }
    });

    // Argument writers
    relevantArguments.forEach(arg => {
      if (arg.created_by) {
        contributorMap.set(arg.created_by, {
          email: arg.created_by,
          name: arg.createdByFullName || contributorMap.get(arg.created_by)?.name || null
        });
      }
    });

    // Commenters
    relevantComments.forEach(c => {
      if (c.created_by) {
        contributorMap.set(c.created_by, {
          email: c.created_by,
          name: c.createdByFullName || contributorMap.get(c.created_by)?.name || null
        });
      }
    });

    // Build contributors list - prioritize names from entities over User entity
    const contributorsList = Array.from(contributorMap.values()).map(({ email, name }) => {
      // Try to get user from allUsers for id
      const user = allUsers.find(u => u.email === email);
      
      return {
        id: user?.id || email,
        email: email,
        full_name: name || user?.full_name || 'Unknown User',
        role: user?.role || 'user'
      };
    });
    
    return { contributors: contributorsList, loading: false };
  }, [document, suggestions, sections, allUsers, relevantVotes, relevantComments, relevantArguments]);

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
                    {user.full_name && user.full_name.trim() ? user.full_name : (user.email || 'Unknown User')}
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