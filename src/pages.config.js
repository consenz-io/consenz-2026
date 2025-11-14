import Home from './pages/Home';
import CreateDocument from './pages/CreateDocument';
import DocumentView from './pages/DocumentView';
import Profile from './pages/Profile';
import Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "CreateDocument": CreateDocument,
    "DocumentView": DocumentView,
    "Profile": Profile,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: Layout,
};