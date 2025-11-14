import Home from './pages/Home';
import CreateDocument from './pages/CreateDocument';
import DocumentView from './pages/DocumentView';
import Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "CreateDocument": CreateDocument,
    "DocumentView": DocumentView,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: Layout,
};