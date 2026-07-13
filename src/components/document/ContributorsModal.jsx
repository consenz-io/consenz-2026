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

  const sectionIdsForDoc = useMemo(() => sections.map(s => s.id), [sections]);

  const { data: allSectionVotes = [] } = useQuery({
    queryKey: ['sectionVotes', documentId],
    queryFn: () => sectionIdsForDoc.length > 0
      ? base44.entities.SectionVote.filter({ sectionId: { $in: sectionIdsForDoc } })
      : Promise.resolve([]),
    enabled: isOpen && sectionIdsForDoc.length > 0,
    staleTime: 30000,
  });

  const { contributors, loading } = useMemo(() => {
    if (!document) {
      return { contributors: [], loading: true };
    }

    // Use userId as primary dedup key (same fix as DocumentView / calculateContributorsFromData).
    // This ensures users without a UserPublicProfile are still counted.
    const emailToUserId = new Map();
    publicProfiles.forEach(p => { if (p.email && p.userId) emailToUserId.set(p.email, p.userId); });

    const uniqueParticipants = new Set(); // userIds (primary) + unresolved emails
    const addByKey = (userId, email) => {
      if (userId) uniqueParticipants.add(userId);
      else if (email) { const uid = emailToUserId.get(email); uniqueParticipants.add(uid || email); }
    };

    const suggestionIds = new Set(suggestions.map(s => s.id));
    const sectionIds = new Set(sections.map(s => s.id));

    // 1. Voters on suggestions
    allVotes.forEach(v => {
      if (suggestionIds.has(v.suggestionId)) {
        addByKey(v.userId, v.created_by);
      }
    });

    // 2-4. Commenters on suggestions, sections, and document
    allComments.forEach(c => {
      if (!c.created_by) return;
      if (
        (c.rootEntityType === 'suggestion' && suggestionIds.has(c.rootEntityId)) ||
        (c.rootEntityType === 'section' && sectionIds.has(c.rootEntityId)) ||
        (c.rootEntityType === 'document' && c.rootEntityId === documentId)
      ) {
        addByKey(c.created_by_id, c.created_by);
      }
    });

    // 5. Signers
    allAgreements.forEach(a => { addByKey(a.userId, a.userEmail); });

    // 6. Voters on sections
    allSectionVotes.forEach(v => { addByKey(v.userId, v.created_by); });

    // 7. Suggestion creators
    suggestions.forEach(s => { addByKey(s.created_by_id, s.created_by); });

    // Build contributors list — resolve each key to a displayable user
    const profileByUserId = new Map();
    publicProfiles.forEach(p => { if (p.userId) profileByUserId.set(p.userId, p); });
    const profileByEmail = new Map();
    publicProfiles.forEach(p => { if (p.email) profileByEmail.set(p.email, p); });

    const contributorsMap = new Map();
    for (const key of uniqueParticipants) {
      // key is either a userId or an unresolved email
      const profile = profileByUserId.get(key) || profileByEmail.get(key);
      if (profile) {
        contributorsMap.set(profile.userId, {
          id: profile.userId,
          email: profile.email,
          full_name: profile.fullName || 'User',
        });
      } else if (key.includes('@')) {
        // User with email but no public profile — show email-based name
        contributorsMap.set(key, {
          id: key,
          email: key,
          full_name: key.split('@')[0],
        });
      }
      // Users with only a userId and no profile/email are counted but not displayed
    }

    return { contributors: Array.from(contributorsMap.values()), loading: false };
  }, [document, suggestions, sections, publicProfiles, allVotes, allComments, allAgreements, allSectionVotes, documentId]);

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
            {t('contributors')} ({loading ? '…' : contributors.length})
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