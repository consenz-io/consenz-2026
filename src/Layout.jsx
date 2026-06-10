import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FileText, Home, User, Settings, LogOut, Plus, Globe, Languages, ArrowUp, Users } from "lucide-react";
import { LanguageProvider, useLanguage } from "@/components/LanguageContext";
import { Toaster } from "sonner";
import { initBrowserNotifications } from "@/components/notifications/browserNotifications";
import ErrorBoundary from "@/components/ErrorBoundary";
import TutorialController from "@/components/tutorial/TutorialController";
import TutorialRestartButton from "@/components/tutorial/TutorialRestartButton";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import FloatingNotificationBell from "@/components/notifications/FloatingNotificationBell";
import FloatingPointsBadge from "@/components/points/FloatingPointsBadge";
import { AccessibilityAnnouncer } from "@/components/AccessibilityAnnouncer";
import { AccessibilityToolbarContent } from "@/components/AccessibilityToolbar";

function MobileMenuButton({ isRTL, nudgeActive }) {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      onClick={toggleSidebar}
      className={`md:hidden flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors touch-manipulation min-h-[44px] ${nudgeActive ? 'md:absolute md:inset-inline-start-6' : ''}`}
      aria-label={isRTL ? 'פתיחת תפריט ניווט' : 'Open navigation menu'}
      aria-controls="sidebar"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700" aria-hidden="true">
        <rect width="18" height="18" x="3" y="3" rx="2"/>
        <path d="M9 3v18"/>
      </svg>
      <span className="text-base font-bold text-slate-900">Consenz</span>
    </button>
  );
}

function LayoutContent({ children, currentPageName }) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { language, setLanguage, t, isRTL } = useLanguage();
  const [showScrollTop, setShowScrollTop] = React.useState(false);
  const mainContentRef = React.useRef(null);
  const [showUnvotedNudge, setShowUnvotedNudge] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    return sessionStorage.getItem('hideUnvotedNudge') !== 'true';
  });
  const { closeSidebar } = useSidebar();

  // Close sidebar on mobile when clicking any interactive element in sidebar
  React.useEffect(() => {
    const handleSidebarClick = (e) => {
      const target = e.target;
      // Close sidebar on link/button/select clicks
      if (target.tagName === 'A' || target.tagName === 'BUTTON' || target.tagName === 'SELECT') {
        closeSidebar();
      }
    };

    const sidebarContent = document.querySelector('[class*="SidebarContent"]');
    if (!sidebarContent) return;

    sidebarContent.addEventListener('click', handleSidebarClick);
    return () => sidebarContent.removeEventListener('click', handleSidebarClick);
  }, [closeSidebar]);
  
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
    staleTime: 60 * 1000, // 1 minute — prevents cascading refetch on every render while still staying fresh
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });



  const { data: unvotedData } = useQuery({
    queryKey: ['unvotedCount'],
    queryFn: () => base44.functions.invoke('getUnvotedCount', {}),
    enabled: !!user?.id,
    staleTime: 15 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: false,
  });

  const totalUnvotedSuggestions = unvotedData?.data?.count ?? 0;









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

  // Sync preferredLanguage whenever app language changes
  React.useEffect(() => {
    if (!user?.id) return;
    const currentAppLanguage = localStorage.getItem('consenz_language') || 'he';
    if (user.preferredLanguage !== currentAppLanguage) {
      base44.auth.updateMe({ preferredLanguage: currentAppLanguage }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      });
    }
  }, [language, user?.id]);

  // Listen for vote-cast events — debounced to avoid hammering the server
  React.useEffect(() => {
    let timer = null;
    const handleVoteCast = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['unvotedCount'] });
      }, 30000); // wait 30s after vote before re-fetching
    };
    window.addEventListener('consenz:vote-cast', handleVoteCast);
    return () => {
      window.removeEventListener('consenz:vote-cast', handleVoteCast);
      clearTimeout(timer);
    };
  }, [queryClient]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const skipToMainContent = (e) => {
    e.preventDefault();
    mainContentRef.current?.focus();
    mainContentRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const profileInitializedRef = React.useRef(false);

  React.useEffect(() => {
    if (!user || profileInitializedRef.current) return;
    profileInitializedRef.current = true;

    const initializeUserData = async () => {
      // Initialize user fields if needed
      const needsUpdate = {};
      if (user.suggestionsCreated === undefined) needsUpdate.suggestionsCreated = 0;
      if (user.points === undefined) needsUpdate.points = 1000;
      if (user.lastPointsVisit === undefined) needsUpdate.lastPointsVisit = new Date().toISOString();
      if (Object.keys(needsUpdate).length > 0) {
        await base44.auth.updateMe(needsUpdate);
        queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      }

      // Create or update UserPublicProfile — only once per session
      try {
        const fullName = (user.full_name || '').trim();
        if (fullName.length < 2) return;
        const existingProfiles = await base44.entities.UserPublicProfile.filter({ userId: user.id });
        if (existingProfiles.length === 0) {
          await base44.entities.UserPublicProfile.create({ userId: user.id, email: user.email, fullName });
          queryClient.invalidateQueries({ queryKey: ['publicProfiles'] });
        } else if (existingProfiles[0].fullName !== fullName) {
          await base44.entities.UserPublicProfile.update(existingProfiles[0].id, { fullName, email: user.email });
          queryClient.invalidateQueries({ queryKey: ['publicProfiles'] });
        }
      } catch (err) {
        console.error('Error managing UserPublicProfile:', err);
      }
    };

    initializeUserData();
  }, [user?.id, queryClient]);

  const handleLogout = () => {
    base44.auth.logout();
  };





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
                        <Link to={item.url} className="flex items-center gap-3 px-3 py-3 relative min-h-[44px]">
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
                  <SidebarMenuItem>
                    <TutorialRestartButton />
                  </SidebarMenuItem>

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
                      <option value="ar">العربية</option>
                      <option value="he">עברית</option>
                    </select>
                  </div>
                </div>
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
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer min-h-[44px]">
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
          style={{ '--sidebar-width': '16rem' }}
        >
          <header className={`bg-white/80 backdrop-blur-sm border-b border-slate-200 ${user && totalUnvotedSuggestions > 0 && showUnvotedNudge ? 'fixed md:inset-inline-start-64 md:w-[calc(100vw-16rem)]' : 'sticky'} top-0 z-30 w-full ${user && totalUnvotedSuggestions > 0 && showUnvotedNudge ? 'shadow-md' : ''}`} role="banner">
            <div className="flex items-center gap-2 px-2 md:px-6 py-2 md:py-4 w-full min-w-0">
              {/* Left side: Sidebar Trigger + Logo */}
              <div className="flex-shrink-0">
                <MobileMenuButton isRTL={isRTL} nudgeActive={false} />
              </div>

              {/* Center: Unvoted Suggestions Nudge — takes remaining space, never overflows */}
              {user && totalUnvotedSuggestions > 0 && showUnvotedNudge && (
                <Link
                  to={createPageUrl("MyDocuments")}
                  className="flex-1 min-w-0 mx-1 md:mx-4"
                  onClick={() => {
                    setShowUnvotedNudge(false);
                    sessionStorage.setItem('hideUnvotedNudge', 'true');
                  }}
                >
                  <div className="flex items-center gap-2 px-2 md:px-4 py-2 bg-orange-50 border-2 border-orange-300 rounded-lg hover:bg-orange-100 transition-all shadow-lg cursor-pointer">
                    <div className="w-7 h-7 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold animate-pulse flex-shrink-0">
                      {totalUnvotedSuggestions > 9 ? '9+' : totalUnvotedSuggestions}
                    </div>
                    <span className="text-xs md:text-sm font-semibold text-orange-900 truncate min-w-0">
                      {language === 'he' ? 'הצעות ממתינות להצבעתך' : language === 'ar' ? 'اقتراحات تنتظر تصويتك' : 'Suggestions awaiting your vote'}
                    </span>
                  </div>
                </Link>
              )}

              {/* Spacer when nudge is not shown */}
              {!(user && totalUnvotedSuggestions > 0 && showUnvotedNudge) && (
                <div className="flex-1" />
              )}

              {/* Right side: Notification Bell + Points Badge */}
              {user && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <FloatingNotificationBell />
                  <FloatingPointsBadge />
                </div>
              )}
            </div>
          </header>

          <div className={`flex-1 overflow-auto max-w-full min-w-0 ${user && totalUnvotedSuggestions > 0 && showUnvotedNudge ? 'pt-16' : ''}`}>
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

             <AccessibilityAnnouncer />
      <TutorialController />

              </div>
              </SidebarProvider>
              );
              }

export default function Layout({ children, currentPageName }) {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <Toaster position="top-center" richColors closeButton />
        <LayoutContent children={children} currentPageName={currentPageName} />
      </LanguageProvider>
    </ErrorBoundary>
  );
}