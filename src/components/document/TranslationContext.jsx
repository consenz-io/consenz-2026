import React, { createContext, useContext, useState } from 'react';

const TranslationContext = createContext();

export const useDocumentTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    return {
      globalShowTranslated: false,
      setGlobalShowTranslated: () => {},
      isTranslatingAll: false,
      setIsTranslatingAll: () => {},
      translatedIds: new Set(),
      addTranslatedId: () => {},
    };
  }
  return context;
};

export const TranslationProvider = ({ children }) => {
  const [globalShowTranslated, setGlobalShowTranslated] = useState(false);
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [translatedIds, setTranslatedIds] = useState(new Set());

  const addTranslatedId = (id) => {
    setTranslatedIds(prev => new Set([...prev, id]));
  };

  return (
    <TranslationContext.Provider value={{
      globalShowTranslated,
      setGlobalShowTranslated,
      isTranslatingAll,
      setIsTranslatingAll,
      translatedIds,
      addTranslatedId,
    }}>
      {children}
    </TranslationContext.Provider>
  );
};