import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FileText, Home, User, Settings, LogOut, Plus, Globe, Languages, ArrowUp, Users } from "lucide-react";
import { LanguageProvider, useLanguage } from "@/components/LanguageContext";
import { Toaster } from "sonner";
import { initBrowserNotifications } from "@/components/notifications/browserNotifications";
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
import { AccessibilityToolbar } from "@/components/AccessibilityToolbar";

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
    staleTime: 0,
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

  const acceptedSuggestionsCount = React.useMemo(() => 
    userSuggestions.filter(s => s.status === 'accepted').length, 
    [userSuggestions]
  );
  const proVotesCount = React.useMemo(() => userVotes.length, [userVotes]);

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
                        <Link to={item.url} className="flex items-center gap-3 px-3 py-2">
                          <item.icon className="w-4 h-4" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
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
          <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-30" role="banner">
            <div className="flex items-center justify-between gap-2 px-2 py-2 md:px-6 md:py-4">
              <div className="flex items-center gap-2 md:gap-4">
                <SidebarTrigger 
                  className="md:hidden hover:bg-slate-100 p-2 rounded-lg transition-colors duration-200 touch-manipulation"
                  aria-label={isRTL ? 'פתיחת תפריט ניווט' : 'Open navigation menu'}
                  aria-expanded="false"
                  aria-controls="sidebar"
                />
                <h1 className="text-base md:text-xl font-bold text-slate-900 md:hidden truncate">Consenz</h1>
              </div>
              <div className="flex items-center gap-2 md:gap-3">
                <div className="relative touch-manipulation">
                  <Languages className="absolute left-1.5 md:left-2 top-1/2 -translate-y-1/2 w-3 h-3 md:w-4 md:h-4 text-slate-500 pointer-events-none" aria-hidden="true" />
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="pl-6 md:pl-7 pr-1.5 md:pr-2 py-1.5 md:py-2 border border-slate-300 rounded-lg text-xs md:text-sm font-medium bg-white cursor-pointer min-w-[70px] md:min-w-[90px] touch-manipulation"
                    aria-label={isRTL ? 'בחירת שפה' : 'Select language'}
                  >
                    <option value="en">EN</option>
                    <option value="he">עב</option>
                    <option value="ar">عر</option>
                  </select>
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto max-w-full min-w-0">
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
              <AccessibilityToolbar />
              <AccessibilityAnnouncer />
              </div>
              </SidebarProvider>
              );
              }

export default function Layout({ children, currentPageName }) {
  return (
    <LanguageProvider>
      <LayoutContent children={children} currentPageName={currentPageName} />
    </LanguageProvider>
  );
}