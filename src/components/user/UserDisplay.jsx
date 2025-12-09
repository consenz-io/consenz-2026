import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useUserDisplay, useUsersDisplay } from '@/components/userDisplay/useUserDisplay';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/components/LanguageContext';

/**
 * אווטר עגול עם אותיות ראשונות
 */
export function UserAvatar({ userId, email, size = 'md', className = '' }) {
  const { data: user, isLoading } = useUserDisplay(userId || { email });

  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-10 h-10 text-base',
    lg: 'w-16 h-16 text-2xl',
  };

  if (isLoading) return <Skeleton className={`${sizeClasses[size]} rounded-full ${className}`} />;
  if (!user) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-slate-300 flex items-center justify-center ${className}`}>
        <span className="text-white font-medium">?</span>
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0 ${className}`} title={user.displayName}>
      <span className="text-white font-medium">{user.initials}</span>
    </div>
  );
}

/**
 * רק שם המשתמש
 */
export function UserName({ userId, email, fallback = 'User', className = '' }) {
  const { data: user, isLoading } = useUserDisplay(userId || { email });
  if (isLoading) return <Skeleton className="h-4 w-24 inline-block" />;
  return <span className={className}>{user?.displayName || fallback}</span>;
}

/**
 * קישור לפרופיל
 */
export function UserLink({ userId, email, children, className = '' }) {
  const { data: user, isLoading } = useUserDisplay(userId || { email });
  if (isLoading) return <Skeleton className="h-4 w-32 inline-block" />;
  if (!user?.id) return <span className={className}>{children || user?.displayName || 'User'}</span>;
  
  return (
    <Link to={`${createPageUrl('Profile')}?userId=${user.id}`} className={`hover:text-blue-600 hover:underline transition-colors ${className}`}>
      {children || user.displayName}
    </Link>
  );
}

/**
 * כרטיס משתמש מלא (אווטר + שם + תג)
 */
export function UserCard({ userId, email, showBadge = true, clickable = true, onClick, className = '' }) {
  const { t } = useLanguage();
  const { data: user, isLoading } = useUserDisplay(userId || { email });

  if (isLoading) {
    return (
      <div className={`flex items-center gap-3 p-3 ${className}`}>
        <Skeleton className="w-10 h-10 rounded-full" />
        <Skeleton className="h-4 w-32 flex-1" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`flex items-center gap-3 p-3 opacity-50 ${className}`}>
        <UserAvatar userId={null} />
        <span className="text-slate-500">{t('unknownUser') || 'Unknown User'}</span>
      </div>
    );
  }

  const content = (
    <>
      <UserAvatar userId={user.id} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 truncate">{user.displayName}</p>
      </div>
      {showBadge && user.isAdmin && <Badge variant="outline" className="text-xs">{t('admin') || 'Admin'}</Badge>}
    </>
  );

  if (!clickable) return <div className={`flex items-center gap-3 p-3 ${className}`}>{content}</div>;
  if (onClick) {
    return (
      <button onClick={onClick} className={`flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors w-full text-left ${className}`}>
        {content}
      </button>
    );
  }

  return (
    <Link to={`${createPageUrl('Profile')}?userId=${user.id}`} className={`flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors ${className}`}>
      {content}
    </Link>
  );
}

/**
 * רשימת משתמשים
 */
export function UsersList({ userIds, emptyMessage, showBadge = true, className = '' }) {
  const { t } = useLanguage();
  const { data: users, isLoading } = useUsersDisplay(userIds);

  if (isLoading) {
    return (
      <div className={`space-y-2 ${className}`}>
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <Skeleton className="h-4 w-32 flex-1" />
          </div>
        ))}
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className={`text-center py-8 text-slate-500 ${className}`}>
        {emptyMessage || t('noUsers') || 'No users found'}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {users.map(user => <UserCard key={user.id} userId={user.id} showBadge={showBadge} />)}
    </div>
  );
}

/**
 * תצוגה inline (אווטר קטן + שם)
 */
export function UserInline({ userId, email, linkToProfile = true, className = '' }) {
  const { data: user, isLoading } = useUserDisplay(userId || { email });

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Skeleton className="w-6 h-6 rounded-full" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <UserAvatar size="sm" userId={null} />
        <span className="text-sm text-slate-500">User</span>
      </div>
    );
  }

  const content = (
    <>
      <UserAvatar size="sm" userId={user.id} />
      <span className="text-sm font-medium">{user.displayName}</span>
    </>
  );

  if (!linkToProfile || !user.id) {
    return <div className={`flex items-center gap-2 ${className}`}>{content}</div>;
  }

  return (
    <Link to={`${createPageUrl('Profile')}?userId=${user.id}`} className={`flex items-center gap-2 hover:text-blue-600 transition-colors ${className}`}>
      {content}
    </Link>
  );
}

/**
 * ערימת אווטרים (עד 3)
 */
export function UsersAvatarStack({ userIds, max = 3, size = 'sm', className = '' }) {
  const { data: users, isLoading } = useUsersDisplay(userIds?.slice(0, max));

  if (isLoading) {
    return (
      <div className={`flex -space-x-2 ${className}`}>
        {[1, 2, 3].map(i => <Skeleton key={i} className="w-8 h-8 rounded-full border-2 border-white" />)}
      </div>
    );
  }

  if (!users || users.length === 0) return null;

  const remaining = (userIds?.length || 0) - users.length;

  return (
    <div className={`flex -space-x-2 ${className}`}>
      {users.map(user => (
        <div key={user.id} className="border-2 border-white rounded-full" title={user.displayName}>
          <UserAvatar userId={user.id} size={size} />
        </div>
      ))}
      {remaining > 0 && (
        <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center" title={`+${remaining} more`}>
          <span className="text-xs font-medium text-slate-600">+{remaining}</span>
        </div>
      )}
    </div>
  );
}