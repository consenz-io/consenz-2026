import Home from './pages/Home';
import CreateDocument from './pages/CreateDocument';
import DocumentView from './pages/DocumentView';
import Profile from './pages/Profile';
import DocumentAdmin from './pages/DocumentAdmin';
import SuggestionDetail from './pages/SuggestionDetail';
import DocumentVersions from './pages/DocumentVersions';
import Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "CreateDocument": CreateDocument,
    "DocumentView": DocumentView,
    "Profile": Profile,
    "DocumentAdmin": DocumentAdmin,
    "SuggestionDetail": SuggestionDetail,
    "DocumentVersions": DocumentVersions,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: Layout,
};