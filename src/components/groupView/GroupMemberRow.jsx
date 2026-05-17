import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/LanguageContext";

export default function GroupMemberRow({ userId, profile, role }) {
  const { language } = useLanguage();

  return (
    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
      <Link to={`${createPageUrl("Profile")}?userId=${userId}`} className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
          {profile?.fullName?.charAt(0)?.toUpperCase() || (language === 'he' ? 'מ' : 'U')}
        </div>
        <p className="text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors truncate">
          {profile?.fullName || (language === 'he' ? 'משתמש' : language === 'ar' ? 'مستخدم' : 'User')}
        </p>
      </Link>
      {role === 'admin' && (
        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
          {language === 'he' ? 'מנהל' : language === 'ar' ? 'مدير' : 'Admin'}
        </Badge>
      )}
    </div>
  );
}