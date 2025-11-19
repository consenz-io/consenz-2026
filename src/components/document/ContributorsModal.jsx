import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function ContributorsModal({ isOpen, onClose, documentId }) {
  const { t, isRTL } = useLanguage();
  const [contributors, setContributors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && documentId) {
      fetchContributors();
    }
  }, [isOpen, documentId]);

  const fetchContributors = async () => {
    setLoading(true);
    try {
      // Get document creator
      const [doc] = await base44.entities.Document.filter({ id: documentId });
      const contributorEmails = new Set();
      if (doc?.created_by) contributorEmails.add(doc.created_by);

      // Get suggestion creators
      const suggestions = await base44.entities.Suggestion.filter({ documentId });
      suggestions.forEach(s => contributorEmails.add(s.created_by));

      // Get voters
      const suggestionIds = suggestions.map(s => s.id);
      if (suggestionIds.length > 0) {
        const votes = await base44.entities.Vote.filter({ 
          suggestionId: { $in: suggestionIds } 
        });
        const voterIds = [...new Set(votes.map(v => v.userId))];
        const voters = await base44.entities.User.list();
        voters.forEach(user => {
          if (voterIds.includes(user.id)) {
            contributorEmails.add(user.email);
          }
        });
      }

      // Get argument writers
      if (suggestionIds.length > 0) {
        const args = await base44.entities.Argument.filter({ 
          suggestionId: { $in: suggestionIds } 
        });
        args.forEach(arg => contributorEmails.add(arg.created_by));
      }

      // Get commenters
      const suggestionComments = await base44.entities.Comment.filter({
        rootEntityType: 'suggestion',
        rootEntityId: { $in: suggestionIds }
      });
      suggestionComments.forEach(c => contributorEmails.add(c.created_by));

      const sections = await base44.entities.Section.filter({ documentId });
      const sectionIds = sections.map(s => s.id);
      if (sectionIds.length > 0) {
        const sectionComments = await base44.entities.Comment.filter({
          rootEntityType: 'section',
          rootEntityId: { $in: sectionIds }
        });
        sectionComments.forEach(c => contributorEmails.add(c.created_by));
      }

      // Fetch user details
      const users = await base44.entities.User.list();
      const contributorsList = users.filter(user => 
        contributorEmails.has(user.email)
      );

      setContributors(contributorsList);
    } catch (error) {
      console.error('[CONTRIBUTORS ERROR]', error);
    } finally {
      setLoading(false);
    }
  };

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
              <div
                key={user.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-medium">
                    {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">
                    {user.full_name}
                  </p>
                  <p className="text-sm text-slate-500 truncate">
                    {user.email}
                  </p>
                </div>
                {user.role === 'admin' && (
                  <Badge variant="outline" className="text-xs">
                    {t('admin')}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}