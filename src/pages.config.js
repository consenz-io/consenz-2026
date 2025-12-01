import Home from './pages/Home';
import CreateDocument from './pages/CreateDocument';
import DocumentView from './pages/DocumentView';
import Profile from './pages/Profile';
import DocumentAdmin from './pages/DocumentAdmin';
import SuggestionDetail from './pages/SuggestionDetail';
import DocumentVersions from './pages/DocumentVersions';
import DocumentCleanView from './pages/DocumentCleanView';
import MyDocuments from './pages/MyDocuments';
import SectionHistory from './pages/SectionHistory';
import LearnMore from './pages/LearnMore';
import UnderstandingConsensus from './pages/UnderstandingConsensus';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "CreateDocument": CreateDocument,
    "DocumentView": DocumentView,
    "Profile": Profile,
    "DocumentAdmin": DocumentAdmin,
    "SuggestionDetail": SuggestionDetail,
    "DocumentVersions": DocumentVersions,
    "DocumentCleanView": DocumentCleanView,
    "MyDocuments": MyDocuments,
    "SectionHistory": SectionHistory,
    "LearnMore": LearnMore,
    "UnderstandingConsensus": UnderstandingConsensus,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};