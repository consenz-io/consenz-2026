import AdminSyncProfiles from './pages/AdminSyncProfiles';
import CreateDocument from './pages/CreateDocument';
import CreateGroup from './pages/CreateGroup';
import DocumentAdmin from './pages/DocumentAdmin';
import DocumentComments from './pages/DocumentComments';
import DocumentVersions from './pages/DocumentVersions';
import DocumentView from './pages/DocumentView';
import EmailSettings from './pages/EmailSettings';
import GroupView from './pages/GroupView';
import Groups from './pages/Groups';
import Home from './pages/Home';
import LearnMore from './pages/LearnMore';
import MyDocuments from './pages/MyDocuments';
import Profile from './pages/Profile';
import SectionHistory from './pages/SectionHistory';
import SuggestionDetail from './pages/SuggestionDetail';
import UnderstandingConsensus from './pages/UnderstandingConsensus';
import DocumentCleanView from './pages/DocumentCleanView';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminSyncProfiles": AdminSyncProfiles,
    "CreateDocument": CreateDocument,
    "CreateGroup": CreateGroup,
    "DocumentAdmin": DocumentAdmin,
    "DocumentComments": DocumentComments,
    "DocumentVersions": DocumentVersions,
    "DocumentView": DocumentView,
    "EmailSettings": EmailSettings,
    "GroupView": GroupView,
    "Groups": Groups,
    "Home": Home,
    "LearnMore": LearnMore,
    "MyDocuments": MyDocuments,
    "Profile": Profile,
    "SectionHistory": SectionHistory,
    "SuggestionDetail": SuggestionDetail,
    "UnderstandingConsensus": UnderstandingConsensus,
    "DocumentCleanView": DocumentCleanView,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};