import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export default function AllContributorsModal({ 
  isOpen, 
  onClose, 
  contributors, // Array of { email, full_name, id, role }
  allUsers = []
}) {
  const { t, isRTL } = useLanguage();

  // Create email to user mapping
  const emailToUser = new Map();
  allUsers.forEach(u => {
    if (u.email) emailToUser.set(u.email, u);
  });

  // Enrich contributors with full_name from User entity
  const enrichedContributors = contributors.map(contributor => {
    const user = emailToUser.get(contributor.email);
    const displayName = user?.full_name?.trim() || 'Anonymous';
    
    return {
      ...contributor,
      full_name: displayName,
      role: user?.role || contributor.role || 'user'
    };
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Users className="w-5 h-5 text-indigo-600" />
            {t('collaborators')} ({enrichedContributors.length})
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto mt-4">
          {enrichedContributors.length === 0 ? (
            <p className="text-slate-500 text-center py-8">{t('noContributors')}</p>
          ) : (
            <div className="space-y-2">
              {enrichedContributors.map((contributor, index) => (
                <Link
                  key={contributor.id || contributor.email || index}
                  to={contributor.id ? `${createPageUrl("Profile")}?userId=${contributor.id}` : '#'}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-medium">
                      {contributor.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {contributor.full_name}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}