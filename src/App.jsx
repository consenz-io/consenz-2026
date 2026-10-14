import './App.css'
import React from 'react'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { LanguageProvider } from '@/components/LanguageContext';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import RejectedSuggestions from './pages/RejectedSuggestions';
import Messages from './pages/Messages';

// Clear cache - EmailLogs has been removed
const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

// Pages that require login (personal data or create/admin actions).
// Everything else is publicly viewable without authentication.
const PROTECTED_PAGES = new Set([
  'MyDocuments', 'Profile', 'CreateDocument', 'CreateGroup',
  'DocumentAdmin', 'AdminSyncProfiles', 'LoadTesting', 'NotificationQA'
]);

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Auth gating is handled per-route by ProtectedRoute, which redirects
  // unauthenticated users to /login (custom auth pages).
  return (
    <Routes>
      <Route path="/login" element={<LanguageProvider><Login /></LanguageProvider>} />
      <Route path="/register" element={<LanguageProvider><Register /></LanguageProvider>} />
      <Route path="/forgot-password" element={<LanguageProvider><ForgotPassword /></LanguageProvider>} />
      <Route path="/reset-password" element={<LanguageProvider><ResetPassword /></LanguageProvider>} />
      {/* Public pages — viewable without login */}
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).filter(([path]) => !PROTECTED_PAGES.has(path)).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}

      {/* Protected pages — require login */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        {Object.entries(Pages).filter(([path]) => PROTECTED_PAGES.has(path)).map(([path, Page]) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            }
          />
        ))}
        <Route
          path="/RejectedSuggestions"
          element={
            <LayoutWrapper currentPageName="RejectedSuggestions">
              <RejectedSuggestions />
            </LayoutWrapper>
          }
        />
        <Route
          path="/Messages"
          element={
            <LayoutWrapper currentPageName="Messages">
              <Messages />
            </LayoutWrapper>
          }
        />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <VisualEditAgent />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App