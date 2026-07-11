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
import { Input } from "@/components/ui/input";
import { Users, Loader2, Search } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function ContributorsModal({ isOpen, onClose, documentId }) {
  const { t, isRTL, language } = useLanguage();
  const [searchQuery, setSearchQuery] = React.useState("");

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

  const { data: publicProfiles = [] } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
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

  const { data: allAgreements = [] } = useQuery({
    queryKey: ['documentAgreements', documentId],
    queryFn: () => base44.entities.DocumentAgreement.filter({ documentId }),
    enabled: isOpen && !!documentId,
    staleTime: 30000,
  });

  const { contributors, loading } = useMemo(() => {
    if (!document) {
      return { contributors: [], loading: true };
    }

    // Same criteria as the counter: voters, commenters, signers
    const contributorEmails = new Set();
    
    const suggestionIds = new Set(suggestions.map(s => s.id));
    const sectionIds = new Set(sections.map(s => s.id));

    // 1. Voters
    allVotes.forEach(v => {
      if (suggestionIds.has(v.suggestionId)) {
        if (v.created_by) contributorEmails.add(v.created_by);
        const profile = publicProfiles.find(p => p.userId === v.userId);
        if (profile?.email) contributorEmails.add(profile.email);
      }
    });

    // 2. Commenters on suggestions
    allComments.forEach(c => {
      if (c.rootEntityType === 'suggestion' && suggestionIds.has(c.rootEntityId) && c.created_by) {
        contributorEmails.add(c.created_by);
      }
    });

    // 3. Commenters on sections
    allComments.forEach(c => {
      if (c.rootEntityType === 'section' && sectionIds.has(c.rootEntityId) && c.created_by) {
        contributorEmails.add(c.created_by);
      }
    });

    // 4. Commenters on document
    allComments.forEach(c => {
      if (c.rootEntityType === 'document' && c.rootEntityId === documentId && c.created_by) {
        contributorEmails.add(c.created_by);
      }
    });

    // 5. Signers
    allAgreements.forEach(a => {
      if (a.userEmail) contributorEmails.add(a.userEmail);
    });

    // Build contributors list
    const contributorsMap = new Map();
    publicProfiles.forEach(profile => {
      if (contributorEmails.has(profile.email) && profile.userId) {
        contributorsMap.set(profile.userId, {
          id: profile.userId,
          email: profile.email,
          full_name: profile.fullName || 'User',
        });
      }
    });
    
    return { contributors: Array.from(contributorsMap.values()), loading: false };
  }, [document, suggestions, sections, publicProfiles, allVotes, allComments, allAgreements, documentId]);

  const filteredContributors = useMemo(() => {
    if (!searchQuery || !contributors) return contributors || [];
    const query = searchQuery.toLowerCase();
    return contributors.filter(c => {
      const name = c.full_name || '';
      const email = c.email || '';
      return name.toLowerCase().includes(query) || email.toLowerCase().includes(query);
    });
  }, [contributors, searchQuery]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Users className="w-5 h-5 text-blue-600" />
            {t('contributors')} ({contributors.length})
          </DialogTitle>
        </DialogHeader>

        <div className="px-1">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-4 h-4 text-slate-400" />
            <Input
              placeholder={language === 'he' ? "חיפוש לפי שם..." : language === 'ar' ? "ابحث بالاسم..." : "Search by name..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredContributors.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              {searchQuery ? (language === 'he' ? 'לא נמצאו תוצאות' : language === 'ar' ? 'لا توجد نتائج' : 'No results found') : t('noContributors')}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredContributors.map((user) => (
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
                      {user.full_name || 'User'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {filteredContributors.length > 0 && searchQuery && (
          <div className="text-sm text-slate-600 text-center pt-2 border-t">
            {filteredContributors.length} {language === 'he' ? 'מתוך' : language === 'ar' ? 'من' : 'of'} {contributors?.length || 0}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}