import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UsersList } from "@/components/user";
import { useLanguage } from "@/components/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * חישוב IDs של משתמשים תורמים (לא שמות!)
 */
function calculateContributorIds({ 
  document, 
  suggestions, 
  allVotes, 
  allPublicProfiles, 
  allArguments, 
  allComments, 
  sections 
}) {
  const uniqueUserIds = new Set();
  
  // יוצר המסמך
  if (document?.created_by) {
    const profile = allPublicProfiles?.find(p => p.email === document.created_by);
    if (profile?.userId) uniqueUserIds.add(profile.userId);
  }
  
  // יוצרי הצעות
  suggestions?.forEach(s => {
    if (s.created_by) {
      const profile = allPublicProfiles?.find(p => p.email === s.created_by);
      if (profile?.userId) uniqueUserIds.add(profile.userId);
    }
  });
  
  // מצביעים
  const suggestionIds = new Set(suggestions?.map(s => s.id) || []);
  allVotes?.forEach(v => {
    if (suggestionIds.has(v.suggestionId) && v.userId) {
      uniqueUserIds.add(v.userId);
    }
  });
  
  // כותבי טיעונים
  allArguments?.forEach(arg => {
    if (suggestionIds.has(arg.suggestionId) && arg.created_by) {
      const profile = allPublicProfiles?.find(p => p.email === arg.created_by);
      if (profile?.userId) uniqueUserIds.add(profile.userId);
    }
  });
  
  // מגיבים על הצעות
  allComments?.forEach(c => {
    if (c.rootEntityType === 'suggestion' && suggestionIds.has(c.rootEntityId) && c.created_by) {
      const profile = allPublicProfiles?.find(p => p.email === c.created_by);
      if (profile?.userId) uniqueUserIds.add(profile.userId);
    }
  });
  
  // מגיבים על סעיפים
  const sectionIds = new Set(sections?.map(s => s.id) || []);
  allComments?.forEach(c => {
    if (c.rootEntityType === 'section' && sectionIds.has(c.rootEntityId) && c.created_by) {
      const profile = allPublicProfiles?.find(p => p.email === c.created_by);
      if (profile?.userId) uniqueUserIds.add(profile.userId);
    }
  });
  
  // מגיבים על מסמך
  if (document?.id) {
    allComments?.forEach(c => {
      if (c.rootEntityType === 'document' && c.rootEntityId === document.id && c.created_by) {
        const profile = allPublicProfiles?.find(p => p.email === c.created_by);
        if (profile?.userId) uniqueUserIds.add(profile.userId);
      }
    });
  }
  
  return Array.from(uniqueUserIds);
}

export default function ContributorsModal({ isOpen, onClose, documentId }) {
  const { t } = useLanguage();

  const { data: document } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => base44.entities.Document.filter({ id: documentId }).then(d => d[0]),
    enabled: !!documentId && isOpen,
  });

  const { data: suggestions } = useQuery({
    queryKey: ['suggestions', documentId],
    queryFn: () => base44.entities.Suggestion.filter({ documentId }),
    enabled: !!documentId && isOpen,
    initialData: [],
  });

  const { data: sections } = useQuery({
    queryKey: ['sections', documentId],
    queryFn: () => base44.entities.Section.filter({ documentId }),
    enabled: !!documentId && isOpen,
    initialData: [],
  });

  const { data: allPublicProfiles } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    initialData: [],
    staleTime: 60000,
  });

  const { data: allVotes } = useQuery({
    queryKey: ['allVotes'],
    queryFn: () => base44.entities.Vote.list(),
    initialData: [],
    staleTime: 30000,
  });

  const { data: allArguments } = useQuery({
    queryKey: ['allArguments'],
    queryFn: () => base44.entities.Argument.list(),
    initialData: [],
    staleTime: 30000,
  });

  const { data: allComments } = useQuery({
    queryKey: ['allComments'],
    queryFn: () => base44.entities.Comment.list(),
    initialData: [],
    staleTime: 30000,
  });

  const contributorIds = React.useMemo(() => {
    return calculateContributorIds({
      document,
      suggestions,
      allVotes,
      allPublicProfiles,
      allArguments,
      allComments,
      sections,
    });
  }, [document, suggestions, allVotes, allPublicProfiles, allArguments, allComments, sections]);

  const isLoading = !document || !suggestions || !allPublicProfiles;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {t('contributors')} ({contributorIds?.length || 0})
          </DialogTitle>
          {document?.title && (
            <p className="text-sm text-slate-500">{document.title}</p>
          )}
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <Skeleton className="h-4 w-32 flex-1" />
                </div>
              ))}
            </div>
          ) : (
            <UsersList 
              userIds={contributorIds} 
              emptyMessage={t('noContributors')}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}