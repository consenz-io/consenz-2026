import AdminSyncProfiles from './pages/AdminSyncProfiles';
import CreateDocument from './pages/CreateDocument';
import CreateGroup from './pages/CreateGroup';
import DocumentAdmin from './pages/DocumentAdmin';
import DocumentCleanView from './pages/DocumentCleanView';
import DocumentComments from './pages/DocumentComments';
import EmailLogs from './pages/EmailLogs';
import EmailSettings from './pages/EmailSettings';
import GroupView from './pages/GroupView';
import Groups from './pages/Groups';
import LearnMore from './pages/LearnMore';
import MyDocuments from './pages/MyDocuments';
import Profile from './pages/Profile';
import SectionHistory from './pages/SectionHistory';
import SuggestionDetail from './pages/SuggestionDetail';
import UnderstandingConsensus from './pages/UnderstandingConsensus';
import DocumentView from './pages/DocumentView';
import Home from './pages/Home';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminSyncProfiles": AdminSyncProfiles,
    "CreateDocument": CreateDocument,
    "CreateGroup": CreateGroup,
    "DocumentAdmin": DocumentAdmin,
    "DocumentCleanView": DocumentCleanView,
    "DocumentComments": DocumentComments,
    "EmailLogs": EmailLogs,
    "EmailSettings": EmailSettings,
    "GroupView": GroupView,
    "Groups": Groups,
    "LearnMore": LearnMore,
    "MyDocuments": MyDocuments,
    "Profile": Profile,
    "SectionHistory": SectionHistory,
    "SuggestionDetail": SuggestionDetail,
    "UnderstandingConsensus": UnderstandingConsensus,
    "DocumentView": DocumentView,
    "Home": Home,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};