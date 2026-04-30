import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
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
  onClose,
  contributors // Array of user objects (from User entity or UserPublicProfile)
}) {
  const { t, isRTL } = useLanguage();
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredContributors = React.useMemo(() => {
    if (!searchQuery || !contributors) return contributors || [];
    const query = searchQuery.toLowerCase();
    return contributors.filter(c => {
      const name = c.name || c.fullName || c.full_name || '';
      return name.toLowerCase().includes(query);
    });
  }, [contributors, searchQuery]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Users className="w-5 h-5 text-indigo-600" />
            {t('collaborators')} ({contributors?.length || 0})
          </DialogTitle>
        </DialogHeader>
        
        <div className="px-1">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-4 h-4 text-slate-400" />
            <Input
              placeholder={isRTL ? "חיפוש לפי שם..." : "Search by name..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {!contributors ? (
            <p className="text-slate-500 text-center py-8">{t('loading')}</p>
          ) : filteredContributors.length === 0 ? (
            <p className="text-slate-500 text-center py-8">{t('noContributors')}</p>
          ) : (
            <div className="space-y-2">
              {filteredContributors.map((contributor, index) => {
                const userId = contributor.userId || contributor.id;
                const name = contributor.name || contributor.fullName || contributor.full_name || contributor.email;
                const isAdmin = contributor.role === 'admin';
                
                return (
                  <Link
                    key={userId || contributor.email || index}
                    to={`${createPageUrl("Profile")}?userId=${userId}`}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-medium">
                        {name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900 truncate">
                          {name}
                        </p>
                        {isAdmin && (
                          <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                            Admin
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {filteredContributors.length > 0 && searchQuery && (
          <div className="text-sm text-slate-600 text-center pt-2 border-t">
            {filteredContributors.length} of {contributors?.length || 0}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}