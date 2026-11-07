import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDocumentParticipants } from "./calculateContributors";
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

  // One document-scoped call returns both the count and the roster — the modal
  // used to run seven queries and rebuild the participant list itself.
  const { data, isLoading: loading } = useQuery({
    queryKey: ['documentParticipants', documentId, language],
    queryFn: () => getDocumentParticipants(documentId, { language }),
    enabled: isOpen && !!documentId,
    staleTime: 60000,
  });

  const contributors = data?.participants || [];
  const totalCount = data?.count || 0;

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
            {t('contributors')} ({loading ? '…' : totalCount})
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