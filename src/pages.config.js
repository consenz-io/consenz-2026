/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdminSyncProfiles from './pages/AdminSyncProfiles';
import CreateDocument from './pages/CreateDocument';
import CreateGroup from './pages/CreateGroup';
import DocumentAdmin from './pages/DocumentAdmin';
import DocumentCleanView from './pages/DocumentCleanView';
import DocumentComments from './pages/DocumentComments';
import DocumentView from './pages/DocumentView';
import GroupView from './pages/GroupView';
import Groups from './pages/Groups';
import Home from './pages/Home';
import LearnMore from './pages/LearnMore';
import LoadTesting from './pages/LoadTesting';
import MyDocuments from './pages/MyDocuments';
import NotificationQA from './pages/NotificationQA';
import Profile from './pages/Profile';
import SectionHistory from './pages/SectionHistory';
import UnderstandingConsensus from './pages/UnderstandingConsensus';
import suggestiondetail from './pages/suggestiondetail';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminSyncProfiles": AdminSyncProfiles,
    "CreateDocument": CreateDocument,
    "CreateGroup": CreateGroup,
    "DocumentAdmin": DocumentAdmin,
    "DocumentCleanView": DocumentCleanView,
    "DocumentComments": DocumentComments,
    "DocumentView": DocumentView,
    "GroupView": GroupView,
    "Groups": Groups,
    "Home": Home,
    "LearnMore": LearnMore,
    "LoadTesting": LoadTesting,
    "MyDocuments": MyDocuments,
    "NotificationQA": NotificationQA,
    "Profile": Profile,
    "SectionHistory": SectionHistory,
    "UnderstandingConsensus": UnderstandingConsensus,
    "suggestiondetail": suggestiondetail,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};