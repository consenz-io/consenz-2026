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

  // Fetch all users from the system (same as System User Management)
  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list('-created_date'),
    enabled: isOpen,
  });

  const filteredUsers = React.useMemo(() => {
    if (!searchQuery) return allUsers;
    const query = searchQuery.toLowerCase();
    return allUsers.filter(u => 
      u.full_name?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query)
    );
  }, [allUsers, searchQuery]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Users className="w-5 h-5 text-indigo-600" />
            {t('collaborators')} ({allUsers.length})
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
          ) : filteredUsers.length === 0 ? (
            <p className="text-slate-500 text-center py-8">{t('noContributors')}</p>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((user) => (
                <Link
                  key={user.id}
                  to={`${createPageUrl("Profile")}?userId=${user.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-medium">
                      {user.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 truncate">
                        {user.full_name || user.email}
                      </p>
                      {user.role === 'admin' && (
                        <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                          Admin
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {filteredUsers.length > 0 && searchQuery && (
          <div className="text-sm text-slate-600 text-center pt-2 border-t">
            {filteredUsers.length} of {allUsers.length}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}