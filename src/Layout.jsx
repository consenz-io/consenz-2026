import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FileText, Home, User, Settings, LogOut, Plus, Globe, Languages, ArrowUp, Users, Activity } from "lucide-react";
import { LanguageProvider, useLanguage } from "@/components/LanguageContext";
import { Toaster } from "sonner";
import { initBrowserNotifications } from "@/components/notifications/browserNotifications";
import ErrorBoundary from "@/components/ErrorBoundary";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import FloatingNotificationBell from "@/components/notifications/FloatingNotificationBell";
import { AccessibilityAnnouncer } from "@/components/AccessibilityAnnouncer";
import { AccessibilityToolbarContent } from "@/components/AccessibilityToolbar";

function LayoutContent({ children, currentPageName }) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { language, setLanguage, t, isRTL } = useLanguage();
  const [showScrollTop, setShowScrollTop] = React.useState(false);
  const mainContentRef = React.useRef(null);
  
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
    staleTime: 0, // Always fresh for auth
    cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  const { data: userSuggestions = [] } = useQuery({
    queryKey: ['userSuggestions', user?.email],
    queryFn: () => base44.entities.Suggestion.filter({ created_by: user.email }),
    enabled: !!user?.email,
    initialData: [],
  });

  const { data: userVotes = [] } = useQuery({
    queryKey: ['userProVotes', user?.id],
    queryFn: () => base44.entities.Vote.filter({ userId: user.id, vote: 'pro' }),
    enabled: !!user?.id,
    initialData: [],
  });

  const { data: userInteractions = [] } = useQuery({
    queryKey: ['userInteractions', user?.id],
    queryFn: () => base44.entities.UserInteraction.filter({ userId: user.id }),
    enabled: !!user?.id,
    initialData: [],
  });

  const { data: allDocuments = [] } = useQuery({
    queryKey: ['allDocuments'],
    queryFn: () => base44.entities.Document.list(),
    enabled: !!user?.id,
    initialData: [],
  });

  const { data: allSuggestions = [] } = useQuery({
    queryKey: ['allSuggestions'],
    queryFn: () => base44.entities.Suggestion.list(),
    enabled: !!user?.id,
    initialData: [],
  });

  const { data: allVotes = [] } = useQuery({
    queryKey: ['allVotes'],
    queryFn: () => base44.entities.Vote.list(),
    enabled: !!user?.id,
    initialData: [],
  });

  const acceptedSuggestionsCount = React.useMemo(() => 
    userSuggestions.filter(s => s.status === 'accepted').length, 
    [userSuggestions]
  );
  const proVotesCount = React.useMemo(() => userVotes.length, [userVotes]);

  // Calculate unvoted suggestions in user's documents
  const totalUnvotedSuggestions = React.useMemo(() => {
    if (!user?.id) return 0;
    
    // Get user's documents
    const interactedDocumentIds = userInteractions.map(ui => ui.documentId);
    const suggestedDocumentIds = userSuggestions.map(s => s.documentId);
    const votedSuggestions = allSuggestions.filter(s => 
      allVotes.some(v => v.suggestionId === s.id && v.userId === user.id)
    );
    const votedDocumentIds = votedSuggestions.map(s => s.documentId);
    
    const myDocumentIds = new Set([
      ...interactedDocumentIds,
      ...suggestedDocumentIds,
      ...votedDocumentIds
    ]);
    
    const myDocuments = allDocuments.filter(doc => myDocumentIds.has(doc.id));
    
    // Count unvoted suggestions in these documents
    let count = 0;
    myDocuments.forEach(doc => {
      const docSuggestions = allSuggestions.filter(s => s.documentId === doc.id && s.status === 'pending');
      const unvoted = docSuggestions.filter(s => !allVotes.some(v => v.suggestionId === s.id && v.userId === user.id));
      count += unvoted.length;
    });
    
    return count;
  }, [user, userInteractions, userSuggestions, allSuggestions, allVotes, allDocuments]);

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  React.useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Initialize browser notifications on mount
  React.useEffect(() => {
    initBrowserNotifications();
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const skipToMainContent = (e) => {
    e.preventDefault();
    mainContentRef.current?.focus();
    mainContentRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    const initializeUserData = async () => {
      if (user) {
        // Initialize user fields if needed
        const needsUpdate = {};
        if (user.suggestionsCreated === undefined) {
          needsUpdate.suggestionsCreated = 0;
        }
        if (user.points === undefined) {
          needsUpdate.points = 1000;
        }
        if (Object.keys(needsUpdate).length > 0) {
          await base44.auth.updateMe(needsUpdate);
          queryClient.invalidateQueries({ queryKey: ['currentUser'] });
        }

        // Create or update UserPublicProfile automatically
        try {
          const existingProfiles = await base44.entities.UserPublicProfile.filter({ userId: user.id });
          const fullName = user.full_name || '';

          if (existingProfiles.length === 0) {
            // Create new public profile if user has a valid full name
            if (fullName && fullName.trim().length >= 2) {
              await base44.entities.UserPublicProfile.create({
                userId: user.id,
                email: user.email,
                fullName: fullName.trim()
              });
              queryClient.invalidateQueries({ queryKey: ['publicProfiles'] });
            }
          } else {
            // Always update existing profile to ensure sync
            const existingProfile = existingProfiles[0];
            const trimmedFullName = fullName.trim();
            if (trimmedFullName.length >= 2 && trimmedFullName !== existingProfile.fullName) {
              await base44.entities.UserPublicProfile.update(existingProfile.id, {
                fullName: trimmedFullName,
                email: user.email
              });
              queryClient.invalidateQueries({ queryKey: ['publicProfiles'] });
            }
          }
        } catch (err) {
          console.error('Error managing UserPublicProfile:', err);
        }
      }
    };
    initializeUserData();
  }, [user, queryClient]);

  const handleLogout = () => {
    base44.auth.logout();
  };

  // Calculate unread activity count
  const { data: lastVisit } = useQuery({
    queryKey: ['lastActivityVisit', user?.id],
    queryFn: () => Promise.resolve(user?.lastActivityFeedVisit),
    enabled: !!user,
  });

  const { data: userGroupMemberships = [] } = useQuery({
    queryKey: ['userGroupMemberships', user?.id],
    queryFn: () => base44.entities.GroupMember.filter({ userId: user.id }),
    enabled: !!user?.id,
    initialData: [],
  });

  const userGroupIds = userGroupMemberships.map(m => m.groupId);

  const { data: groupDocuments = [] } = useQuery({
    queryKey: ['groupDocuments', userGroupIds.join(',')],
    queryFn: async () => {
      if (userGroupIds.length === 0) return [];
      const docs = await base44.entities.Document.list();
      return docs.filter(doc => doc.groupId && userGroupIds.includes(doc.groupId));
    },
    enabled: userGroupIds.length > 0,
    initialData: [],
  });

  const groupDocIds = groupDocuments.map(d => d.id);

  const { data: recentSuggestions = [] } = useQuery({
    queryKey: ['recentSuggestions'],
    queryFn: () => base44.entities.Suggestion.list('-created_date', 50),
    initialData: [],
  });

  const { data: recentComments = [] } = useQuery({
    queryKey: ['recentComments'],
    queryFn: () => base44.entities.Comment.list('-created_date', 50),
    initialData: [],
  });

  const { data: recentVotes = [] } = useQuery({
    queryKey: ['recentVotes'],
    queryFn: () => base44.entities.Vote.list('-created_date', 50),
    initialData: [],
  });

  const { data: recentVersions = [] } = useQuery({
    queryKey: ['recentVersions'],
    queryFn: () => base44.entities.DocumentVersion.list('-created_date', 50),
    initialData: [],
  });

  const unreadCount = React.useMemo(() => {
    if (!lastVisit || groupDocIds.length === 0) return 0;
    
    const lastVisitDate = new Date(lastVisit);
    let count = 0;

    // Count new suggestions
    count += recentSuggestions.filter(s => 
      groupDocIds.includes(s.documentId) && 
      new Date(s.created_date) > lastVisitDate
    ).length;

    // Count new comments
    recentComments.forEach(c => {
      if (c.rootEntityType === 'suggestion') {
        const relatedSuggestion = recentSuggestions.find(s => s.id === c.rootEntityId);
        if (relatedSuggestion && groupDocIds.includes(relatedSuggestion.documentId) && 
            new Date(c.created_date) > lastVisitDate) {
          count++;
        }
      }
    });

    // Count new votes
    recentVotes.forEach(v => {
      const relatedSuggestion = recentSuggestions.find(s => s.id === v.suggestionId);
      if (relatedSuggestion && groupDocIds.includes(relatedSuggestion.documentId) && 
          new Date(v.created_date) > lastVisitDate) {
        count++;
      }
    });

    // Count new versions
    count += recentVersions.filter(v => 
      groupDocIds.includes(v.documentId) && 
      new Date(v.created_date) > lastVisitDate
    ).length;

    return count;
  }, [lastVisit, groupDocIds, recentSuggestions, recentComments, recentVotes, recentVersions]);

  const navigationItems = [
    {
      title: t('home'),
      url: createPageUrl("Home"),
      icon: Home,
    },
    {
      title: t('myDocuments'),
      url: createPageUrl("MyDocuments"),
      icon: FileText,
      badge: totalUnvotedSuggestions > 0 ? totalUnvotedSuggestions : null,
    },
    {
      title: language === 'he' ? 'הקבוצות שלי' : language === 'ar' ? 'مجموعاتي' : 'My Groups',
      url: createPageUrl("Groups"),
      icon: Users,
    },
  ];

  return (
    <SidebarProvider>
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        onClick={skipToMainContent}
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg"
        style={{ position: 'absolute' }}
      >
        {isRTL ? 'דלג לתוכן המרכזי' : 'Skip to main content'}
      </a>
      
      <div className={`min-h-screen flex w-full max-w-full bg-gradient-to-br from-slate-50 to-blue-50 overflow-x-hidden ${isRTL ? 'flex-row-reverse' : ''}`} style={{ maxWidth: '100vw' }}>
        <Sidebar id="sidebar" className={isRTL ? "border-l border-slate-200" : "border-r border-slate-200"} role="navigation" aria-label={isRTL ? 'תפריט ניווט ראשי' : 'Main navigation'}>
          <SidebarHeader className="border-b border-slate-200 p-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-xl text-slate-900">Consenz</h2>
                <p className="text-xs text-slate-500">Collaborative Consensus</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-2">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-medium text-slate-500 uppercase tracking-wider px-2 py-2">
                {t('navigation')}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200 rounded-lg mb-1 ${
                          location.pathname === item.url ? 'bg-blue-50 text-blue-700' : ''
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-3 py-2 relative">
                          <item.icon className="w-4 h-4" />
                          <span className="font-medium">{item.title}</span>
                          {item.badge && (
                            <span className="absolute top-1 left-1 bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                              {item.badge > 9 ? '9+' : item.badge}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  
                  {user && (
                    <SidebarMenuItem>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200 rounded-lg mb-1 ${
                          location.pathname === createPageUrl("ActivityFeed") ? 'bg-blue-50 text-blue-700' : ''
                        }`}
                      >
                        <Link to={createPageUrl("ActivityFeed")} className="flex items-center gap-3 px-3 py-2 relative">
                          <Activity className="w-4 h-4" />
                          <span className="font-medium">
                            {language === 'he' ? 'פיד פעילות' : language === 'ar' ? 'آخر النشاطات' : 'Activity Feed'}
                          </span>
                          {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                              {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {user?.role === 'admin' && (
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-medium text-slate-500 uppercase tracking-wider px-2 py-2">
                  {language === 'he' ? 'ניהול' : 'Admin'}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200 rounded-lg mb-1 ${
                          location.pathname === createPageUrl("EmailLogs") ? 'bg-blue-50 text-blue-700' : ''
                        }`}
                      >
                        <Link to={createPageUrl("EmailLogs")} className="flex items-center gap-3 px-3 py-2">
                          <Settings className="w-4 h-4" />
                          <span className="font-medium">{language === 'he' ? 'לוג מיילים' : 'Email Logs'}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-medium text-slate-500 uppercase tracking-wider px-2 py-2">
                {t('language')}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <div className="px-3 py-2">
                  <div className="relative">
                    <Languages className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" aria-hidden="true" />
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-medium bg-white cursor-pointer"
                      aria-label={isRTL ? 'בחירת שפה' : 'Select language'}
                      id="language-selector"
                    >
                      <option value="en">English</option>
                      <option value="he">עברית</option>
                      <option value="ar">العربية</option>
                    </select>
                  </div>
                </div>
              </SidebarGroupContent>
            </SidebarGroup>

            {user && (
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-medium text-slate-500 uppercase tracking-wider px-2 py-2">
                  {t('yourStats')}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <div className="px-3 py-2 space-y-3">
                    <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-200">
                      <span className="text-slate-700 font-medium text-sm">{t('acceptedSuggestions')}</span>
                      <span className="font-bold text-xl text-green-600">{acceptedSuggestionsCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{language === 'he' ? 'נקודות שצברת' : language === 'ar' ? 'النقاط المكتسبة' : 'Points earned'}</span>
                      <span className="font-bold text-lg text-blue-600">{user.points || 1000}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{t('suggestionsCreatedByYou')}</span>
                      <span className="font-semibold">{user.suggestionsCreated || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{t('proVotesOnYourSuggestions')}</span>
                      <span className="font-semibold">{proVotesCount}</span>
                    </div>
                  </div>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-medium text-slate-500 uppercase tracking-wider px-2 py-2">
                {language === 'he' ? 'הגדרות' : language === 'ar' ? 'الإعدادات' : 'Settings'}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      asChild 
                      className={`hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200 rounded-lg mb-1 ${
                        location.pathname === createPageUrl("EmailSettings") ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      <Link to={createPageUrl("EmailSettings")} className="flex items-center gap-3 px-3 py-2">
                        <Settings className="w-4 h-4" />
                        <span className="font-medium">{language === 'he' ? 'התראות ודוא״ל' : 'Email & Notifications'}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-medium text-slate-500 uppercase tracking-wider px-2 py-2">
                {language === 'he' ? 'נגישות' : language === 'ar' ? 'إمكانية الوصول' : 'Accessibility'}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <div className="px-3 py-2">
                  <AccessibilityToolbarContent />
                </div>
              </SidebarGroupContent>
            </SidebarGroup>

            </SidebarContent>

          <SidebarFooter className="border-t border-slate-200 p-4">
            {user ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Link to={createPageUrl("Profile")} className="flex-1">
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium text-sm">
                          {user.full_name?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 text-sm truncate">{user.full_name}</p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      </div>
                      </div>
                      </Link>
                      </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="w-full"
                  aria-label={isRTL ? 'התנתקות מהמערכת' : 'Logout from system'}
                >
                  <LogOut className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} aria-hidden="true" />
                  {t('logout')}
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => base44.auth.redirectToLogin()}
                className="w-full"
                aria-label={isRTL ? 'כניסה למערכת' : 'Sign in to system'}
              >
                {t('signIn')}
              </Button>
            )}
          </SidebarFooter>
        </Sidebar>

        <main 
          className="flex-1 flex flex-col min-w-0 max-w-full overflow-x-hidden touch-auto"
          id="main-content"
          ref={mainContentRef}
          tabIndex={-1}
          role="main"
          aria-label={isRTL ? 'תוכן ראשי' : 'Main content'}
        >
          <header className={`bg-white/80 backdrop-blur-sm border-b border-slate-200 ${user && totalUnvotedSuggestions > 0 ? 'fixed' : 'sticky'} top-0 z-30 w-full ${user && totalUnvotedSuggestions > 0 ? 'shadow-md' : ''}`} role="banner">
            <div className={`flex items-center justify-between gap-2 px-2 md:px-6 ${user && totalUnvotedSuggestions > 0 ? 'py-3 md:py-5' : 'py-2 md:py-4'}`}>
              <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                <SidebarTrigger 
                  className="md:hidden hover:bg-slate-100 p-2 rounded-lg transition-colors duration-200 touch-manipulation"
                  aria-label={isRTL ? 'פתיחת תפריט ניווט' : 'Open navigation menu'}
                  aria-expanded="false"
                  aria-controls="sidebar"
                />
                <h1 className="text-base md:text-xl font-bold text-slate-900 md:hidden truncate">Consenz</h1>
              </div>
              {user && totalUnvotedSuggestions > 0 && (
                <Link 
                  to={createPageUrl("MyDocuments")} 
                  className="flex-1 max-w-md mx-2"
                >
                  <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 bg-orange-50 border-2 border-orange-300 rounded-lg hover:bg-orange-100 transition-all shadow-lg hover:shadow-xl cursor-pointer">
                    <div className="w-7 h-7 md:w-8 md:h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm md:text-base font-bold animate-pulse flex-shrink-0">
                      {totalUnvotedSuggestions > 9 ? '9+' : totalUnvotedSuggestions}
                    </div>
                    <span className="text-sm md:text-base font-semibold text-orange-900 flex-1 truncate">
                      {language === 'he' ? 'הצעות ממתינות להצבעתך' : language === 'ar' ? 'اقتراحات تنتظر تصويتك' : 'Suggestions awaiting your vote'}
                    </span>
                  </div>
                </Link>
              )}
            </div>
          </header>

          <div className={`flex-1 overflow-auto max-w-full min-w-0 ${user && totalUnvotedSuggestions > 0 ? 'pt-20 md:pt-24' : ''}`}>
            {children}
          </div>
          </main>

          {showScrollTop && (
            <button
              onClick={scrollToTop}
              type="button"
              className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110 z-50 focus:ring-4 focus:ring-blue-300"
              aria-label={isRTL ? 'גלילה לראש העמוד' : 'Scroll to top'}
            >
              <ArrowUp className="w-5 h-5" aria-hidden="true" />
              <span className="sr-only">{isRTL ? 'גלילה לראש העמוד' : 'Scroll to top'}</span>
              </button>
              )}

              <FloatingNotificationBell />
              <AccessibilityAnnouncer />
              </div>
              </SidebarProvider>
              );
              }

export default function Layout({ children, currentPageName }) {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <LayoutContent children={children} currentPageName={currentPageName} />
      </LanguageProvider>
    </ErrorBoundary>
  );
}