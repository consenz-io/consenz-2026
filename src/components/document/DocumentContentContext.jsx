import { createContext, useContext } from "react";

const DocumentContentDataContext = createContext(null);

export function DocumentContentDataProvider({ value, children }) {
  return (
    <DocumentContentDataContext.Provider value={value}>
      {children}
    </DocumentContentDataContext.Provider>
  );
}

export function useDocContent() {
  const ctx = useContext(DocumentContentDataContext);
  if (!ctx) {
    throw new Error("useDocContent must be used within a DocumentContentDataProvider");
  }
  return ctx;
}