import AdminSyncProfiles from './pages/AdminSyncProfiles';
import CreateDocument from './pages/CreateDocument';
import CreateGroup from './pages/CreateGroup';
import DocumentAdmin from './pages/DocumentAdmin';
import DocumentComments from './pages/DocumentComments';
import DocumentVersions from './pages/DocumentVersions';
import EmailLogs from './pages/EmailLogs';
import EmailSettings from './pages/EmailSettings';
import GroupView from './pages/GroupView';
import Groups from './pages/Groups';
import LearnMore from './pages/LearnMore';
import MyDocuments from './pages/MyDocuments';
import Profile from './pages/Profile';
import SectionHistory from './pages/SectionHistory';
import UnderstandingConsensus from './pages/UnderstandingConsensus';
import Home from './pages/Home';
import SuggestionDetail from './pages/SuggestionDetail';
import DocumentView from './pages/DocumentView';
import DocumentCleanView from './pages/DocumentCleanView';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminSyncProfiles": AdminSyncProfiles,
    "CreateDocument": CreateDocument,
    "CreateGroup": CreateGroup,
    "DocumentAdmin": DocumentAdmin,
    "DocumentComments": DocumentComments,
    "DocumentVersions": DocumentVersions,
    "EmailLogs": EmailLogs,
    "EmailSettings": EmailSettings,
    "GroupView": GroupView,
    "Groups": Groups,
    "LearnMore": LearnMore,
    "MyDocuments": MyDocuments,
    "Profile": Profile,
    "SectionHistory": SectionHistory,
    "UnderstandingConsensus": UnderstandingConsensus,
    "Home": Home,
    "SuggestionDetail": SuggestionDetail,
    "DocumentView": DocumentView,
    "DocumentCleanView": DocumentCleanView,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};