import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, Search } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function AllContributorsModal({ 
  isOpen, 
  onClose
}) {
  const { t, isRTL } = useLanguage();
  const [searchQuery, setSearchQuery] = React.useState("");

  // Fetch all public profiles (accessible to everyone, including non-logged-in users)
  const { data: publicProfiles = [], isLoading } = useQuery({
    queryKey: ['publicProfiles'],
    queryFn: () => base44.entities.UserPublicProfile.list(),
    enabled: isOpen,
  });

  const filteredProfiles = React.useMemo(() => {
    if (!searchQuery) return publicProfiles;
    const query = searchQuery.toLowerCase();
    return publicProfiles.filter(p => 
      p.fullName?.toLowerCase().includes(query) ||
      p.email?.toLowerCase().includes(query)
    );
  }, [publicProfiles, searchQuery]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Users className="w-5 h-5 text-indigo-600" />
            {t('collaborators')} ({publicProfiles.length})
          </DialogTitle>
        </DialogHeader>
        
        <div className="px-1">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-4 h-4 text-slate-400" />
            <Input
              placeholder={isRTL ? "חיפוש לפי שם או מייל..." : "Search by name or email..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="text-slate-500 text-center py-8">{t('loading')}</p>
          ) : filteredProfiles.length === 0 ? (
            <p className="text-slate-500 text-center py-8">{t('noContributors')}</p>
          ) : (
            <div className="space-y-2">
              {filteredProfiles.map((profile) => (
                <Link
                  key={profile.userId}
                  to={`${createPageUrl("Profile")}?userId=${profile.userId}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-medium">
                      {profile.fullName?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {profile.fullName || profile.email}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{profile.email}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {filteredProfiles.length > 0 && searchQuery && (
          <div className="text-sm text-slate-600 text-center pt-2 border-t">
            {filteredProfiles.length} of {publicProfiles.length}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}