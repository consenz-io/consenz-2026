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
  contributors // Array of { email, name, id }
}) {
  const { t, isRTL } = useLanguage();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Users className="w-5 h-5 text-indigo-600" />
            {t('collaborators')} ({contributors.length})
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto mt-4">
          {contributors.length === 0 ? (
            <p className="text-slate-500 text-center py-8">{t('noContributors')}</p>
          ) : (
            <div className="space-y-2">
              {contributors.map((contributor, index) => (
                <Link
                  key={contributor.id || contributor.email || index}
                  to={contributor.id ? `${createPageUrl("Profile")}?userId=${contributor.id}` : '#'}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-medium">
                      {contributor.name?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {contributor.name || t('anonymous')}
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